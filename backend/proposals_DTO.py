"""Proposal and Proposal Aggregate Feedback DTOs.

Matches the frontend contracts defined in:
- frontend/src/data/proposalFeedbackDTO.ts
- frontend/src/data/proposals.ts
"""

from datetime import datetime, timezone
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


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
    verbatim_quote: str = ""
    extracted_requirement: str = ""
    is_conditional_support: bool = True
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


class FeedbackConditionDTO(DTOModel):
    feature_id: Optional[str] = None
    requirement: str
    is_conditional_support: bool = True
    time_window: Optional[str] = None
    location_label: Optional[str] = None


class ProposalFeedbackSubmissionDTO(DTOModel):
    proposal_id: str
    version_id: Optional[str] = None
    participant_id: str
    position: PositionStance
    stakeholder_role: StakeholderRole
    element_ratings: dict[str, ElementRatingKey] = Field(default_factory=dict)
    comment: str = ""
    condition: Optional[FeedbackConditionDTO] = None
    concern_coordinates: Optional[list[float]] = None
    submitted_at: Optional[str] = None


class Proposal(DTOModel):
    id: str
    title: str
    neighbourhood: str
    topic: str
    status: str
    coordinates: list[float]
    summary: str
    changes: list[str] = Field(default_factory=list)
    source: str
    shape: list[list[float]] = Field(default_factory=list)
    community_aggregate: Optional[ProposalCommunityAggregateDTO] = None
