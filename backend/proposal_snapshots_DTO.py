"""Internal source observations and diffs, distinct from published proposal versions."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SnapshotDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    proposal_id: str
    sequence: int = Field(ge=0)
    previous_snapshot_id: str | None = None
    captured_at: datetime
    source_urls: list[str]
    content_sha256: str
    # Readable, normalized source fields used for comparison.
    content: dict[str, Any]
    # Retain original evidence, including fields ignored by normalization.
    raw_notices: list[dict[str, Any]]
    is_demo: bool = False
    demo_label: str | None = None
    demo_after_snapshot_id: str | None = None

    @model_validator(mode="after")
    def reserve_zero_for_demo(self):
        if self.sequence == 0 and not self.is_demo:
            raise ValueError("Sequence zero is reserved for a synthetic demo predecessor.")
        return self


class SnapshotRefreshDTO(BaseModel):
    snapshot: SnapshotDTO
    created: bool


class SnapshotViewDTO(BaseModel):
    """Public saved-source view; excludes duplicate raw records and internal hashes."""

    id: str
    proposal_id: str
    sequence: int
    captured_at: datetime
    source_urls: list[str]
    content: dict[str, Any]
    is_demo: bool = False
    demo_label: str | None = None


class SnapshotChangeDTO(BaseModel):
    # RFC 6901 JSON pointer into snapshot.content (not a MongoDB update path).
    path: str
    operation: Literal["added", "removed", "changed"]
    before: Any = None
    after: Any = None
    text_diff: str | None = None


class SnapshotDiffDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    proposal_id: str
    before_snapshot_id: str
    after_snapshot_id: str
    compared_at: datetime
    changes: list[SnapshotChangeDTO]
    classification: Literal["unclassified"] = "unclassified"
    review_required: bool
    is_demo: bool = False
    demo_label: str | None = None


class SnapshotPollRequestDTO(BaseModel):
    after_sequence: int = Field(default=0, ge=0)


class SnapshotPollResponseDTO(BaseModel):
    proposal_id: str
    checked_at: datetime | None
    snapshot_id: str | None
    snapshot_sequence: int
    snapshot_created: bool
    diffs: list[SnapshotDiffDTO]
    source_status: Literal["pending", "ready", "error"] = "ready"
    source_error: str | None = None
