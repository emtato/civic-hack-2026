"""Deterministic scheduler checks without real timers, HTTP or MongoDB."""

import asyncio
import copy
import threading
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, Mock, patch

from fastapi import FastAPI

from persistence.snapshot_jobs import SnapshotJobRepository
from service.snapshot_scheduler import SnapshotScheduler, hour_slot, seconds_to_next_hour
from service import test_proposal_snapshots as fixtures


class SchedulerTests(unittest.TestCase):
    def setUp(self):
        fixture = fixtures.SnapshotTests("runTest")
        fixture.setUp()
        self.db, self.service = fixture.db, fixture.service
        self.now = datetime(2026, 11, 13, 22, 59, 40, tzinfo=timezone.utc)
        self.scheduler = SnapshotScheduler(self.db, clock=lambda: self.now, service=self.service)

    def test_aligns_to_the_next_hour_across_midnight(self):
        self.assertEqual(20, seconds_to_next_hour(self.now))
        self.assertEqual(0, hour_slot(self.now).minute)
        self.assertEqual(1, seconds_to_next_hour(self.now.replace(hour=23, minute=59, second=59)))
        self.assertEqual(3600, seconds_to_next_hour(hour_slot(self.now)))

    def test_hour_runs_without_a_browser_and_duplicate_workers_or_restarts_do_not_repeat_it(self):
        with patch.object(self.service, "check_proposal_updates", wraps=self.service.check_proposal_updates) as check:
            self.assertEqual({"completed": 1, "failed": 0}, self.scheduler.run_due())
            restarted = SnapshotScheduler(self.db, clock=lambda: self.now, service=self.service)
            self.assertEqual({"completed": 0, "failed": 0}, restarted.run_due())
            self.assertEqual(1, check.call_count)
            self.now = hour_slot(self.now) + timedelta(hours=1)
            self.assertEqual({"completed": 1, "failed": 0}, restarted.run_due())
            self.assertEqual(2, check.call_count)
        status = self.service.read_proposal_updates("example")
        self.assertEqual("ready", status.source_status)
        self.assertEqual(self.now, status.checked_at)
        self.assertEqual(2, len(self.db["proposal_snapshot_jobs"].documents))

    def test_failed_proposal_does_not_block_others_and_retries_after_backoff(self):
        self.now = self.now.replace(minute=10, second=0)
        other = copy.deepcopy(self.db["imported_proposals"].documents["example"])
        other.update(_id="other", id="other")
        self.db["imported_proposals"].insert_one(other)
        actual = self.service.check_proposal_updates

        def fail_one(proposal_id):
            if proposal_id == "example":
                raise ValueError("Unavailable source")
            return actual(proposal_id)

        with patch.object(self.service, "check_proposal_updates", side_effect=fail_one), self.assertLogs("proviso.snapshot_scheduler", level="ERROR"):
            self.assertEqual({"completed": 1, "failed": 1}, self.scheduler.run_due())
        status = self.service.read_proposal_updates("example")
        self.assertEqual("error", status.source_status)
        self.assertIsNone(status.checked_at)
        self.assertIsNone(status.snapshot_id)
        self.now += timedelta(minutes=4)
        with patch.object(self.service, "check_proposal_updates") as check:
            self.assertEqual({"completed": 0, "failed": 0}, self.scheduler.run_due())
            check.assert_not_called()
        self.now += timedelta(minutes=1)
        self.assertEqual({"completed": 1, "failed": 0}, self.scheduler.run_due())
        self.assertEqual("ready", self.service.read_proposal_updates("example").source_status)

    def test_expired_claim_recovers_and_old_owner_cannot_complete_it(self):
        jobs = SnapshotJobRepository(self.db)
        slot = hour_slot(self.now)
        key = jobs.claim("example", slot, "old-worker", self.now)
        self.assertIsNone(jobs.claim("example", slot, "new-worker", self.now))
        self.now += timedelta(minutes=11)
        self.assertEqual(key, jobs.claim("example", slot, "new-worker", self.now))
        jobs.finish(key, "example", "old-worker", self.now)
        self.assertEqual("running", self.db["proposal_snapshot_jobs"].documents[key]["status"])
        jobs.finish(key, "example", "new-worker", self.now)
        self.assertEqual("completed", self.db["proposal_snapshot_jobs"].documents[key]["status"])
        self.assertIsNone(jobs.claim("example", slot, "third-worker", self.now + timedelta(hours=1)))

    def test_failure_preserves_last_successful_check_and_saved_evidence(self):
        self.scheduler.run_due()
        previous = self.service.read_proposal_updates("example")
        self.now += timedelta(hours=1)
        with patch.object(self.service, "check_proposal_updates", side_effect=ValueError("offline")), self.assertLogs("proviso.snapshot_scheduler", level="ERROR"):
            self.scheduler.run_due()
        result = self.service.read_proposal_updates("example")
        self.assertEqual("error", result.source_status)
        self.assertEqual(previous.checked_at, result.checked_at)
        self.assertEqual(previous.snapshot_id, result.snapshot_id)


class SchedulerLifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def test_a_pass_crossing_hour_boundary_starts_the_new_hour_without_sleeping(self):
        now = [datetime(2026, 11, 13, 22, 59, 40, tzinfo=timezone.utc)]
        scheduler = SnapshotScheduler({}, clock=lambda: now[0], service=Mock(), jobs=Mock())
        calls = []

        def pass_once():
            calls.append(hour_slot(now[0]))
            if len(calls) == 1:
                now[0] += timedelta(seconds=30)
            else:
                scheduler._stopping.set()

        scheduler.run_due = pass_once
        with patch("service.snapshot_scheduler.asyncio.wait_for") as wait:
            await scheduler.run()
            wait.assert_not_called()
        self.assertEqual([22, 23], [slot.hour for slot in calls])

    async def test_waits_until_hour_boundary_without_blocking_the_event_loop(self):
        now = datetime(2026, 11, 13, 22, 59, 40, tzinfo=timezone.utc)
        scheduler = SnapshotScheduler({}, clock=lambda: now, service=Mock(), jobs=Mock())
        scheduler.run_due = Mock()
        delays = []

        async def wait_once(waiter, timeout):
            delays.append(timeout)
            waiter.close()
            scheduler._stopping.set()
            raise asyncio.TimeoutError

        with patch("service.snapshot_scheduler.asyncio.wait_for", side_effect=wait_once):
            await scheduler.run()
        self.assertEqual([20], delays)
        scheduler.run_due.assert_called_once()

    async def test_shutdown_waits_for_inflight_job_before_returning(self):
        scheduler = SnapshotScheduler({}, service=Mock(), jobs=Mock())
        began = asyncio.Event()
        release = threading.Event()
        loop = asyncio.get_running_loop()

        def job():
            loop.call_soon_threadsafe(began.set)
            release.wait(timeout=2)

        scheduler.run_due = job
        scheduler.start()
        try:
            await asyncio.wait_for(began.wait(), timeout=1)
            shutdown = asyncio.create_task(scheduler.stop())
            await asyncio.sleep(0)
            self.assertFalse(shutdown.done())
        finally:
            release.set()
        await asyncio.wait_for(shutdown, timeout=1)

    async def test_fastapi_lifespan_starts_and_stops_scheduler_before_closing_database(self):
        from main import lifespan

        events = []
        client = Mock()
        client.close.side_effect = lambda: events.append("database closed")
        scheduler = Mock()
        scheduler.start.side_effect = lambda: events.append("scheduler started")
        scheduler.stop = AsyncMock(side_effect=lambda: events.append("scheduler stopped"))
        with patch("main.get_mongo_client", return_value=client), patch("main.get_database", return_value={}), \
             patch("main.ensure_indexes"), patch("main.FeedbackService"), patch("main.SnapshotScheduler", return_value=scheduler), \
             patch.dict("os.environ", {"SNAPSHOT_SCHEDULER_ENABLED": "true"}):
            async with lifespan(FastAPI()):
                self.assertEqual(["scheduler started"], events)
        self.assertEqual(["scheduler started", "scheduler stopped", "database closed"], events)
