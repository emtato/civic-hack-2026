"""Hourly source refresh independent of browsers, managed by FastAPI lifespan."""

import asyncio
import logging
import threading
from datetime import datetime, timedelta, timezone
from uuid import uuid4

try:
    from persistence.snapshot_jobs import SnapshotJobRepository
    from service.proposal_snapshots import ProposalSnapshotService
except ImportError:
    from backend.persistence.snapshot_jobs import SnapshotJobRepository
    from backend.service.proposal_snapshots import ProposalSnapshotService

logger = logging.getLogger("proviso.snapshot_scheduler")


def hour_slot(now):
    return now.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)


def seconds_to_next_hour(now):
    return (hour_slot(now) + timedelta(hours=1) - now).total_seconds()


class SnapshotScheduler:
    def __init__(self, db, *, clock=None, service=None, jobs=None):
        self.clock = clock or (lambda: datetime.now(timezone.utc))
        self.service = service or ProposalSnapshotService(db)
        self.jobs = jobs or SnapshotJobRepository(db)
        self.owner = str(uuid4())
        self._stopping = threading.Event()
        self._wake = asyncio.Event()
        self._task = None

    def start(self):
        self._task = asyncio.create_task(self.run(), name="hourly-proposal-snapshots")

    async def stop(self):
        self._stopping.set()
        self._wake.set()
        if self._task is not None:
            # Let an in-flight synchronous HTTP/DB call finish before closing
            # MongoDB. No additional proposals start once shutdown is requested.
            await self._task

    def run_due(self):
        """One recoverable pass for this hour; successful jobs are not repeated."""
        hour = hour_slot(self.clock())
        completed = failed = 0
        for proposal in self.service.proposals.get_all():
            if self._stopping.is_set():
                break
            if not proposal.get("source_notices"):
                continue
            proposal_id = proposal.get("id") or str(proposal["_id"])
            job_id = None
            try:
                job_id = self.jobs.claim(proposal_id, hour, self.owner, self.clock())
                if job_id is None:
                    continue
                # Includes recovery of comparisons missing after an interrupted
                # capture, and leaves seeded demo predecessors outside real history.
                self.service.check_proposal_updates(proposal_id)
                self.jobs.finish(job_id, proposal_id, self.owner, self.clock())
                completed += 1
            except Exception:
                failed += 1
                logger.exception("Hourly proposal check failed for %s", proposal_id)
                if job_id is not None:
                    try:
                        self.jobs.fail(job_id, proposal_id, self.owner, self.clock())
                    except Exception:
                        logger.exception("Could not record failed proposal check for %s", proposal_id)
        if completed or failed:
            logger.info("Hourly proposal check: %s completed, %s failed", completed, failed)
        return {"completed": completed, "failed": failed}

    async def run(self):
        # Start with a catch-up pass for the current hour, then align to :00.
        # Five-minute wakeups only retry failed/expired jobs; completed jobs stay
        # deduplicated in MongoDB even across process restarts and multiple workers.
        while not self._stopping.is_set():
            started_hour = hour_slot(self.clock())
            try:
                await asyncio.to_thread(self.run_due)
            except Exception:
                logger.exception("Hourly proposal scheduler could not read the catalogue")
            if self._stopping.is_set():
                break
            if hour_slot(self.clock()) != started_hour:
                # A long pass crossed :00; service the new hour immediately.
                continue
            delay = max(0.01, min(300.0, seconds_to_next_hour(self.clock())))
            try:
                await asyncio.wait_for(self._wake.wait(), timeout=delay)
            except asyncio.TimeoutError:
                pass
