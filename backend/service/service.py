"""Service layer containing business and domain aggregation logic.

Orchestrates domain logic and calls persistence functions to persist data.
"""

import copy
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from pymongo.database import Database

try:
    from models import (
        ConditionClusterDTO,
        ConditionItemDTO,
        Proposal,
        ProposalCommunityAggregateDTO,
        ProposalFeedbackSubmissionDTO,
    )
except ImportError:
    from backend.models import (
        ConditionClusterDTO,
        ConditionItemDTO,
        Proposal,
        ProposalCommunityAggregateDTO,
        ProposalFeedbackSubmissionDTO,
    )

try:
    from persistence.persistence import FeedbackRepository, ProposalRepository
except ImportError:
    from backend.persistence.persistence import FeedbackRepository, ProposalRepository

logger = logging.getLogger("civic.service")


# ============================================================================
# Pure Domain & Aggregation Logic
# ============================================================================

def create_empty_aggregate() -> ProposalCommunityAggregateDTO:
    """Create an empty aggregate DTO template for a new proposal."""
    return ProposalCommunityAggregateDTO(
        total_participants=0,
        total_conditions=0,
        last_updated=datetime.now(timezone.utc).isoformat(),
        position_distribution={
            "strongly_oppose": 0,
            "oppose": 0,
            "neutral": 0,
            "support": 0,
            "strongly_support": 0,
            "unsure": 0,
        },
        stakeholder_distribution={
            "resident": 0,
            "business": 0,
            "commuter": 0,
            "visitor": 0,
            "citywide": 0,
        },
        proposal_specific=[],
        condition_clusters=[
            ConditionClusterDTO(
                id="cluster-ungrouped",
                label="Ungrouped / Unique Access Conditions",
                icon="help",
                count=0,
                is_ungrouped=True,
                items=[],
            )
        ],
    )


def apply_feedback_to_aggregate(
    aggregate: ProposalCommunityAggregateDTO,
    submission: ProposalFeedbackSubmissionDTO,
    previous_submission: Optional[ProposalFeedbackSubmissionDTO] = None,
) -> ProposalCommunityAggregateDTO:
    """Business logic: applies a feedback submission to an existing aggregate.

    Handles both brand-new submissions and updates to an existing participant's submission.
    """
    agg = copy.deepcopy(aggregate)
    now_iso = submission.submitted_at or datetime.now(timezone.utc).isoformat()
    agg.last_updated = now_iso

    # If updating an existing submission from the same participant:
    if previous_submission is not None:
        # Decrement previous position
        old_pos = previous_submission.position
        if old_pos in agg.position_distribution:
            agg.position_distribution[old_pos] = max(
                0, agg.position_distribution[old_pos] - 1
            )
        # Increment new position
        new_pos = submission.position
        agg.position_distribution[new_pos] = agg.position_distribution.get(new_pos, 0) + 1

        # Decrement previous stakeholder role
        old_role = previous_submission.stakeholder_role
        if old_role in agg.stakeholder_distribution:
            agg.stakeholder_distribution[old_role] = max(
                0, agg.stakeholder_distribution[old_role] - 1
            )
        # Increment new stakeholder role
        new_role = submission.stakeholder_role
        agg.stakeholder_distribution[new_role] = (
            agg.stakeholder_distribution.get(new_role, 0) + 1
        )

        # Update element ratings
        for elem in agg.proposal_specific:
            old_rating = previous_submission.element_ratings.get(elem.id)
            new_rating = submission.element_ratings.get(elem.id)
            if old_rating and old_rating in elem.distribution:
                elem.distribution[old_rating] = max(0, elem.distribution[old_rating] - 1)
                elem.total_responses = max(0, elem.total_responses - 1)
            if new_rating:
                elem.distribution[new_rating] = elem.distribution.get(new_rating, 0) + 1
                elem.total_responses += 1

    else:
        # Brand-new participant
        agg.total_participants += 1

        # Increment position count
        pos = submission.position
        agg.position_distribution[pos] = agg.position_distribution.get(pos, 0) + 1

        # Increment stakeholder role count
        role = submission.stakeholder_role
        agg.stakeholder_distribution[role] = agg.stakeholder_distribution.get(role, 0) + 1

        # Update proposal-specific element distributions
        for elem in agg.proposal_specific:
            rating = submission.element_ratings.get(elem.id)
            if rating:
                elem.distribution[rating] = elem.distribution.get(rating, 0) + 1
                elem.total_responses += 1

    # Condition & comment handling
    has_condition = submission.condition is not None
    has_comment = bool(submission.comment and submission.comment.strip())

    if has_condition or has_comment:
        agg.total_conditions += 1

        cond_item_id = f"cond-{uuid.uuid4().hex[:8]}"
        req_text = ""
        is_cond = submission.position in ("support", "strongly_support")
        time_win = None
        loc_label = None
        feature_id = None

        if submission.condition:
            req_text = submission.condition.requirement or submission.comment.strip()
            is_cond = submission.condition.is_conditional_support
            time_win = submission.condition.time_window
            loc_label = submission.condition.location_label
            feature_id = submission.condition.feature_id
        else:
            req_text = submission.comment.strip()

        condition_item = ConditionItemDTO(
            id=cond_item_id,
            participant_id=submission.participant_id,
            verbatim_quote=submission.comment.strip(),
            extracted_requirement=req_text,
            is_conditional_support=is_cond,
            time_window=time_win,
            location_label=loc_label,
            concern_coordinates=submission.concern_coordinates,
            submitted_at=now_iso,
        )

        # Match cluster by feature_id, category, or fallback to ungrouped
        target_cluster: Optional[ConditionClusterDTO] = None
        if feature_id:
            for cluster in agg.condition_clusters:
                if feature_id in cluster.id or (cluster.category and feature_id in cluster.category):
                    target_cluster = cluster
                    break

        if target_cluster is None:
            # Look for ungrouped cluster
            for cluster in agg.condition_clusters:
                if cluster.is_ungrouped:
                    target_cluster = cluster
                    break

        if target_cluster is None and agg.condition_clusters:
            target_cluster = agg.condition_clusters[-1]

        if target_cluster is None:
            target_cluster = ConditionClusterDTO(
                id="cluster-ungrouped",
                label="Ungrouped / Unique Access Conditions",
                icon="help",
                count=0,
                is_ungrouped=True,
                items=[],
            )
            agg.condition_clusters.append(target_cluster)

        target_cluster.count += 1
        target_cluster.items.insert(0, condition_item)

        # Recalculate percentages across clusters
        if agg.total_conditions > 0:
            for cluster in agg.condition_clusters:
                cluster.percentage = round((cluster.count / agg.total_conditions) * 100)

    return agg


# ============================================================================
# Service Coordinator: Coordinates domain logic with persistence calls
# ============================================================================

class FeedbackService:
    """Service layer that executes business logic and delegates storage to persistence repositories."""

    def __init__(
        self,
        db: Optional[Database] = None,
        proposals_repo: Optional[ProposalRepository] = None,
        feedback_repo: Optional[FeedbackRepository] = None,
    ):
        if proposals_repo is not None and feedback_repo is not None:
            self.proposals = proposals_repo
            self.feedback = feedback_repo
        else:
            self.proposals = ProposalRepository(db)
            self.feedback = FeedbackRepository(db)

    def get_proposals(self) -> List[Proposal]:
        """Fetch all proposals from persistence."""
        return self.proposals.get_all()

    def get_proposal(self, proposal_id: str) -> Optional[Proposal]:
        """Fetch a single proposal from persistence."""
        return self.proposals.get_by_id(proposal_id)

    def save_proposal(self, proposal: Proposal) -> Proposal:
        """Save a proposal to persistence."""
        return self.proposals.save(proposal)

    def seed_initial_proposals(self, force: bool = False) -> int:
        """Seed initial proposal dataset via persistence."""
        return self.proposals.seed_if_empty(force=force)

    def submit_feedback(
        self, submission: ProposalFeedbackSubmissionDTO
    ) -> Tuple[ProposalFeedbackSubmissionDTO, ProposalCommunityAggregateDTO]:
        """Business workflow: validate, persist submission, calculate aggregate, and persist updated aggregate."""
        proposal = self.proposals.get_by_id(submission.proposal_id)
        if proposal is None:
            raise ValueError(f"Proposal '{submission.proposal_id}' not found.")

        # 1. Call persistence to save the raw submission
        saved_sub, is_new, previous_sub = self.feedback.save_submission(submission)

        # 2. Retrieve base aggregate or build an empty aggregate
        current_agg = proposal.community_aggregate or create_empty_aggregate()

        # 3. Execute domain business logic to compute the new aggregate
        updated_agg = apply_feedback_to_aggregate(
            current_agg, saved_sub, previous_submission=previous_sub
        )

        # 4. Call persistence to save the updated aggregate on the proposal document
        self.proposals.update_aggregate(submission.proposal_id, updated_agg)

        return saved_sub, updated_agg

    def get_feedback_submissions(
        self, proposal_id: str
    ) -> List[ProposalFeedbackSubmissionDTO]:
        """Fetch feedback submissions from persistence."""
        return self.feedback.get_by_proposal(proposal_id)

    def get_participant_feedback(
        self, proposal_id: str, participant_id: str
    ) -> Optional[ProposalFeedbackSubmissionDTO]:
        """Fetch participant feedback from persistence."""
        return self.feedback.get_by_participant(proposal_id, participant_id)

    def get_aggregate(
        self, proposal_id: str
    ) -> Optional[ProposalCommunityAggregateDTO]:
        """Fetch proposal aggregate from persistence."""
        proposal = self.proposals.get_by_id(proposal_id)
        if proposal is None:
            return None
        return proposal.community_aggregate
