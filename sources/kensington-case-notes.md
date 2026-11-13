# First-case recommendation: Kensington Market Safe Streets

Checked November 13, 2026. These are team research notes, not an official municipal record or an implemented dataset. Recommendation: use the 2023 consultation/revision as a historical demonstration, with synthetic participants. The user has not yet confirmed this case choice.

## Why start here

The source package includes a real agenda item, consultation evidence, and an attachment explicitly documenting design changes following feedback. It supports a revision demonstration without a city-wide data integration. One project record can link to several source documents; each source document is not a separate proposal.

## Source roles and checked facts

| Source | Checked role / fact |
| --- | --- |
| [Agenda item 2023.TE6.54](https://secure.toronto.ca/council/agenda-item.do?item=2023.TE6.54) | Toronto and East York Community Council considered the item June 22–23, 2023 and adopted it with amendments under delegated authority. The record says that decision is final. Preserve this actual decision-making body. |
| [Attachment 2: Design changes based on feedback from Consultation #3](https://www.toronto.ca/legdocs/mmis/2023/te/bgrd/backgroundfile-237354.pdf) | PDF page 2 describes the earlier pedestrian-only/shared-zone design. Pages 5–6 describe the recommended pedestrian-priority arrangement with slow vehicle access. Page 12 describes dedicated/flexible loading; page 13 describes a later pedestrianisation pilot requiring further consultation. These are useful anchors for two historical snapshots. Exact feature locations and any operating hours still need checking before encoding them. |
| [Phase 3 consultation report](https://www.toronto.ca/wp-content/uploads/2026/04/9622-KensingtonSafeStreets-Phase3-ConsultationReport-web1.pdf) | PDF page 3 states that the recommendation changed following feedback; page 14 discusses the revised plan presented at the May 23, 2023 meeting. Use for consultation/revision context. Do not copy actual participants into synthetic demo identities. |
| [Current project page](https://www.toronto.ca/community-people/get-involved/public-consultations/infrastructure-projects/kensington-market-construction/) | Links the historical records and reports subsequent design changes. Its March 2026 update concerns construction planning. Keep these later updates separate from the 2023 replay; do not mix their specifications or schedules into a historical version. |

Page numbers above mean the one-based page position in the PDF viewer, including its cover.

## First data-preparation task

Prepare one proposal record containing its identifier/title, historical-demo label, actual decision status and date, source references, checked project location, and two named historical snapshots. Identify only two or three features needed for the first interaction, such as pedestrian/vehicle access and delivery/pickup arrangements.

For every snapshot feature, retain the source document and page that establishes it. A revised design can address a topic without proving an individual requirement is satisfied. Unknown details stay unknown.

Do not present the 2023 consultation as accepting official input today. The application's feedback and reconfirmation are demonstration actions, not delivery to Toronto.

## Data acquisition decision

For the first working cycle, curate this small source package into the application's own records. A third-party proposal API is not a prerequisite. FastAPI will expose the application's own proposal/response API to the frontend. Automated city-source ingestion can be designed later without changing the core resident feedback workflow.

Still outstanding: final case confirmation, exact snapshot feature extraction, map coordinates/geometry, shared fixture creation, and two secondary real-item accuracy checks.
