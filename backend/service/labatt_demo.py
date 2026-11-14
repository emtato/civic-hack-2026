"""Two prepared feedback rounds and private copies of the returning-resident journey."""

import hashlib
import json
from dataclasses import dataclass
from datetime import date, datetime, timezone
from functools import cache
from pathlib import Path
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from proposals_DTO import (
    ConditionClusterDTO,
    ConditionItemDTO,
    PositionStance,
    ProposalCommunityAggregateDTO,
    ProposalFeedbackSubmissionDTO,
    ProposalSpecificElementDTO,
)
from service.service import add_response_counts, create_empty_aggregate, ungrouped_cluster, update_condition_percentages

PROPOSAL_ID = "toronto-labatt-river-towers"
RESIDENT_ID = "demo-resident"
COLLECTION = "labatt_demo_sessions"
FIXTURE_PATH = Path(__file__).resolve().parents[1] / "data" / "labatt-demo.json"


class DemoChange(BaseModel):
    feature_id: str
    title: str
    summary: str
    before: str
    after: str


class DemoVersion(BaseModel):
    id: str
    label: str
    date: date
    summary: str
    arrangements: list[str]
    features: list[ProposalSpecificElementDTO]
    changes: list[DemoChange] = Field(default_factory=list)


class ReviewTotals(BaseModel):
    unreviewed: int
    reconfirmed: int
    revised: int


class DemoRound(DemoVersion):
    aggregate: ProposalCommunityAggregateDTO
    comments: list[ProposalFeedbackSubmissionDTO]
    requirement_assessments: dict[str, "RequirementAssessment"]


class RequirementAssessment(BaseModel):
    status: Literal["potentially addressed", "unresolved", "uncertain"]
    feature_id: str | None = None
    explanation: str
    version_id: str | None = None
    passage: str | None = None


class MatchedPositions(BaseModel):
    participants: int
    earlier: dict[PositionStance, int]
    current: dict[PositionStance, int]


class DemoJourney(BaseModel):
    revision: str | None
    current_version_id: str
    versions: list[DemoRound]
    previous_response: ProposalFeedbackSubmissionDTO
    current_response: ProposalFeedbackSubmissionDTO | None
    participant_action: Literal["not reviewed", "reconfirmed", "revised"]
    requirement_assessment: RequirementAssessment | None
    review_totals: ReviewTotals
    grouping_origin: Literal["prepared"]
    distinct_participants: int
    current_only: int
    matched_positions: MatchedPositions


@dataclass(frozen=True)
class DemoResponse:
    submission: ProposalFeedbackSubmissionDTO
    group_id: str | None = None
    assessment: RequirementAssessment | None = None

    @property
    def evidence_id(self) -> str:
        return f"{self.submission.version_id}-{self.submission.participant_id}"


@dataclass(frozen=True)
class DemoSeed:
    earlier: DemoVersion
    current: DemoVersion
    responses: dict[str, list[DemoResponse]]
    groups: dict[str, ConditionClusterDTO]
    grouping_origin: Literal["prepared"]


def load_seed(path: Path) -> DemoSeed:
    fixture = json.loads(path.read_text(encoding="utf-8"))
    earlier, current = (DemoVersion.model_validate(row) for row in fixture["versions"])
    if fixture["grouping_origin"] != "prepared" or earlier.id == current.id or earlier.date >= current.date:
        raise ValueError("Expected two ordered demo rounds with prepared groups.")
    groups = {key: ConditionClusterDTO(id=key, **group) for key, group in fixture["groups"].items()}
    feature_ids = [feature.id for feature in earlier.features]
    changes = {change.feature_id: change for change in current.changes}
    if (
        len(set(feature_ids)) != len(feature_ids)
        or feature_ids != [feature.id for feature in current.features]
        or set(changes) != set(feature_ids)
        or len(current.changes) != len(changes)
        or any(change.before not in earlier.arrangements or change.after not in current.arrangements
               for change in changes.values())
    ):
        raise ValueError("Demo features and comparison passages must match both rounds.")

    responses: dict[str, list[DemoResponse]] = {}
    roles = {}
    for version, fixture_version in zip((earlier, current), fixture["versions"]):
        seen = set()
        responses[version.id] = []
        for row in fixture_version["responses"]:
            submission = ProposalFeedbackSubmissionDTO.model_validate({
                **row, "proposal_id": PROPOSAL_ID, "version_id": version.id,
                "submitted_at": f"{version.date}T12:00:00+00:00",
                "score": row.get("upvotes", 0) - row.get("downvotes", 0),
            })
            participant = submission.participant_id
            if participant in seen or roles.setdefault(participant, submission.stakeholder_role) != submission.stakeholder_role:
                raise ValueError(f"Duplicate response or inconsistent connection for {participant}.")
            seen.add(participant)
            condition = submission.condition
            group_id = row.get("group")
            if submission.element_ratings.keys() - changes.keys() or (
                condition and condition.feature_id and condition.feature_id not in changes
            ):
                raise ValueError(f"Unknown feature for {participant}.")
            if group_id and (group_id not in groups or not condition or not submission.comment.strip()):
                raise ValueError(f"Incomplete group evidence for {participant}.")
            assessment = None
            if "assessment" in row:
                change = changes.get(condition.feature_id) if condition else None
                if version.id != earlier.id or change is None:
                    raise ValueError(f"An assessment needs an earlier requirement and a passage for {participant}.")
                assessment = RequirementAssessment.model_validate({
                    **row["assessment"], "feature_id": change.feature_id,
                    "version_id": current.id, "passage": change.after,
                })
            responses[version.id].append(DemoResponse(submission, group_id, assessment))
        if (RESIDENT_ID in seen) != (version.id == earlier.id):
            raise ValueError("The returning resident must have one earlier response and no seeded current response.")
    return DemoSeed(earlier, current, responses, groups, "prepared")


@cache
def bundled_seed() -> DemoSeed:
    return load_seed(FIXTURE_PATH)


def response_action(previous: ProposalFeedbackSubmissionDTO, current: ProposalFeedbackSubmissionDTO) -> Literal["reconfirmed", "revised"]:
    answers = {"position", "stakeholder_role", "element_ratings", "comment", "condition", "concern_coordinates"}
    return "reconfirmed" if previous.model_dump(include=answers) == current.model_dump(include=answers) else "revised"


def build_round(
    version: DemoVersion, responses: list[DemoResponse], group_definitions: dict[str, ConditionClusterDTO],
) -> DemoRound:
    aggregate = create_empty_aggregate()
    aggregate.grouping_status = "ready"
    aggregate.last_updated = max((row.submission.submitted_at or "" for row in responses), default=version.date.isoformat())
    aggregate.proposal_specific = [
        feature.model_copy(update={"distribution": {}, "total_responses": 0}) for feature in version.features
    ]
    groups = {}
    for row in responses:
        response, group_id = row.submission, row.group_id
        add_response_counts(aggregate, response)
        condition = response.condition
        if condition is None:
            continue
        if group_id:
            if group_id not in groups:
                groups[group_id] = group_definitions[group_id].model_copy(deep=True)
            group = groups[group_id]
        else:
            group = ungrouped_cluster(aggregate)
        aggregate.total_conditions += 1
        group.count += 1
        group.items.append(ConditionItemDTO(
            id=row.evidence_id,
            participant_id=response.participant_id,
            verbatim_quote=response.comment,
            extracted_requirement=condition.requirement,
            is_conditional_support=condition.is_conditional_support,
            time_window=condition.time_window,
            location_label=condition.location_label,
            concern_coordinates=response.concern_coordinates,
            submitted_at=response.submitted_at or version.date.isoformat(),
        ))
    aggregate.condition_clusters.extend(groups.values())
    update_condition_percentages(aggregate)
    return DemoRound(
        id=version.id, date=version.date, label=version.label, summary=version.summary,
        arrangements=version.arrangements, features=version.features, changes=version.changes,
        aggregate=aggregate, comments=[row.submission for row in responses if row.submission.comment.strip()],
        requirement_assessments={row.evidence_id: row.assessment for row in responses if row.assessment},
    )


def position_counts(submissions: list[ProposalFeedbackSubmissionDTO]) -> dict[PositionStance, int]:
    aggregate = create_empty_aggregate()
    for submission in submissions:
        add_response_counts(aggregate, submission)
    return aggregate.position_distribution


def build_journey(seed: DemoSeed, document: dict) -> DemoJourney:
    current = ProposalFeedbackSubmissionDTO.model_validate(document["response"]) if document.get("response") else None
    historical_rows = seed.responses[seed.earlier.id]
    current_rows = list(seed.responses[seed.current.id])
    if current:
        current_rows.append(DemoResponse(current))
    past = {row.submission.participant_id: row for row in historical_rows}
    now = {row.submission.participant_id: row.submission for row in current_rows}
    matched = [participant for participant in now if participant in past]
    actions = [response_action(past[participant].submission, now[participant]) for participant in matched]
    previous = past[RESIDENT_ID]
    return DemoJourney(
        revision=document.get("revision"), current_version_id=seed.current.id,
        versions=[build_round(seed.earlier, historical_rows, seed.groups),
                  build_round(seed.current, current_rows, seed.groups)],
        previous_response=previous.submission, current_response=current,
        participant_action=response_action(previous.submission, current) if current else "not reviewed",
        requirement_assessment=previous.assessment,
        review_totals=ReviewTotals(
            unreviewed=len(past.keys() - now.keys()),
            reconfirmed=actions.count("reconfirmed"), revised=actions.count("revised"),
        ),
        grouping_origin=seed.grouping_origin,
        distinct_participants=len(past.keys() | now.keys()),
        current_only=len(now.keys() - past.keys()),
        matched_positions=MatchedPositions(
            participants=len(matched),
            earlier=position_counts([past[participant].submission for participant in matched]),
            current=position_counts([now[participant] for participant in matched]),
        ),
    )


class DemoConflict(Exception):
    """A later save or reset has already changed this session."""


class LabattDemo:
    def __init__(self, collection, session_token: str):
        self.collection = collection
        self.session_key = hashlib.sha256(session_token.encode("ascii")).hexdigest()
        self.seed = bundled_seed()

    def read(self) -> DemoJourney:
        return build_journey(self.seed, self.collection.find_one({"_id": self.session_key}) or {})

    def save(self, revision: str | None, submission: ProposalFeedbackSubmissionDTO) -> DemoJourney:
        current = self.seed.current
        feature_ids = {feature.id for feature in current.features}
        if submission.proposal_id != PROPOSAL_ID or submission.version_id != current.id:
            raise ValueError("Only the current Labatt demo version accepts responses.")
        if (submission.element_ratings.keys() - feature_ids or
                (submission.condition and submission.condition.feature_id and submission.condition.feature_id not in feature_ids)):
            raise ValueError("Use the feature questions from the current version.")
        # Identity, timestamps and vote tallies are server-managed in this namespace.
        response = ProposalFeedbackSubmissionDTO(
            proposal_id=PROPOSAL_ID, version_id=current.id, participant_id=RESIDENT_ID,
            position=submission.position, stakeholder_role=submission.stakeholder_role,
            element_ratings=submission.element_ratings, comment=submission.comment,
            condition=submission.condition, submitted_at=datetime.now(timezone.utc).isoformat(),
        )
        return self._write(revision, response)

    def reset(self, revision: str | None) -> DemoJourney:
        return self._write(revision, None)

    def _write(self, revision: str | None, response: ProposalFeedbackSubmissionDTO | None) -> DemoJourney:
        # Keep the revision on reset so requests prepared before the reset cannot restore a response.
        document = {
            "_id": self.session_key, "revision": uuid4().hex,
            "response": response.model_dump() if response else None,
        }
        journey = build_journey(self.seed, document)
        try:
            result = self.collection.replace_one(
                {"_id": self.session_key, "revision": revision}, document, upsert=revision is None,
            )
        except DuplicateKeyError as exc:
            raise DemoConflict from exc
        if not result.matched_count and result.upserted_id is None:
            raise DemoConflict
        return journey

