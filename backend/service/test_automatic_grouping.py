"""End-to-end automatic grouping using deterministic provider and MongoDB doubles."""

import asyncio
import copy
import json
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

from proposals_DTO import FeedbackConditionDTO, Proposal, ProposalFeedbackSubmissionDTO
from service.condition_grouping import (
    CommentExtraction, ExtractedRequest, GroupingUnavailable, SuggestedGroup, _complete, extract_requests,
)
from service.feedback_analysis import input_hash
from service.grouping_scheduler import GroupingJobs, GroupingScheduler
from service.service import FeedbackService, GroupingConflict
from service.test_proposal_snapshots import Collection, Database as SnapshotDatabase


class AnalysisCollection(Collection):
    def replace_one(self, query, replacement, upsert=False):
        previous = self.find_one(query)
        if previous is not None:
            self.documents[previous["_id"]] = copy.deepcopy(replacement)
            return SimpleNamespace(matched_count=1)
        if upsert:
            self.insert_one(replacement)
        return SimpleNamespace(matched_count=0)

    @staticmethod
    def matches(doc, query):
        for key, value in query.items():
            if isinstance(value, dict) and not any(k.startswith("$") for k in value):
                if doc.get(key) != value:
                    return False
            elif not Collection.matches(doc, {key: value}):
                return False
        return True


class Database(SnapshotDatabase):
    def __getitem__(self, name):
        return self.collections.setdefault(name, AnalysisCollection())


class AutomaticGroupingTests(unittest.TestCase):
    def setUp(self):
        self.db = Database()
        self.service = FeedbackService(self.db)
        self.service.save_proposal(Proposal(id="park", title="Park", neighbourhood="Toronto", topic="Planning",
                                            status="Open", summary="", source=""))
        self.now = datetime(2026, 11, 14, tzinfo=timezone.utc)
        self.scheduler = GroupingScheduler(self.db, clock=lambda: self.now)
        extractor = patch("service.feedback_analysis.extract_requests", side_effect=self.extract)
        self.extractor = extractor.start()
        self.addCleanup(extractor.stop)
        grouper = patch("service.service.suggest_groups", side_effect=self.group)
        self.grouper = grouper.start()
        self.addCleanup(grouper.stop)

    @staticmethod
    def extract(rows):
        result = []
        for row in rows:
            requests = []
            if "benches" in row["comment"].lower() and not row["explicit_requirement"]:
                requests.append(ExtractedRequest(requirement="Add benches", quote=row["comment"]))
            if "shade" in row["comment"].lower():
                requests.append(ExtractedRequest(requirement="Add shade", quote=row["comment"]))
            result.append(CommentExtraction(number=row["number"], requests=requests))
        return result

    @staticmethod
    def group(rows):
        # This fake model only groups bench requests; unique requests stay visible.
        members = [row["number"] for row in rows if "bench" in row["requirement"].lower()]
        return [SuggestedGroup(label="More seating", members=members)] if len(members) > 1 else []

    def submit(self, person, requirement=None, comment="", position="neutral"):
        return self.service.submit_feedback(ProposalFeedbackSubmissionDTO(
            proposal_id="park", participant_id=person, position=position, stakeholder_role="resident",
            comment=comment, condition=FeedbackConditionDTO(requirement=requirement) if requirement else None,
        ))

    def items(self):
        return [item for group in self.service.get_aggregate("park").condition_clusters for item in group.items]

    def test_startup_backfill_recovers_raw_requests_missing_from_aggregate(self):
        self.submit("alice", "Add benches")
        self.submit("bob", comment="Please add benches and shade.")
        # Simulate historical feedback whose requirements were never materialized.
        record = self.service.proposals.get_by_id("park")
        record["community_aggregate"]["condition_clusters"] = []
        record["community_aggregate"]["total_conditions"] = 0
        self.service.proposals.collection.replace_one({"_id": "park"}, record)
        self.assertEqual({"completed": 1, "failed": 0}, self.scheduler.run_due())
        aggregate = self.service.get_aggregate("park")
        group = next(c for c in aggregate.condition_clusters if c.is_suggested)
        self.assertEqual({"alice", "bob"}, {i.participant_id for i in group.items})
        self.assertEqual(3, aggregate.total_conditions)
        self.assertEqual(2, aggregate.total_participants)
        self.assertEqual("ready", aggregate.grouping_status)
        self.assertEqual(aggregate.grouping_input_hash, input_hash(self.service.feedback.get_by_proposal("park"), aggregate))
        comment_items = [i for i in self.items() if i.source == "comment"]
        self.assertEqual(2, len(comment_items))
        self.assertTrue(all(i.verbatim_quote == "Please add benches and shade." and not i.is_conditional_support
                            for i in comment_items))
        self.assertEqual(1, aggregate.condition_clusters[0].count)  # Unique shade request preserved.
        self.assertEqual({"completed": 0, "failed": 0}, self.scheduler.run_due())
        self.assertEqual(1, self.extractor.call_count)

    def test_new_feedback_automatically_joins_existing_groups_and_caches_old_comments(self):
        self.submit("alice", "Add benches")
        self.submit("bob", comment="More benches please.")
        self.scheduler.run_due()
        _, pending = self.submit("carol", comment="Please add benches.")
        self.assertEqual("pending", pending.grouping_status)
        self.scheduler.run_due()
        group = next(c for c in self.service.get_aggregate("park").condition_clusters if c.is_suggested)
        self.assertEqual(3, group.count)
        self.assertEqual(1, len(self.extractor.call_args.args[0]))
        # Unrelated edits preserve membership and don't invoke the provider again.
        _, updated = self.submit("alice", "Add benches", position="support")
        self.assertEqual(group.id, next(c.id for c in updated.condition_clusters if c.is_suggested))
        self.assertEqual("ready", updated.grouping_status)
        self.assertEqual({"completed": 0, "failed": 0}, self.scheduler.run_due())

    def test_editing_and_removing_comments_replaces_old_extracted_evidence(self):
        self.submit("alice", comment="More benches please.")
        self.submit("bob", "Add benches")
        self.scheduler.run_due()
        self.submit("alice", comment="Please add shade.")
        self.scheduler.run_due()
        aggregate = self.service.get_aggregate("park")
        self.assertEqual(2, aggregate.total_participants)
        self.assertEqual(2, aggregate.total_conditions)
        self.assertFalse(any(c.is_suggested for c in aggregate.condition_clusters))
        self.assertEqual(["Add shade"], [i.extracted_requirement for i in self.items() if i.participant_id == "alice"])
        self.submit("alice", comment="Thanks.")
        self.scheduler.run_due()
        self.assertEqual(1, self.service.get_aggregate("park").total_conditions)
        self.assertFalse(any(i.participant_id == "alice" for i in self.items()))

    def test_rejection_survives_background_passes_and_unchanged_resubmission(self):
        self.submit("alice", comment="More benches please.")
        self.submit("bob", "Add benches")
        self.scheduler.run_due()
        alice = next(i for i in self.items() if i.participant_id == "alice")
        self.service.reject_condition_group("park", alice.id, "alice")
        self.submit("alice", comment="More benches please.", position="support")
        self.scheduler.run_due()
        self.assertTrue(next(i for i in self.items() if i.participant_id == "alice").grouping_rejected)
        self.assertFalse(any(c.is_suggested for c in self.service.get_aggregate("park").condition_clusters))

    def test_failure_is_visible_retried_and_preserves_existing_evidence(self):
        self.submit("alice", "Add benches")
        self.submit("bob", comment="More benches please.")
        with patch("service.feedback_analysis.extract_requests", side_effect=GroupingUnavailable("offline")):
            self.assertEqual({"completed": 0, "failed": 1}, self.scheduler.run_due())
        aggregate = self.service.get_aggregate("park")
        self.assertEqual("error", aggregate.grouping_status)
        self.assertIn("retry", aggregate.grouping_error)
        self.assertEqual(1, aggregate.total_conditions)
        self.assertEqual({"completed": 0, "failed": 0}, self.scheduler.run_due())
        self.now += timedelta(minutes=1)
        self.assertEqual({"completed": 1, "failed": 0}, self.scheduler.run_due())
        self.assertEqual(2, self.service.get_aggregate("park").total_conditions)

    def test_grouping_failure_cannot_overwrite_concurrent_feedback(self):
        self.submit("alice", "Add benches")
        self.submit("bob", "Add benches")
        def fail(rows):
            self.submit("carol", "Add shade")
            raise GroupingUnavailable("offline")
        with patch("service.service.suggest_groups", side_effect=fail):
            self.scheduler.run_due()
        self.assertEqual(3, self.service.get_aggregate("park").total_participants)
        self.assertEqual("pending", self.service.get_aggregate("park").grouping_status)
        self.scheduler.run_due()
        self.assertEqual(3, self.service.get_aggregate("park").total_conditions)

    def test_two_workers_do_not_repeat_completed_work_and_expired_leases_recover(self):
        self.submit("alice", "Add benches")
        jobs = GroupingJobs(self.db)
        self.assertTrue(jobs.claim("park", "other-worker", self.now))
        self.assertEqual({"completed": 0, "failed": 0}, self.scheduler.run_due())
        self.now += timedelta(minutes=11)
        self.assertEqual({"completed": 1, "failed": 0}, self.scheduler.run_due())
        restarted = GroupingScheduler(self.db, clock=lambda: self.now)
        self.assertEqual({"completed": 0, "failed": 0}, restarted.run_due())

    def test_interrupted_feedback_save_recovers_without_double_counting(self):
        submission = ProposalFeedbackSubmissionDTO(proposal_id="park", participant_id="alice", position="support",
                                                   stakeholder_role="resident", condition=FeedbackConditionDTO(requirement="Add benches"))
        # Raw submission saved, but count update interrupted.
        self.service.feedback.save_submission(submission)
        with self.assertRaises(GroupingConflict):
            self.service.group_conditions("park")
        self.scheduler.run_due()
        self.assertEqual(1, self.service.get_aggregate("park").total_participants)
        # Count update succeeded, but pending marker was not cleared before a restart.
        self.db["feedback"].update_one({"_id": "park:alice"}, {"$set": {"_aggregate_pending": True}})
        self.scheduler.run_due()
        self.assertEqual(1, self.service.get_aggregate("park").total_participants)
        self.assertEqual(1, self.service.get_aggregate("park").total_conditions)

    def test_one_person_is_not_counted_twice_for_equivalent_requests(self):
        self.submit("alice", "More benches", comment="Please add benches and shade.")
        self.submit("bob", "Add benches")
        # Simulate an extractor paraphrasing an already explicit request.
        with patch("service.feedback_analysis.extract_requests", return_value=[CommentExtraction(number=0, requests=[
            ExtractedRequest(requirement="Add benches", quote="Please add benches"),
        ])]):
            self.scheduler.run_due()
        group = next(c for c in self.service.get_aggregate("park").condition_clusters if c.is_suggested)
        self.assertEqual(2, group.count)
        self.assertEqual(2, len({i.participant_id for i in group.items}))
        self.assertEqual(2, self.service.get_aggregate("park").total_conditions)

    def test_exact_duplicates_are_grouped_even_if_model_omits_them(self):
        self.submit("alice", "Add benches")
        self.submit("bob", "Add benches")
        with patch("service.service.suggest_groups", return_value=[]):
            self.scheduler.run_due()
        self.assertEqual(2, next(c.count for c in self.service.get_aggregate("park").condition_clusters if c.is_suggested))

    def test_comment_edit_preserves_unchanged_explicit_requirement_membership(self):
        self.submit("alice", "Add benches")
        self.submit("bob", "Add benches")
        self.scheduler.run_due()
        group = next(c for c in self.service.get_aggregate("park").condition_clusters if c.is_suggested)
        _, updated = self.submit("alice", "Add benches", comment="Also please add shade.")
        self.assertEqual(group.id, next(c.id for c in updated.condition_clusters if c.is_suggested))
        self.scheduler.run_due()
        self.assertEqual(3, self.service.get_aggregate("park").total_conditions)

    def test_overlapping_saves_from_one_participant_count_only_the_latest_response(self):
        first = ProposalFeedbackSubmissionDTO(proposal_id="park", participant_id="alice", position="oppose",
                                              stakeholder_role="resident", comment="Please add shade.")
        saved, _, previous = self.service.feedback.save_submission(first)
        self.submit("alice", "Add benches", position="support")
        self.service.apply_saved_feedback(saved, previous)
        aggregate = self.service.get_aggregate("park")
        self.assertEqual(1, aggregate.total_participants)
        self.assertEqual(1, aggregate.position_distribution["support"])
        self.assertEqual(0, aggregate.position_distribution["oppose"])
        self.scheduler.run_due()
        self.assertEqual(["Add benches"], [i.extracted_requirement for i in self.items()])

    def test_rate_limits_create_shared_cooldown_instead_of_retrying_every_proposal(self):
        self.submit("alice", "Add benches")
        self.submit("bob", "Add benches")
        with patch("service.service.suggest_groups", side_effect=GroupingUnavailable(
            "Rate limit", retry_after=10, rate_limited=True,
        )) as provider:
            self.assertEqual({"completed": 0, "failed": 1}, self.scheduler.run_due())
            restarted = GroupingScheduler(self.db, clock=lambda: self.now)
            self.assertEqual({"completed": 0, "failed": 0}, restarted.run_due())
            self.assertEqual(1, provider.call_count)
        self.now += timedelta(seconds=10)
        self.assertEqual({"completed": 1, "failed": 0}, self.scheduler.run_due())

    def test_verbose_comment_batches_split_after_truncated_model_output(self):
        self.submit("alice", comment="Please add benches.")
        self.submit("bob", comment="Please add shade.")
        def verbose(rows):
            if len(rows) > 1:
                raise GroupingUnavailable("Truncated", incomplete=True)
            return self.extract(rows)
        with patch("service.feedback_analysis.extract_requests", side_effect=verbose) as provider:
            self.scheduler.run_due()
        self.assertEqual(3, provider.call_count)
        self.assertEqual(2, self.service.get_aggregate("park").total_conditions)


class ProviderValidationTests(unittest.TestCase):
    def test_invented_quote_missing_and_duplicated_comments_are_rejected(self):
        rows = [{"number": 0, "comment": "Add shade.", "explicit_requirement": None}]
        for result in [
            {"comments": []},
            {"comments": [{"number": 0, "requests": [{"requirement": "Add benches", "quote": "Add benches"}]}]},
            {"comments": [{"number": 0, "requests": []}, {"number": 0, "requests": []}]},
        ]:
            with self.subTest(result=result), patch("service.condition_grouping._complete", return_value=json.dumps(result)), \
                    self.assertRaises(GroupingUnavailable):
                extract_requests(rows)

    def test_truncated_provider_response_is_not_treated_as_success(self):
        with patch.dict("os.environ", {"GROQ_API_KEY": "test-key"}), patch("service.condition_grouping.OpenAI") as client:
            client.return_value.__enter__.return_value.chat.completions.create.return_value = SimpleNamespace(
                choices=[SimpleNamespace(finish_reason="length", message=SimpleNamespace(content='{"comments":[]}'))],
            )
            with self.assertRaises(GroupingUnavailable) as error:
                _complete("instructions", [])
            self.assertTrue(error.exception.incomplete)


class GroupingLifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def test_shutdown_stops_background_loop(self):
        scheduler = GroupingScheduler(Database())
        scheduler.start()
        await asyncio.sleep(0)
        await asyncio.wait_for(scheduler.stop(), timeout=1)
        self.assertTrue(scheduler._task.done())
