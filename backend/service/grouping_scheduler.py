"""Automatic startup backfill and ongoing request grouping, independent of browsers."""

import asyncio
import logging
import threading
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from pymongo.errors import DuplicateKeyError

from .feedback_analysis import input_hash
from .condition_grouping import GroupingUnavailable
from .service import FeedbackService, GroupingConflict, to_display_proposal, create_empty_aggregate

logger = logging.getLogger("proviso.grouping")


class GroupingJobs:
    """A renewable lease keeps multiple API workers from repeating AI calls."""

    def __init__(self, db):
        self.collection = db["feedback_grouping_jobs"]

    def claim(self, proposal_id, owner, now):
        fields = {"owner": owner, "lease_until": now + timedelta(minutes=10)}
        try:
            self.collection.insert_one({"_id": proposal_id, **fields})
            return True
        except DuplicateKeyError:
            result = self.collection.update_one(
                {"_id": proposal_id, "lease_until": {"$lte": now}}, {"$set": fields},
            )
            return result.matched_count > 0

    def provider_available(self, now):
        status = self.collection.find_one({"_id": "__provider_cooldown__"})
        return status is None or status["retry_after"] <= now.timestamp()

    def defer_provider(self, until):
        self.collection.update_one({"_id": "__provider_cooldown__"},
                                   {"$set": {"retry_after": until.timestamp()}}, upsert=True)

    def release(self, proposal_id, owner, now):
        self.collection.update_one({"_id": proposal_id, "owner": owner},
                                   {"$set": {"lease_until": now}})

    def renew(self, proposal_id, owner, now):
        result = self.collection.update_one({"_id": proposal_id, "owner": owner},
                                           {"$set": {"lease_until": now + timedelta(minutes=10)}})
        if not result.matched_count:
            raise GroupingConflict("Another worker took over feedback analysis.")


class GroupingScheduler:
    def __init__(self, db, *, service=None, jobs=None, clock=None):
        self.service = service or FeedbackService(db)
        self.jobs = jobs or GroupingJobs(db)
        self.clock = clock or (lambda: datetime.now(timezone.utc))
        self.owner = str(uuid4())
        self._stopping = threading.Event()
        self._wake = asyncio.Event()
        self._task = None

    def start(self):
        self._task = asyncio.create_task(self.run(), name="automatic-feedback-grouping")

    async def stop(self):
        self._stopping.set()
        self._wake.set()
        if self._task:
            await self._task

    def heartbeat(self, proposal_id):
        if self._stopping.is_set():
            raise GroupingConflict("Feedback analysis is shutting down.")
        self.jobs.renew(proposal_id, self.owner, self.clock())

    def run_due(self):
        completed = failed = 0
        if not self.jobs.provider_available(self.clock()):
            return {"completed": 0, "failed": 0}
        for record in self.service.proposals.get_all():
            if self._stopping.is_set():
                break
            proposal_id = record.get("id") or str(record["_id"])
            self.service.recover_feedback_aggregates(proposal_id)
            record = self.service.proposals.get_by_id(proposal_id)
            aggregate = to_display_proposal(record).community_aggregate or create_empty_aggregate()
            submissions = self.service.feedback.get_for_analysis(proposal_id)
            if submissions is None:
                continue
            fingerprint = input_hash(submissions, aggregate)
            if aggregate.grouping_status == "ready" and aggregate.grouping_input_hash == fingerprint:
                continue
            if aggregate.grouping_retry_after and aggregate.grouping_retry_after > self.clock().isoformat():
                continue
            if not self.jobs.claim(proposal_id, self.owner, self.clock()):
                continue
            try:
                # Recheck after claiming: another worker may have completed it
                # between our catalogue read and acquiring the lease.
                fresh = self.service.get_aggregate(proposal_id)
                if fresh.grouping_status == "ready" and fresh.grouping_input_hash == fingerprint:
                    continue
                self.service.group_conditions(proposal_id, heartbeat=lambda: self.heartbeat(proposal_id))
                completed += 1
            except GroupingConflict:
                # A concurrent submission/rejection wins. The next pass uses fresh evidence.
                continue
            except Exception as exc:
                failed += 1
                logger.warning("Automatic feedback analysis failed for %s: %s", proposal_id, type(exc).__name__)
                aggregate.grouping_status = "error"
                aggregate.grouping_error = (str(exc) + " Your feedback is saved; analysis will retry automatically.") if isinstance(exc, GroupingUnavailable) else (
                    "Requests are saved. AI analysis is temporarily unavailable and will retry automatically."
                )
                retry_after = self.clock() + timedelta(seconds=getattr(exc, "retry_after", 60))
                aggregate.grouping_retry_after = retry_after.isoformat()
                # Never overwrite feedback that arrived during a provider failure.
                self.service.proposals.replace_aggregate_if_current(record, aggregate)
                if getattr(exc, "rate_limited", False):
                    self.jobs.defer_provider(retry_after)
                    break
            finally:
                self.jobs.release(proposal_id, self.owner, self.clock())
        return {"completed": completed, "failed": failed}

    async def run(self):
        while not self._stopping.is_set():
            try:
                await asyncio.to_thread(self.run_due)
            except Exception:
                logger.exception("Automatic grouping could not read the feedback catalogue")
            if self._stopping.is_set():
                break
            try:
                await asyncio.wait_for(self._wake.wait(), timeout=10)
            except asyncio.TimeoutError:
                pass
