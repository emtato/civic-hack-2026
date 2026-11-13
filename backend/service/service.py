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
    from proposals_DTO import (
        ConditionClusterDTO,
        ConditionItemDTO,
        Proposal,
        ProposalCommunityAggregateDTO,
        ProposalFeedbackSubmissionDTO,
        ProposalSpecificElementDTO,
    )
except ImportError:
    from backend.proposals_DTO import (
        ConditionClusterDTO,
        ConditionItemDTO,
        Proposal,
        ProposalCommunityAggregateDTO,
        ProposalFeedbackSubmissionDTO,
        ProposalSpecificElementDTO,
    )

try:
    from persistence.persistence import FeedbackRepository, ProposalRepository
except ImportError:
    from backend.persistence.persistence import FeedbackRepository, ProposalRepository

logger = logging.getLogger("proviso.service")

try:
    from imported_data_dto import Proposal as ImportedProposal
except ImportError:
    from backend.imported_data_dto import Proposal as ImportedProposal


TOPIC_LABELS = {
    "planning": "Planning", "heritage": "Heritage", "transportation": "Transportation",
    "licensing": "Licensing", "financial": "Financial", "property_sales": "City property",
}


def to_display_proposal(record: dict) -> Proposal:
    """Project a rich stored record into the public frontend DTO, without writes."""
    if "source_notices" not in record:
        # Explicitly saved display DTOs/test fixtures remain readable. They are
        # never an automatic fallback to the old MongoDB collection.
        data = {**record, **record.get("display_overrides", {})}
        data.setdefault("id", str(record.get("_id", "")))
        return Proposal.model_validate(data)
    imported = ImportedProposal.model_validate({
        key: value for key, value in record.items() if key in ImportedProposal.model_fields
    })
    latest = imported.source_notices[-1] if imported.source_notices else None
    point = imported.map_point
    coordinates = [point.coordinates[1], point.coordinates[0]] if point else None
    aggregate = (ProposalCommunityAggregateDTO.model_validate(record["community_aggregate"])
                 if record.get("community_aggregate") else create_empty_aggregate())
    known_elements = {element.id for element in aggregate.proposal_specific}
    for feature in imported.features or []:
        if feature.id not in known_elements:
            aggregate.proposal_specific.append(ProposalSpecificElementDTO(
                id=feature.id, title=feature.label,
                prompt=feature.question or f"How do you feel about {feature.label.lower()}?",
                category=imported.category,
                distribution={"oppose": 0, "neutral": 0, "support": 0, "unsure": 0},
            ))
    neighbourhood = imported.neighbourhood
    if not neighbourhood:
        neighbourhood = ("Toronto-wide" if imported.geographic_scope == "citywide"
                         else next(iter(imported.ward_labels), None)
                         or next((a.street_address for a in imported.addresses if a.street_address), None)
                         or "Location not specified")
    status = imported.status.replace("_", " ").capitalize()
    if imported.review.state != "reviewed":
        status = f"{status} (archived notice)"
    data = {
        "id": imported.id, "title": imported.title, "neighbourhood": neighbourhood,
        "topic": TOPIC_LABELS[imported.category], "status": status,
        "coordinates": coordinates, "summary": imported.summary or "Summary not available yet.",
        "changes": [f.proposed_change or f.description or f.label for f in imported.features or []],
        "source": latest.url if latest else "", "shape": [],
        "community_aggregate": aggregate,
    }
    # Display edits have their own namespace and cannot overwrite source facts.
    data.update(record.get("display_overrides", {}))
    data["community_aggregate"] = aggregate
    return Proposal.model_validate(data)


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

    # Replace the participant's previous condition evidence on every edit.
    if previous_submission is not None:
        for cluster in agg.condition_clusters:
            remaining = [item for item in cluster.items if item.participant_id != submission.participant_id]
            removed = len(cluster.items) - len(remaining)
            cluster.items = remaining
            cluster.count = max(0, cluster.count - removed)
            agg.total_conditions = max(0, agg.total_conditions - removed)

    # General comments are preserved on the submission, not interpreted as
    # support promises. Only a participant-confirmed requirement counts here.
    if submission.condition and submission.condition.requirement.strip():
        condition = submission.condition
        agg.total_conditions += 1
        condition_item = ConditionItemDTO(
            id=f"cond-{uuid.uuid4().hex[:8]}",
            participant_id=submission.participant_id,
            verbatim_quote=submission.comment.strip(),
            extracted_requirement=condition.requirement.strip(),
            is_conditional_support=condition.is_conditional_support,
            time_window=condition.time_window,
            location_label=condition.location_label,
            concern_coordinates=submission.concern_coordinates,
            submitted_at=now_iso,
        )

        # A shared topic is not proof of equivalent requirements. Keep new
        # conditions ungrouped until the actual request has been reviewed.
        target = next((cluster for cluster in agg.condition_clusters if cluster.is_ungrouped), None)
        if target is None:
            target = ConditionClusterDTO(
                id="cluster-ungrouped", label="Ungrouped / individual requirements",
                icon="message", count=0, is_ungrouped=True, items=[],
            )
            agg.condition_clusters.append(target)
        target.count += 1
        target.items.insert(0, condition_item)

    for cluster in agg.condition_clusters:
        cluster.percentage = round(cluster.count / agg.total_conditions * 100) if agg.total_conditions else 0

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
        return [to_display_proposal(record) for record in self.proposals.get_all()]

    def get_proposal(self, proposal_id: str) -> Optional[Proposal]:
        """Fetch a single proposal from persistence."""
        record = self.proposals.get_by_id(proposal_id)
        return to_display_proposal(record) if record is not None else None

    def save_proposal(self, proposal: Proposal) -> Proposal:
        """Save a proposal to persistence."""
        data = proposal.model_dump(mode="python")
        aggregate = data.pop("community_aggregate", None)
        record = {"id": proposal.id, "display_overrides": data}
        if aggregate is not None:
            record["community_aggregate"] = aggregate
        return to_display_proposal(self.proposals.save(record))

    def seed_initial_proposals(self, force: bool = False) -> int:
        """Seed initial proposal dataset via persistence."""
        return self.proposals.seed_if_empty(force=force)

    def submit_feedback(
        self, submission: ProposalFeedbackSubmissionDTO
    ) -> Tuple[ProposalFeedbackSubmissionDTO, ProposalCommunityAggregateDTO]:
        """Business workflow: validate, persist submission, calculate aggregate, and persist updated aggregate."""
        proposal = self.get_proposal(submission.proposal_id)
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
        proposal = self.get_proposal(proposal_id)
        if proposal is None:
            return None
        return proposal.community_aggregate
