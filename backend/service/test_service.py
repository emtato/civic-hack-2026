"""Tests for Service layer logic and orchestration."""

import unittest

try:
    from models import (
        FeedbackConditionDTO,
        Proposal,
        ProposalFeedbackSubmissionDTO,
    )
    from persistence.test_persistence import MockMongoDatabase
    from service.service import (
        FeedbackService,
        apply_feedback_to_aggregate,
        create_empty_aggregate,
    )
except ImportError:
    from backend.models import (
        FeedbackConditionDTO,
        Proposal,
        ProposalFeedbackSubmissionDTO,
    )
    from backend.persistence.test_persistence import MockMongoDatabase
    from backend.service.service import (
        FeedbackService,
        apply_feedback_to_aggregate,
        create_empty_aggregate,
    )


class ServiceLogicTests(unittest.TestCase):
    def setUp(self):
        self.db = MockMongoDatabase()
        self.service = FeedbackService(self.db)
        self.service.seed_initial_proposals()

    def test_apply_feedback_to_aggregate_logic(self):
        agg = create_empty_aggregate()
        self.assertEqual(agg.total_participants, 0)
        self.assertEqual(agg.position_distribution["support"], 0)

        sub = ProposalFeedbackSubmissionDTO(
            proposal_id="kensington",
            participant_id="user-logic",
            position="support",
            stakeholder_role="resident",
            element_ratings={},
            comment="I support with conditions",
            condition=FeedbackConditionDTO(
                requirement="Clear pathway",
                is_conditional_support=True,
            ),
        )

        updated = apply_feedback_to_aggregate(agg, sub)
        self.assertEqual(updated.total_participants, 1)
        self.assertEqual(updated.position_distribution["support"], 1)
        self.assertEqual(updated.stakeholder_distribution["resident"], 1)
        self.assertEqual(updated.total_conditions, 1)

    def test_submit_feedback_workflow(self):
        kensington = self.service.get_proposal("kensington")
        initial_participants = kensington.community_aggregate.total_participants

        submission = ProposalFeedbackSubmissionDTO(
            proposal_id="kensington",
            participant_id="user-svc-1",
            position="strongly_support",
            stakeholder_role="business",
            element_ratings={"loading_windows": "support"},
            comment="Crucial for market delivery trucks.",
            condition=FeedbackConditionDTO(
                feature_id="loading_windows",
                requirement="Dedicated delivery window 7–9 AM",
                is_conditional_support=True,
                time_window="7–9 AM",
                location_label="Augusta Ave",
            ),
        )

        saved_sub, updated_agg = self.service.submit_feedback(submission)
        self.assertEqual(saved_sub.participant_id, "user-svc-1")
        self.assertEqual(updated_agg.total_participants, initial_participants + 1)
        self.assertEqual(
            updated_agg.position_distribution["strongly_support"],
            kensington.community_aggregate.position_distribution.get("strongly_support", 0) + 1,
        )

        # Check persisted aggregate on the proposal
        persisted = self.service.get_proposal("kensington")
        self.assertEqual(
            persisted.community_aggregate.total_participants,
            initial_participants + 1,
        )

    def test_repeat_submission_updates_counts_correctly(self):
        initial = self.service.get_proposal("kensington")
        initial_participants = initial.community_aggregate.total_participants
        initial_support = initial.community_aggregate.position_distribution.get("support", 0)
        initial_oppose = initial.community_aggregate.position_distribution.get("oppose", 0)

        # 1. First submission: support
        sub1 = ProposalFeedbackSubmissionDTO(
            proposal_id="kensington",
            participant_id="user-dup",
            position="support",
            stakeholder_role="resident",
            element_ratings={},
            comment="Initial support",
        )
        self.service.submit_feedback(sub1)

        after_first = self.service.get_proposal("kensington")
        self.assertEqual(
            after_first.community_aggregate.total_participants,
            initial_participants + 1,
        )
        self.assertEqual(
            after_first.community_aggregate.position_distribution["support"],
            initial_support + 1,
        )

        # 2. Second submission: oppose
        sub2 = ProposalFeedbackSubmissionDTO(
            proposal_id="kensington",
            participant_id="user-dup",
            position="oppose",
            stakeholder_role="resident",
            element_ratings={},
            comment="Changed position to oppose",
        )
        self.service.submit_feedback(sub2)

        after_second = self.service.get_proposal("kensington")
        # Participant count does NOT increment again
        self.assertEqual(
            after_second.community_aggregate.total_participants,
            initial_participants + 1,
        )
        # Support is decremented
        self.assertEqual(
            after_second.community_aggregate.position_distribution["support"],
            initial_support,
        )
        # Oppose is incremented
        self.assertEqual(
            after_second.community_aggregate.position_distribution["oppose"],
            initial_oppose + 1,
        )


if __name__ == "__main__":
    unittest.main()
