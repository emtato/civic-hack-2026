# CIVIC implementation progress

Last reviewed: November 13, 2026, approximately 11 a.m. Eastern.

Read [build-plan.md](build-plan.md) for stage instructions and defaults, and [proposal-feedback-map-idea.md](proposal-feedback-map-idea.md) for the intended concept. Current shared baseline commit: `971f28d` (`startig project`). This log records observed progress; it does not mark planned features as implemented.

## Current checkpoint

**Active stage: A — source choice and shared data.**

| Area | State | Evidence / remaining work |
| --- | --- | --- |
| Vite + TypeScript starter | Verified: production build | Starter exists in `frontend/`. The assistant's build passed, and the user supplied a second successful build. |
| Local development server | Awaiting user run | `npm run dev` is defined in `frontend/package.json`. The supplied output was a production build, which correctly exited. No running localhost session has been verified. |
| Initial repository commit | Verified | `971f28d` exists. |
| Selected multi-proposal catalogue | Acquisition verified; selection/import pending | User target is at least 20 relevant, varied proposals. The verified notices response contains 648 records; see [source assessment](sources/import-source-assessment.md). No importer has been implemented. |
| Revision example evidence | Source package located | Kensington is a possible deep historical example within the catalogue, not a standalone application. See [case notes](sources/kensington-case-notes.md). |
| Two secondary agenda-item checks | Planned | Final item selection and checks remain. |
| Shared proposal/response fixture | Planned | Record structure and recommended field meanings are in stage A; a fixture file is not yet present. |
| FastAPI foundation | Implemented; not runtime-verified in this review | `backend/main.py` now has application/database health routes, a shared PyMongo client and CORS configuration. Proposal/response routes and the shared contract remain. |
| Atlas cluster setup | Complete, user-reported | User reports the cluster is done. Application connection/read/write remains unverified. |
| Render and Pages setup | Unverified | No deployment or working URL has been demonstrated in this chat. |
| Resident interaction and AI confirmation | Planned | Frontend remains the starter. |
| Staff aggregation and drill-down | Planned | Await saved responses and grouping/count implementation. |
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

1. **Source owner, with assistant support:** select at least 20 distinct relevant proposals with topic/geographic variety from the verified notices source and any necessary selected agenda pages. Do not import every notice as a separate proposal.
2. **Both developers, with assistant support:** agree on the common proposal/response format and map source fields into it; build the reusable selected-batch import and generic UI against this same contract.
3. **Backend owner:** connect FastAPI to the completed Atlas cluster and verify read/write. The integrated outcome is browsing imported records and saving/retrieving synthetic feedback.

Next review should inspect an actual fetched record and its normalized equivalent, source coverage, database connectivity, and the shared API contract. Import, persistence and UI work can proceed together where their shared contract permits.

## Decisions still requiring evidence or input

| Decision | Why it matters | Default / next check |
| --- | --- | --- |
| Selected catalogue | Determines demonstrated topics, geography and review burden | Notices payload is verified. Select at least 20 relevant proposals; supplement agenda pages as needed. Keep Kensington as a possible revision example. |
| Teammate ownership and shared-code location | Determines which work can actually proceed in parallel | Agree on frontend/backend ownership and share branches/commits before integration review. |
| LLM provider/model and access | Determines request format, available structured output and latency | User supplies provider; keep extraction behind one backend operation. |
| Actual hosting/database access | Deployed behavior cannot be inferred from provider documentation | Verify account setup and one deployed persistent request during stage B. |

## Checkpoint log

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
