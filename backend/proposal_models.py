"""Shared proposal contract. Optional enrichment is distinct from imported facts."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

Category = Literal["planning", "heritage", "transportation", "licensing", "financial", "property_sales"]


class Record(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Point(Record):
    type: Literal["Point"] = "Point"
    # GeoJSON order is longitude, latitude (unlike Leaflet's latitude, longitude).
    coordinates: tuple[Annotated[float, Field(ge=-180, le=180)], Annotated[float, Field(ge=-90, le=90)]]


class Evidence(Record):
    source_url: str
    notice_id: int | None = None
    page: int | None = None
    section: str | None = None
    quote: str | None = None


class Address(Record):
    street_address: str | None = None
    full_address: str | None = None
    city: str | None = None
    province: str | None = None
    postal_code: str | None = None
    country: str | None = None
    point: Point | None = None
    verified: bool = False


class Contact(Record):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    fax: str | None = None
    location_name: str | None = None
    street_address: str | None = None
    city: str | None = None
    province: str | None = None
    postal_code: str | None = None
    country: str | None = None


class Reference(Record):
    label: str | None = None
    url: str
    kind: Literal["notice", "background", "reference", "description_link"]


class SourceNotice(Record):
    notice_id: int
    url: str
    title: str
    published_at: datetime
    description_text: str
    subheading: str | None = None
    notice_heading_type: str | None = None
    decision_body: str | None = None
    signed_by: str | None = None
    # Classification of this source notice, never an assertion of current status.
    notice_kind: Literal["application", "intention", "adoption", "decision", "meeting", "surplus", "other"]
    raw_sha256: str


class DatedEvent(Record):
    kind: Literal["meeting", "comment_deadline", "speaker_deadline", "decision", "effective", "appeal_deadline", "other"]
    label: str
    date: str | None = None
    time: str | None = None
    timezone: str | None = None
    location: str | None = None
    raw_text: str | None = None
    evidence: list[Evidence] = Field(default_factory=list)
    verified: bool = False


class Participation(Record):
    status: Literal["unknown", "open", "closed", "historical"] = "unknown"
    official_url: str | None = None
    methods: list[str] | None = None
    instructions: str | None = None
    comment_deadline: DatedEvent | None = None
    speaker_deadline: DatedEvent | None = None
    accessibility_instructions: str | None = None
    verified_at: datetime | None = None
    evidence: list[Evidence] = Field(default_factory=list)


class Feature(Record):
    id: str
    label: str
    description: str | None = None
    proposed_change: str | None = None
    location_label: str | None = None
    point: Point | None = None
    question: str | None = None
    essential_conditions: list[str] | None = None
    evidence: list[Evidence] = Field(default_factory=list)


class Version(Record):
    id: str
    label: str
    published_at: datetime | None = None
    description: str | None = None
    features: list[Feature] | None = None
    change_notes: list[str] | None = None
    evidence: list[Evidence] = Field(default_factory=list)
    hypothetical: bool = False


class Impact(Record):
    affected_groups: list[str] | None = None
    benefits: list[str] | None = None
    concerns: list[str] | None = None
    tradeoffs: list[str] | None = None
    unresolved_questions: list[str] | None = None
    evidence: list[Evidence] = Field(default_factory=list)


class PlanningDetails(Record):
    proposed_uses: list[str] | None = None
    storeys: list[int] | None = None
    dwelling_units: int | None = None
    replacement_rental_units: int | None = None
    affordable_units: int | None = None
    parking_spaces: int | None = None
    site_area_m2: float | None = None
    evidence: list[Evidence] = Field(default_factory=list)


class HeritageDetails(Record):
    action: str | None = None
    properties: list[str] | None = None
    heritage_attributes: list[str] | None = None
    proposed_alterations: list[str] | None = None
    evidence: list[Evidence] = Field(default_factory=list)


class TransportationDetails(Record):
    roads: list[str] | None = None
    change_type: str | None = None
    travel_modes: list[str] | None = None
    access_arrangements: list[str] | None = None
    operating_hours: str | None = None
    evidence: list[Evidence] = Field(default_factory=list)


class FinancialDetails(Record):
    fee_or_program: str | None = None
    existing_amount: float | None = None
    proposed_amount: float | None = None
    currency: str | None = None
    fee_basis: str | None = None
    exemptions: list[str] | None = None
    effective_date: str | None = None
    evidence: list[Evidence] = Field(default_factory=list)


class LicensingDetails(Record):
    business_types: list[str] | None = None
    proposed_rule_changes: list[str] | None = None
    exemptions: list[str] | None = None
    evidence: list[Evidence] = Field(default_factory=list)


class PropertyDetails(Record):
    disposition_type: str | None = None
    area_m2: float | None = None
    proposed_use: str | None = None
    proposed_recipient: str | None = None
    conditions: list[str] | None = None
    evidence: list[Evidence] = Field(default_factory=list)


class Review(Record):
    state: Literal["needs_review", "reviewed"] = "needs_review"
    issues: list[str] = Field(default_factory=list)
    reviewed_at: datetime | None = None
    notes: str | None = None


class Proposal(Record):
    schema_version: Literal[1] = 1
    id: str
    title: str
    category: Category
    categories: list[Category]
    topics: list[str] = Field(default_factory=list)
    municipality: str = "Toronto"
    source_notices: list[SourceNotice]
    planning_application_numbers: list[str] = Field(default_factory=list)
    agenda_item_ids: list[str] = Field(default_factory=list)
    municipal_code_chapters: list[str] = Field(default_factory=list)
    addresses: list[Address] = Field(default_factory=list)
    contacts: list[Contact] = Field(default_factory=list)
    references: list[Reference] = Field(default_factory=list)
    ward_labels: list[str] = Field(default_factory=list)
    imported_at: datetime
    source_snapshot_ids: list[str] = Field(default_factory=list)

    # Enrichment is optional and preserved by repeat imports.
    summary: str | None = None
    reason: str | None = None
    neighbourhood: str | None = None
    geographic_scope: Literal["unknown", "site", "multiple_sites", "corridor", "area", "citywide"] = "unknown"
    map_point: Point | None = None
    status: Literal["unknown", "proposed", "under_review", "adopted", "rejected", "deferred", "withdrawn"] = "unknown"
    status_as_of: datetime | None = None
    status_evidence: list[Evidence] = Field(default_factory=list)
    dates: list[DatedEvent] | None = None
    participation: Participation = Field(default_factory=Participation)
    impact: Impact | None = None
    features: list[Feature] | None = None
    versions: list[Version] | None = None
    current_version_id: str | None = None
    planning_details: PlanningDetails | None = None
    heritage_details: HeritageDetails | None = None
    transportation_details: TransportationDetails | None = None
    financial_details: FinancialDetails | None = None
    licensing_details: LicensingDetails | None = None
    property_details: PropertyDetails | None = None
    review: Review = Field(default_factory=Review)


# The importer only refreshes these fields; editorial fields above stay intact.
IMPORTED_FIELDS = {
    "schema_version", "title", "category", "categories", "topics", "municipality",
    "source_notices", "planning_application_numbers", "agenda_item_ids",
    "municipal_code_chapters", "addresses", "contacts", "references", "ward_labels",
    "imported_at",
}
