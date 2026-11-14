"""Service layer containing business and domain aggregation logic.

Orchestrates domain logic and calls persistence functions to persist data.
"""

import copy
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from pymongo.database import Database
from .condition_grouping import GroupingUnavailable, SuggestedGroup, suggest_groups
from .feedback_analysis import collect_evidence, digest, input_hash

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
    from persistence.persistence import CommentVoteRepository, FeedbackRepository, ProposalRepository, feedback_revision
except ImportError:
    from backend.persistence.persistence import CommentVoteRepository, FeedbackRepository, ProposalRepository, feedback_revision

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
                label="Individual requests / awaiting grouping",
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

    # Keep existing evidence and membership when only ratings/role were edited.
    same_requests = previous_submission is not None and (
        previous_submission.condition == submission.condition
        and previous_submission.comment.strip() == submission.comment.strip()
    )
    if same_requests:
        for cluster in agg.condition_clusters:
            for item in cluster.items:
                if item.participant_id == submission.participant_id:
                    item.concern_coordinates = submission.concern_coordinates
        return agg

    agg.grouping_status = "pending"
    agg.grouping_error = None
    agg.grouping_retry_after = None

    # Replace changed evidence; background analysis will add comment requests.
    retained_requirement = False
    same_requirement = previous_submission is not None and previous_submission.condition and submission.condition and (
        previous_submission.condition.requirement == submission.condition.requirement
        and previous_submission.condition.time_window == submission.condition.time_window
        and previous_submission.condition.location_label == submission.condition.location_label
    )
    if previous_submission is not None:
        for cluster in agg.condition_clusters:
            remaining = []
            for item in cluster.items:
                if item.participant_id != submission.participant_id:
                    remaining.append(item)
                elif same_requirement and item.source == "requirement" and not retained_requirement:
                    retained_requirement = True
                    item.verbatim_quote = submission.comment.strip()
                    item.is_conditional_support = submission.condition.is_conditional_support
                    item.concern_coordinates = submission.concern_coordinates
                    remaining.append(item)
            removed = len(cluster.items) - len(remaining)
            cluster.items = remaining
            cluster.count = max(0, cluster.count - removed)
            agg.total_conditions = max(0, agg.total_conditions - removed)

    # General comments are preserved on the submission, not interpreted as
    # support promises. Only a participant-confirmed requirement counts here.
    if not retained_requirement and submission.condition and submission.condition.requirement.strip():
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
        target = ungrouped_cluster(agg)
        target.count += 1
        target.items.insert(0, condition_item)

    for cluster in list(agg.condition_clusters):
        if cluster.is_suggested and cluster.count < 2:
            target = ungrouped_cluster(agg)
            target.items.extend(cluster.items)
            target.count += cluster.count
            agg.condition_clusters.remove(cluster)
    update_condition_percentages(agg)

    return agg


def ungrouped_cluster(aggregate: ProposalCommunityAggregateDTO) -> ConditionClusterDTO:
    target = next((cluster for cluster in aggregate.condition_clusters if cluster.is_ungrouped), None)
    if target is None:
        target = ConditionClusterDTO(
            id="cluster-ungrouped", label="Ungrouped / individual requirements",
            icon="message", is_ungrouped=True,
        )
        aggregate.condition_clusters.append(target)
    return target


def update_condition_percentages(aggregate: ProposalCommunityAggregateDTO) -> None:
    for cluster in aggregate.condition_clusters:
        cluster.percentage = (
            round(cluster.count / aggregate.total_conditions * 100) if aggregate.total_conditions else 0
        )


class GroupingConflict(Exception):
    """The displayed condition groups changed before an update could be saved."""


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
        votes_repo: Optional[CommentVoteRepository] = None,
    ):
        if proposals_repo is not None and feedback_repo is not None:
            self.proposals = proposals_repo
            self.feedback = feedback_repo
            self.votes = votes_repo if votes_repo is not None else (
                CommentVoteRepository(db) if db is not None else None
            )
        else:
            self.proposals = ProposalRepository(db)
            self.feedback = FeedbackRepository(db)
            self.votes = votes_repo if votes_repo is not None else CommentVoteRepository(db)
        self.analysis_cache = self.feedback.db["feedback_request_analysis"]

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

        aggregate = self.apply_saved_feedback(saved_sub, previous_sub)
        latest = self.feedback.get_by_participant(saved_sub.proposal_id, saved_sub.participant_id)
        return latest or saved_sub, aggregate

    def apply_saved_feedback(self, saved_sub, previous_sub):
        """Idempotent completion also recovers a save interrupted before aggregation."""
        revision = feedback_revision(saved_sub)

        # Retry if regrouping or another submission updated the aggregate first.
        while True:
            record = self.proposals.get_by_id(saved_sub.proposal_id)
            if record is None:
                raise ValueError(f"Proposal '{saved_sub.proposal_id}' not found.")
            current = to_display_proposal(record).community_aggregate or create_empty_aggregate()
            latest = self.feedback.get_by_participant(saved_sub.proposal_id, saved_sub.participant_id)
            if latest is None or feedback_revision(latest) != revision:
                # A newer edit superseded this response before aggregation.
                return current
            if current.applied_feedback_revisions.get(saved_sub.participant_id) == revision:
                self.feedback.mark_aggregated(saved_sub)
                return current
            applied = current.applied_feedback.get(saved_sub.participant_id)
            if applied is not None:
                previous = ProposalFeedbackSubmissionDTO.model_validate(applied)
            else:
                # Legacy responses have no applied snapshot yet. The raw record
                # remembers the last committed response across interrupted saves.
                previous = self.feedback.previous_aggregate_submission(saved_sub, previous_sub)
            updated = apply_feedback_to_aggregate(current, saved_sub, previous_submission=previous)
            updated.applied_feedback_revisions[saved_sub.participant_id] = revision
            updated.applied_feedback[saved_sub.participant_id] = saved_sub.model_dump(mode="json")
            if self.proposals.replace_aggregate_if_current(record, updated):
                self.feedback.mark_aggregated(saved_sub)
                return updated

    def recover_feedback_aggregates(self, proposal_id):
        for submission, previous in self.feedback.get_pending_aggregates(proposal_id):
            self.apply_saved_feedback(submission, previous)

    def queue_condition_groups(self, proposal_id: str) -> ProposalCommunityAggregateDTO:
        record = self.proposals.get_by_id(proposal_id)
        if record is None:
            raise ValueError("Proposal was not found.")
        aggregate = to_display_proposal(record).community_aggregate or create_empty_aggregate()
        aggregate.grouping_status = "pending"
        aggregate.grouping_error = None
        aggregate.grouping_retry_after = None
        return self.save_condition_groups(record, aggregate)

    def group_conditions(self, proposal_id: str, heartbeat=lambda: None) -> ProposalCommunityAggregateDTO:
        record = self.proposals.get_by_id(proposal_id)
        if record is None:
            raise ValueError("Proposal was not found.")
        aggregate = to_display_proposal(record).community_aggregate or create_empty_aggregate()
        submissions = self.feedback.get_for_analysis(proposal_id)
        if submissions is None:
            raise GroupingConflict("Feedback is being saved. Grouping will retry shortly.")
        fingerprint = input_hash(submissions, aggregate)
        if submissions:
            evidence = collect_evidence(submissions, aggregate, self.analysis_cache, heartbeat)
            participants = {submission.participant_id for submission in submissions}
            # Replace only evidence backed by current submissions. Preserve legacy
            # fixture evidence/counts that cannot be reconstructed from raw feedback.
            for cluster in aggregate.condition_clusters:
                remaining = [item for item in cluster.items if item.participant_id not in participants]
                cluster.count -= len(cluster.items) - len(remaining)
                cluster.items = remaining
            target = ungrouped_cluster(aggregate)
            target.items.extend(evidence)
            target.count += len(evidence)
            aggregate.total_conditions = sum(cluster.count for cluster in aggregate.condition_clusters)
        sources = [
            cluster for cluster in aggregate.condition_clusters
            if cluster.is_ungrouped or cluster.is_suggested
        ]
        items = [
            item for cluster in sources for item in cluster.items
            if item.participant_id and item.extracted_requirement.strip() and not item.grouping_rejected
        ]
        heartbeat()
        suggestions = suggest_groups([
            {"number": number, "requirement": item.extracted_requirement,
             "place": item.location_label, "time": item.time_window}
            for number, item in enumerate(items)
        ]) if len(items) >= 2 else []
        target = ungrouped_cluster(aggregate)
        for source in sources:
            if source.is_suggested:
                target.items.extend(source.items)
                target.count += source.count
                aggregate.condition_clusters.remove(source)
        sources = [cluster for cluster in aggregate.condition_clusters if cluster.is_ungrouped]
        # Exact equivalents should never remain unmatched merely because the
        # model omitted them. Context is part of the key, so opposites stay apart.
        claimed = {member for group in suggestions for member in group.members}
        exact = {}
        for number, item in enumerate(items):
            if number not in claimed:
                key = (item.extracted_requirement.strip().casefold(),
                       (item.time_window or "").strip().casefold(),
                       (item.location_label or "").strip().casefold())
                exact.setdefault(key, []).append(number)
        suggestions = [*suggestions, *(
            SuggestedGroup(label=items[members[0]].extracted_requirement[:100], members=members)
            for members in exact.values() if len(members) > 1
        )]
        used = set()
        for group in suggestions:
            members = set(group.members)
            if (
                not group.label.strip()
                or len(members) < 2
                or len(members) != len(group.members)
                or used.intersection(members)
                or any(index < 0 or index >= len(items) for index in members)
            ):
                raise GroupingUnavailable("AI grouping returned invalid suggestions.")
            used.update(members)
            all_items = [items[index] for index in sorted(members)]
            by_voice = {}
            for item in sorted(all_items, key=lambda item: item.source != "requirement"):
                by_voice.setdefault(item.participant_id or item.id, item)
            grouped_items = list(by_voice.values())
            # Semantic compatibility (including equivalent time/place wording) is
            # assessed by the model, rather than rejecting unequal strings.
            ids = {item.id for item in all_items}
            for source in sources:
                remaining = [item for item in source.items if item.id not in ids]
                source.count -= len(source.items) - len(remaining)
                source.items = remaining
            if len(grouped_items) >= 2:
                aggregate.condition_clusters.append(ConditionClusterDTO(
                    id="suggested-" + digest(sorted(item.id for item in grouped_items))[:24],
                    label=group.label.strip(), icon="message", count=len(grouped_items),
                    is_suggested=True, items=grouped_items,
                ))
            else:
                target.items.extend(grouped_items)
                target.count += len(grouped_items)

        aggregate.condition_clusters = [c for c in aggregate.condition_clusters if c.count or c.is_ungrouped]
        aggregate.total_conditions = sum(c.count for c in aggregate.condition_clusters)
        aggregate.grouping_status = "ready"
        aggregate.grouping_error = None
        aggregate.grouping_retry_after = None
        aggregate.grouping_input_hash = fingerprint
        aggregate.grouping_updated_at = datetime.now(timezone.utc).isoformat()
        return self.save_condition_groups(record, aggregate)

    def reject_condition_group(
        self, proposal_id: str, condition_id: str, participant_id: str
    ) -> ProposalCommunityAggregateDTO:
        record = self.proposals.get_by_id(proposal_id)
        if record is None:
            raise ValueError("Proposal was not found.")
        aggregate = to_display_proposal(record).community_aggregate
        if aggregate is not None:
            for cluster in aggregate.condition_clusters:
                item = next((item for item in cluster.items
                             if item.id == condition_id and item.participant_id == participant_id), None)
                if item is None:
                    continue
                if cluster.is_ungrouped and item.grouping_rejected:
                    return aggregate
                if not cluster.is_suggested:
                    break
                item.grouping_rejected = True
                aggregate.grouping_status = "pending"
                aggregate.grouping_retry_after = None
                cluster.items.remove(item)
                cluster.count -= 1
                target = ungrouped_cluster(aggregate)
                target.items.insert(0, item)
                target.count += 1
                if cluster.count < 2:
                    target.items.extend(cluster.items)
                    target.count += cluster.count
                    aggregate.condition_clusters.remove(cluster)
                return self.save_condition_groups(record, aggregate)
        raise ValueError("Your requirement was not found in a suggested group.")

    def save_condition_groups(
        self, record: dict, aggregate: ProposalCommunityAggregateDTO
    ) -> ProposalCommunityAggregateDTO:
        update_condition_percentages(aggregate)
        aggregate.last_updated = datetime.now(timezone.utc).isoformat()
        if not self.proposals.replace_aggregate_if_current(record, aggregate):
            raise GroupingConflict("Feedback changed. Refresh the groups and try again.")
        return aggregate

    def get_feedback_submissions(
        self, proposal_id: str, viewer_id: Optional[str] = None
    ) -> List[ProposalFeedbackSubmissionDTO]:
        """Fetch feedback submissions, each annotated with comment vote tallies.

        ``viewer_id`` is the requesting user, when logged in, so each comment
        also reports that viewer's own vote (``my_vote``).
        """
        submissions = self.feedback.get_by_proposal(proposal_id)
        if self.votes is None:
            return submissions
        tallies = self.votes.tallies_by_proposal(proposal_id)
        viewer_votes = self.votes.votes_by_voter(proposal_id, viewer_id) if viewer_id else {}
        for submission in submissions:
            tally = tallies.get(submission.participant_id, {})
            submission.upvotes = tally.get("up", 0)
            submission.downvotes = tally.get("down", 0)
            submission.score = submission.upvotes - submission.downvotes
            submission.my_vote = viewer_votes.get(submission.participant_id, 0)
        return submissions

    def vote_on_comment(
        self, proposal_id: str, comment_owner: str, voter: str, value: int
    ) -> ProposalFeedbackSubmissionDTO:
        """Record a viewer's vote on a comment and return the updated comment.

        Voting on one's own comment is rejected. The comment must exist.
        """
        if self.votes is None:
            raise GroupingUnavailable("Comment voting is unavailable.")
        if comment_owner == voter:
            raise ValueError("You cannot vote on your own comment.")
        comment = self.feedback.get_by_participant(proposal_id, comment_owner)
        if comment is None:
            raise ValueError("Comment was not found.")
        self.votes.set_vote(proposal_id, comment_owner, voter, value)
        tally = self.votes.tallies_by_proposal(proposal_id).get(comment_owner, {})
        comment.upvotes = tally.get("up", 0)
        comment.downvotes = tally.get("down", 0)
        comment.score = comment.upvotes - comment.downvotes
        comment.my_vote = value
        return comment

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
