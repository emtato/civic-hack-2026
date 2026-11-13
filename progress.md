# CIVIC implementation progress

Last reviewed: November 13, 2026 (proposal feedback implementation).

Read [build-plan.md](build-plan.md) for stage instructions and defaults, and [proposal-feedback-map-idea.md](proposal-feedback-map-idea.md) for the intended concept. Current shared baseline commit: `971f28d` (`startig project`). This log records observed progress; it does not mark planned features as implemented.

## Current checkpoint

**Active stages: A — source enrichment/catalogue integration; B/C/D — feedback submission and inspectable aggregate.**

| Area | State | Evidence / remaining work |
| --- | --- | --- |
| Vite + TypeScript starter | Verified: production build | Starter exists in `frontend/`. The assistant's build passed, and the user supplied a second successful build. |
| Local development server | Browser verified | Existing localhost:5173 session serves the app; feedback was checked at desktop and 390px widths. |
| Initial repository commit | Verified | `971f28d` exists. |
| Selected multi-proposal catalogue | Saved to MongoDB and read-back verified | 24 records in `civic_hack.imported_proposals`, four per category; all validate against the rich schema. All 24 raw snapshots verified in `source_notices`. See [import guide](backend/IMPORTING.md). |
| Revision example evidence | Source package located | Kensington is a possible deep historical example within the catalogue, not a standalone application. See [case notes](sources/kensington-case-notes.md). |
| Two secondary agenda-item checks | Planned | Final item selection and checks remain. |
| Rich import contract and examples | Implemented and locally verified | `backend/imported_data_dto.py` has nullable optional interpretation, participation, category details and revision fields. Import preview contains 24 records; 16 have unverified source coordinates, eight lack source addresses. |
| FastAPI and frontend DTO integration | Connected and live verified | Service converts `imported_proposals` into display DTOs; the running localhost endpoint returns all 24, with 16 map points and eight list-only records. Detail and aggregate routes use the same imported IDs. Legacy `proposals` is untouched. |
| Atlas cluster setup | Complete, user-reported | User reports the cluster is done. Application connection/read/write remains unverified. |
| Render and Pages setup | Unverified | No deployment or working URL has been demonstrated in this chat. |
| Resident feedback | Implemented and browser verified | Position, self-reported role, optional feature ratings, original comment, one manual requirement, review/confirmation, receipt and edits. Server success/failure checked with an isolated in-memory API; live MongoDB persistence through this UI is not verified. AI extraction and multiple conditions remain outstanding. |
| Community aggregate and drill-down | Implemented and locally verified | All four DTO sections render in `ProposalFeedback`; quotes expand with original text, requirements and time/place. New requirements stay ungrouped. Edits replace position/condition evidence and preserve participant counts. |
| Revision/reconfirmation cycle | Planned | Await version data and the resident/staff core. |
| Report, video and submission | Planned | Blank organizer reference/template exists; team deliverables remain. |

## Decisions currently in force

- User-selected stack: Vite + TypeScript frontend; Python FastAPI backend.
- Recommended infrastructure: GitHub Pages, Render, MongoDB Atlas with PyMongo, Leaflet, and one user-supplied LLM provider.
- User-directed acquisition: a selected, saved catalogue of at least 20 relevant, varied example proposals rather than live city-source calls or a bespoke Kensington-only application. Retain three deeply checked agenda items and one demonstrated revision cycle, with synthetic feedback.
- Verified source: a filtered Public Notices API request returned 648 records; direct download succeeded. Proposal selection, interpretation and coverage remain separate checks. See [source assessment](sources/import-source-assessment.md).
- Recommended defaults awaiting use in stage A: two main record types, version-specific responses, contributor-confirmed conditions, explicit review of the new version, prepared source-checked change notes, and no automatic vote carry-forward in this build.
- Suggested ownership: user on frontend, teammate on backend/data. The teammate's availability and assignment are not confirmed.

## Next actions

1. **Import complete:** 24 examples and 24 raw snapshots were saved to MongoDB and verified by reading them back. The earlier automatic-approval failure is resolved for this action.
2. **Source/enrichment owner:** fill and review summaries, meaningful features, exact dates/participation and location choices. Raw source fields are populated; optional interpretation fields intentionally remain unknown.
3. **Backend/frontend owners:** project reviewed imported records into the app's display DTO and publish them to the user-facing catalogue. The richer source model and current frontend DTO are distinct contracts; do not blindly put source-stage records into the published collection.

Next review should inspect an actual fetched record and its normalized equivalent, source coverage, database connectivity, and the shared API contract. Import, persistence and UI work can proceed together where their shared contract permits.

## Decisions still requiring evidence or input

| Decision | Why it matters | Default / next check |
| --- | --- | --- |
| Selected catalogue | Determines demonstrated topics, geography and review burden | Notices payload is verified. Select at least 20 relevant proposals; supplement agenda pages as needed. Keep Kensington as a possible revision example. |
| Teammate ownership and shared-code location | Determines which work can actually proceed in parallel | Agree on frontend/backend ownership and share branches/commits before integration review. |
| LLM provider/model and access | Determines request format, available structured output and latency | User supplies provider; keep extraction behind one backend operation. |
| Actual hosting/database access | Deployed behavior cannot be inferred from provider documentation | Verify account setup and one deployed persistent request during stage B. |

## Checkpoint log

### November 13 — saved voting topics reviewed across all 24 proposals

- **Reviewed:** every saved notice and its proposed feature questions; no fixed question-count target. Retained 11 topic sets unchanged and adjusted 13 to remove duplicate/context-only questions or expose distinct substantive choices. Current catalogue has 50 topics, with one to four per proposal.
- **Saved and verified:** updated only current `features` on the 13 affected MongoDB records and read back all 24. Source text, historical version snapshots, all other proposal fields and participant feedback were preserved. There were no existing aggregates or saved feature answers on the affected records. Updated the local enrichment and formatted seed data to match.
- **Evidence:** [per-proposal review](backend/data/feature-topic-review.md) records the reason for every change or decision to retain a set. Every revised topic has a literal source quotation. Sparse fee notices retain a broad question with an explicit information limit.
- **Validation:** all 33 backend tests pass; formatter supports explicit stable IDs and custom rating questions. Normal enrichment still preserves existing nonempty features. No live AI or municipal revision was introduced.

### November 13 — service conversion and catalogue collection switched

- **Implemented:** rich-to-display conversion in the service, raw-record persistence reads from `imported_proposals`, matching feedback aggregate writes, nullable coordinates and feature questions derived from stable imported feature IDs.
- **Preserved:** original source data, historical snapshots, existing aggregate counts and the legacy collection. Display edits use a separate override namespace instead of replacing rich records. Default empty-database seeding uses the formatted 24-record dataset.
- **Verified:** all 32 backend tests pass. Read-only live-MongoDB route checks returned 24 records across six topics, 16 map locations/eight unmapped records, and working detail/aggregate responses. The existing running localhost:8000 endpoint also returned 24 without needing a restart.
- **Next:** refresh the frontend to load the new catalogue; continue the independent review of current municipal status/participation and the planned revision workflow.

### November 13 — frontend catalogue connected

- **Authorized scope:** frontend step 2; backend collection conversion is being handled separately.
- **Implemented:** API-backed catalogue state, request cancellation/timeout, visible retryable failures and empty catalogue, dynamic topic/status filters and legend, null-coordinate handling, asynchronous map fit and preserved follow IDs. No silent fixture fallback for proposal reads.
- **Verified:** production build and all 10 frontend tests passed. Browser fixture checks covered error → retry → two fetched records/one marker, new topics/statuses, filtering, opening a citywide record without coordinates, and empty catalogue handling.
- **Documentation:** `frontend/.env.example` and README explain `VITE_API_BASE_URL`, the public display DTO and CORS/deployment expectations.
- **Remaining dependency:** the real backend must expose reviewed imported examples through `/api/proposals` in the display shape. This task did not change backend collections, API routes or formatting.

### November 13 — proposal feedback section implemented

- **Architecture:** Sidebar uses a separate `ProposalFeedback` component, with `FeedbackForm` for entry/review and feedback-specific CSS. Overview now opens the working response flow. Switching detail tabs preserves a draft.
- **Displayed:** full stance distribution including unsure; self-reported stakeholder connections; proposal-specific feature distributions with independent answer counts; condition groups with expandable supplied examples. Fixture counts and partial evidence are labelled honestly.
- **Saved:** position, connection, optional feature ratings, original words and one explicitly confirmed manual requirement with optional place/time. Support promises require an explicit checkbox. A general comment never increases condition counts. Editing replaces prior evidence without adding a participant.
- **Failure handling:** read failure enters an explicit, separate device-only demo mode. Server write failure keeps the response and shows an error; no silent local success. Demo responses are not automatically uploaded to a recovered server.
- **Verified:** production build; five frontend aggregate regression tests; fourteen backend API/service/persistence tests. Browser tested local save/edit/condition removal/refresh, quote disclosure, server success and intentional HTTP 503 with retained answers, and a 390px layout. API browser tests used isolated in-memory repositories and did not write MongoDB; temporary test server stopped afterwards.
- **Integration fixes:** corrected backend imports after the DTO module rename; fixed condition edit/removal counts and inferred support; bounded comment/requirement lengths and rejected blank requirements.
- **Still outstanding:** AI extraction, multiple conditions per response, optional map concern pins, version-scoped revision/reconfirmation, and verification against the actual deployed API/database. The 24 imported records still need reviewed projection into the published catalogue, as recorded above.

### November 13, approximately 1:10 p.m. — MongoDB import completed

- **Executed:** existing importer with `--write`; MongoDB reported 24 inserts and zero updates.
- **Verified independently:** read all 24 selected IDs from `civic_hack.imported_proposals`, validated each against the rich import model, checked four per category and all 24 raw source snapshots in `source_notices`.
- **Remaining:** enrichment/review and projection into the published frontend catalogue. No map code or published proposal records were changed by this import.

### November 13, approximately 1:10 p.m. — importer and expanded optional shape implemented

- **Implemented:** reusable fetch/file-input importer, explicit category/identity selection manifest, rich optional import model, source snapshots and repeatable MongoDB updates with editorial preservation.
- **Selected:** four each of planning, heritage, transportation, licensing, financial and City property dispositions, using 2025 and 2026 notices. Financial examples differ in substance; property dispositions include a proposed lease. Original source topics remain available alongside curated categories.
- **Verified:** 24-record dry run and eight regression checks, including repeat imports, changed-source review, unknown dates, coordinate order and preservation of published records/feedback. Sixteen records contain source coordinates; no primary pins or current procedural states were invented.
- **Repository coordination:** source model was renamed to `imported_data_dto.py` during ongoing backend work. Importer now uses that module and the shared TLS-aware database client, and stages into `imported_proposals` rather than the frontend's published collection.
- **Blocked action:** live MongoDB import was not executed because automatic approval review failed due to a usage limit. This was a review failure, not a determination that writing the selected records was unsafe.
- **Remaining:** actual write/read check, enrichment/review and projection into the frontend DTO. Existing backend routes and UI were not modified as part of this import task.

### November 13, approximately 11 a.m. — API response verified; minimum catalogue size raised

- **User direction:** at least 20 example proposals to give the map substance and demonstrate variety.
- **Observed:** official-interface-generated API URL returned 648 notices; 625 have at least one coordinate pair, and all 648 have empty `eventList` arrays. Direct HTTP download succeeded after browser verification. Counts concern source notices, not reviewed unique proposals.
- **Observed repository change:** a FastAPI/PyMongo foundation is now present; runtime health and database write checks were not performed in this source review.
- **Recorded:** [source assessment](sources/import-source-assessment.md), exact request URL, checksum, source-to-model considerations and remaining work.
- **Next:** agree on the common schema and implement the offline importer with selection, validation, provenance and repeatable database writes. No application importer code was written in this turn.

### November 13, approximately 10:55 a.m. — selected-batch import replaces bespoke-case start

- **Reported:** MongoDB cluster creation is complete; application connectivity is not yet demonstrated.
- **User correction:** avoid a Kensington-only application followed by a replacement integration. Build a reusable selected import, store multiple example proposals, and use the saved catalogue in the demo.
- **Observed:** Toronto documents a public-notices JSON API with a common envelope, optional/repeated fields, HTML description and supporting links. Full-feed retrieval timed out; API payload usability is not yet established.
- **Decision:** keep source-specific mapping in an offline importer and serve one common proposal format through FastAPI. Do not treat notices, proposals and proposal versions as interchangeable records.
- **Next:** inspect a filtered source payload and settle the shared record contract while connecting FastAPI to Atlas. Earlier log entries retain the superseded recommendation as history.

### November 13, approximately 10:45 a.m. — first source package located

- **Reported:** user is creating the MongoDB cluster. Connection to application code is not yet verified.
- **Observed:** Kensington agenda item 2023.TE6.54 links a consultation report and an attachment documenting design changes following feedback. Recorded source roles and historical-status constraints in [case notes](sources/kensington-case-notes.md).
- **Recommended decision:** curate one real proposal into the application's own records first; FastAPI supplies the frontend API. Automated proposal ingestion can follow later.
- **Outstanding:** user confirmation of the recommended case, exact snapshot features and map location, shared fixture, and backend/database connection.
- **Next:** finish Atlas access setup alongside preparing the first proposal record; then connect the browser-to-backend-to-database path.

### November 13, approximately 10:40 a.m. — planning made operational

- **Observed:** TypeScript/Vite starter builds; an initial commit exists; no application feature/backend implementation is recorded yet.
- **Changed:** roadmap now supplies per-stage implementation defaults, work sequence, required evidence, completion criteria and fallbacks. Added this progress log for durable handoffs.
- **Clarified:** `dev` starts localhost; `build` creates production files; `preview` serves the existing build locally.
- **Schedule:** still in the initial source/shared-data block. Reassess against actual time at the next implementation checkpoint; no completed feature milestones are claimed.
- **Next:** establish checked primary source/version data and the shared fixture, then connect one browser submission to persistent storage.

## Format for subsequent checkpoints

Copy this structure as a short entry; do not fill an unknown with an assumed pass:

- Time, stage, and shared commit/files:
- Outcome demonstrated and evidence:
- Implemented but unverified / missing work:
- Decisions adopted or changed, with reason:
- Failed checks / uncertainties / dependencies:
- Schedule assessment and concrete scope reduction, if needed:
- Next two or three actions and owners:

Keep the current-checkpoint table and next-actions list aligned with the newest entry. When work is cut, mark it deferred explicitly instead of silently removing it.
