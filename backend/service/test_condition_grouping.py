import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from auth import create_access_token, get_user_repository
from main import app, get_service
from persistence.persistence import UserRepository
from persistence.test_persistence import MockMongoDatabase
from proposals_DTO import FeedbackConditionDTO, Proposal, ProposalFeedbackSubmissionDTO
from service.condition_grouping import CommentExtraction, GroupingUnavailable, SuggestedGroup
from service.service import FeedbackService, GroupingConflict
from users_DTO import UserRecordDTO


class ConditionGroupingTests(unittest.TestCase):
    def setUp(self):
        extractor = patch("service.feedback_analysis.extract_requests", side_effect=lambda rows: [
            CommentExtraction(number=row["number"], requests=[]) for row in rows
        ])
        self.extractor = extractor.start()
        self.addCleanup(extractor.stop)
        self.service = FeedbackService(MockMongoDatabase())
        self.service.save_proposal(Proposal(
            id="proposal", title="Street design", neighbourhood="Toronto",
            topic="Transportation", status="Open", coordinates=None, summary="", source="",
        ))
        self.submit("alice", "Keep accessible pickup")
        self.submit("bob", "Keep the accessible pickup area")
        self.submit("carol", "Remove accessible pickup")
        self.submit("dana", "Keep deliveries possible")

    def submit(self, participant_id, requirement, time_window=None):
        return self.service.submit_feedback(ProposalFeedbackSubmissionDTO(
            proposal_id="proposal", participant_id=participant_id, position="neutral",
            stakeholder_role="resident", comment="My original comment.",
            condition=FeedbackConditionDTO(requirement=requirement, time_window=time_window),
        ))

    def test_groups_preserve_originals_and_totals_and_keep_distinct_items(self):
        with patch("service.service.suggest_groups", return_value=[
            SuggestedGroup(label="Keep accessible pickup", members=[0, 1]),
        ]) as provider:
            aggregate = self.service.group_conditions("proposal")
        suggested = next(group for group in aggregate.condition_clusters if group.is_suggested)
        self.assertEqual({item.participant_id for item in suggested.items}, {"alice", "bob"})
        self.assertTrue(all(item.verbatim_quote == "My original comment." for item in suggested.items))
        self.assertEqual(aggregate.total_participants, 4)
        self.assertEqual(aggregate.total_conditions, 4)
        self.assertEqual(sum(group.count for group in aggregate.condition_clusters), 4)
        ungrouped = next(group for group in aggregate.condition_clusters if group.is_ungrouped)
        self.assertEqual({item.participant_id for item in ungrouped.items}, {"carol", "dana"})
        self.assertEqual(set(provider.call_args.args[0][0]), {"number", "requirement", "place", "time"})

        alice = next(item for item in suggested.items if item.participant_id == "alice")
        with self.assertRaises(ValueError):
            self.service.reject_condition_group("proposal", alice.id, "bob")
        updated = self.service.reject_condition_group("proposal", alice.id, "alice")
        self.assertFalse(any(group.is_suggested for group in updated.condition_clusters))
        self.assertEqual(updated.total_conditions, 4)
        self.submit("alice", "Keep accessible pickup")
        with patch("service.service.suggest_groups", return_value=[]) as provider:
            self.service.group_conditions("proposal")
        self.assertNotIn("Keep accessible pickup", [row["requirement"] for row in provider.call_args.args[0]])

    def test_invalid_model_members_do_not_overwrite_groups(self):
        previous = self.service.get_aggregate("proposal")
        with patch("service.service.suggest_groups", return_value=[
            SuggestedGroup(label="Invalid", members=[0, 99]),
        ]), self.assertRaises(GroupingUnavailable):
            self.service.group_conditions("proposal")
        self.assertEqual(self.service.get_aggregate("proposal"), previous)

    def test_time_windows_are_supplied_for_semantic_comparison(self):
        self.submit("alice", "Keep accessible pickup", time_window="morning")
        self.submit("bob", "Keep accessible pickup", time_window="evening")
        with patch("service.service.suggest_groups", return_value=[]) as provider:
            updated = self.service.group_conditions("proposal")
        self.assertFalse(any(group.is_suggested for group in updated.condition_clusters))
        self.assertEqual(updated.total_conditions, 4)
        rows = provider.call_args.args[0]
        self.assertEqual([row["time"] for row in rows[:2]], ["morning", "evening"])

    def test_grouping_does_not_overwrite_concurrent_feedback(self):
        def suggest(_):
            self.submit("erin", "Preserve pedestrian access")
            return [SuggestedGroup(label="Keep accessible pickup", members=[0, 1])]

        with patch("service.service.suggest_groups", side_effect=suggest), self.assertRaises(GroupingConflict):
            self.service.group_conditions("proposal")
        self.assertEqual(self.service.get_aggregate("proposal").total_participants, 5)

    def test_api_authentication_and_rejection(self):
        client = TestClient(app)
        app.dependency_overrides[get_service] = lambda: self.service
        self.addCleanup(app.dependency_overrides.clear)
        path = "/api/proposals/proposal/condition-groups"
        users = UserRepository(self.service.feedback.db)
        users.create(UserRecordDTO(username="alice", password_hash="unused", created_at="2026-01-01"))
        app.dependency_overrides[get_user_repository] = lambda: users
        self.assertEqual(client.post(path).status_code, 401)
        headers = {"Authorization": f"Bearer {create_access_token('alice')}"}
        with patch("service.service.suggest_groups", return_value=[
            SuggestedGroup(label="Keep accessible pickup", members=[0, 1]),
        ]):
            self.service.group_conditions("proposal")
            response = client.post(path, headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["grouping_status"], "pending")
        group = next(group for group in response.json()["condition_clusters"] if group["is_suggested"])
        alice = next(item for item in group["items"] if item["participant_id"] == "alice")
        self.assertEqual(client.post(f"{path}/{alice['id']}/reject", headers=headers).status_code, 200)
