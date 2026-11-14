"""Proposal and Proposal Aggregate Feedback DTOs.

Matches the frontend contracts defined in:
- frontend/src/data/proposalFeedbackDTO.ts
- frontend/src/data/proposals.ts
"""

from datetime import datetime, timezone
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


PositionStance = Literal[
    "strongly_oppose",
    "oppose",
    "neutral",
    "support",
    "strongly_support",
    "unsure",
]

StakeholderRole = Literal[
    "resident",
    "business",
    "commuter",
    "visitor",
    "citywide",
]

ElementRatingKey = Literal["oppose", "neutral", "support", "unsure"]


class DTOModel(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


class ConditionItemDTO(DTOModel):
    id: str
    participant_id: Optional[str] = None
    grouping_rejected: bool = False
    source: Literal["requirement", "comment"] = "requirement"
    verbatim_quote: str = ""
    extracted_requirement: str = ""
    is_conditional_support: bool = False
    time_window: Optional[str] = None
    location_label: Optional[str] = None
    concern_coordinates: Optional[list[float]] = None
    submitted_at: str


class ConditionClusterDTO(DTOModel):
    id: str
    label: str
    icon: str = "help"
    category: Optional[str] = None
    count: int = 0
    percentage: Optional[float] = None
    is_ungrouped: Optional[bool] = False
    is_suggested: bool = False
    items: list[ConditionItemDTO] = Field(default_factory=list)


class ProposalSpecificElementDTO(DTOModel):
    id: str
    title: str
    prompt: str
    category: Optional[str] = None
    distribution: dict[ElementRatingKey, int] = Field(default_factory=dict)
    total_responses: int = 0


class ProposalCommunityAggregateDTO(DTOModel):
    total_participants: int = 0
    total_conditions: int = 0
    last_updated: str
    position_distribution: dict[PositionStance, int] = Field(default_factory=dict)
    stakeholder_distribution: dict[StakeholderRole, int] = Field(default_factory=dict)
    proposal_specific: list[ProposalSpecificElementDTO] = Field(default_factory=list)
    condition_clusters: list[ConditionClusterDTO] = Field(default_factory=list)
    grouping_status: Literal["pending", "ready", "error"] = "pending"
    grouping_error: Optional[str] = None
    grouping_input_hash: Optional[str] = None
    grouping_updated_at: Optional[str] = None
    grouping_retry_after: Optional[str] = None
    applied_feedback_revisions: dict[str, str] = Field(default_factory=dict)
    applied_feedback: dict[str, dict] = Field(default_factory=dict)


class FeedbackConditionDTO(DTOModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True, str_strip_whitespace=True)

    feature_id: Optional[str] = None
    requirement: str = Field(min_length=1, max_length=1000)
    is_conditional_support: bool = False
    time_window: Optional[str] = Field(default=None, max_length=200)
    location_label: Optional[str] = Field(default=None, max_length=200)


class ConfirmedCommentRequestDTO(DTOModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True, str_strip_whitespace=True)

    requirement: str = Field(min_length=1, max_length=1000)
    quote: str = Field(min_length=1, max_length=4000)
    time_window: Optional[str] = Field(default=None, max_length=200)
    location_label: Optional[str] = Field(default=None, max_length=200)


class FeedbackPreviewDTO(DTOModel):
    comment: str = Field(default="", max_length=4000)
    condition: Optional[FeedbackConditionDTO] = None


class ProposalFeedbackSubmissionDTO(DTOModel):
    proposal_id: str
    version_id: Optional[str] = None
    participant_id: str = Field(min_length=1, max_length=100)
    position: PositionStance
    stakeholder_role: StakeholderRole
    element_ratings: dict[str, ElementRatingKey] = Field(default_factory=dict)
    comment: str = Field(default="", max_length=4000)
    condition: Optional[FeedbackConditionDTO] = None
    # None identifies legacy feedback. New HTTP submissions always store a list;
    # an empty list means the resident chose not to record comment requests.
    confirmed_requests: Optional[list[ConfirmedCommentRequestDTO]] = Field(default=None, max_length=8)
    concern_coordinates: Optional[list[float]] = None
    submitted_at: Optional[str] = None
    # Comment vote tallies (read-only; populated by the service on read).
    upvotes: int = 0
    downvotes: int = 0
    score: int = 0
    my_vote: int = 0  # The requesting viewer's vote: 1, -1, or 0 if none/anonymous.

    @model_validator(mode="after")
    def validate_confirmed_quotes(self):
        if any(request.quote not in self.comment for request in self.confirmed_requests or []):
            raise ValueError("Each confirmed request must quote the submitted comment exactly.")
        return self


class CommentVoteRequestDTO(DTOModel):
    # 1 = upvote, -1 = downvote, 0 = clear the viewer's existing vote.
    value: Literal[-1, 0, 1]


class Proposal(DTOModel):
    id: str
    title: str
    neighbourhood: str
    topic: str
    status: str
    coordinates: Optional[list[float]] = None
    summary: str
    changes: list[str] = Field(default_factory=list)
    source: str
    shape: list[list[float]] = Field(default_factory=list)
    community_aggregate: Optional[ProposalCommunityAggregateDTO] = None
