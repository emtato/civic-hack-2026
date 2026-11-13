# CIVIC implementation progress

Last reviewed: November 13, 2026, approximately 10:45 a.m. Eastern.

Read [build-plan.md](build-plan.md) for stage instructions and defaults, and [proposal-feedback-map-idea.md](proposal-feedback-map-idea.md) for the intended concept. Current shared baseline commit: `971f28d` (`startig project`). This log records observed progress; it does not mark planned features as implemented.

## Current checkpoint

**Active stage: A — source choice and shared data.**

| Area | State | Evidence / remaining work |
| --- | --- | --- |
| Vite + TypeScript starter | Verified: production build | Starter exists in `frontend/`. The assistant's build passed, and the user supplied a second successful build. |
| Local development server | Awaiting user run | `npm run dev` is defined in `frontend/package.json`. The supplied output was a production build, which correctly exited. No running localhost session has been verified. |
| Initial repository commit | Verified | `971f28d` exists. |
| Primary proposal and revision evidence | Source package located; recommendation pending confirmation | Kensington Market 2023.TE6.54 has an official design-change attachment and consultation report. See [case notes](sources/kensington-case-notes.md). Exact feature extraction remains. |
| Two secondary agenda-item checks | Planned | Final item selection and checks remain. |
| Shared proposal/response fixture | Planned | Record structure and recommended field meanings are in stage A; a fixture file is not yet present. |
| FastAPI application and API contract | Planned | No backend application is present in the current tracked file inventory. |
| Atlas setup | In progress, user-reported | User is creating the MongoDB cluster. Application connection/read/write remains unverified. |
| Render and Pages setup | Unverified | No deployment or working URL has been demonstrated in this chat. |
| Resident interaction and AI confirmation | Planned | Frontend remains the starter. |
| Staff aggregation and drill-down | Planned | Await saved responses and grouping/count implementation. |
| Revision/reconfirmation cycle | Planned | Await version data and the resident/staff core. |
| Report, video and submission | Planned | Blank organizer reference/template exists; team deliverables remain. |

## Decisions currently in force

- User-selected stack: Vite + TypeScript frontend; Python FastAPI backend.
- Recommended infrastructure: GitHub Pages, Render, MongoDB Atlas with PyMongo, Leaflet, and one user-supplied LLM provider.
- Proposed hackathon scope: one deep proposal/revision cycle plus two smaller real-item accuracy checks; synthetic demonstration contributions.
- Recommended defaults awaiting use in stage A: two main record types, version-specific responses, contributor-confirmed conditions, explicit review of the new version, prepared source-checked change notes, and no automatic vote carry-forward in this build.
- Suggested ownership: user on frontend, teammate on backend/data. The teammate's availability and assignment are not confirmed.

## Next actions

1. **User:** finish Atlas cluster setup, create a database user if needed, allow the current development IP, and retrieve the Python-driver connection URI for private backend configuration. No connection/read/write success is claimed yet.
2. **Source owner, with assistant support:** use the recommended [Kensington historical source package](sources/kensington-case-notes.md) to establish the first proposal record and two or three checked features across two snapshots. External city-API integration is deferred for this first cycle.
3. **Both developers, with assistant support:** agree on the shared proposal/response fixture and assign the stage-B API/frontend tasks. The first integrated outcome remains loading that proposal and saving/retrieving one synthetic response.

Next review should inspect the chosen records and shared data example, identify missing source/version/participation facts, and turn stage B into the next two or three concrete implementation tasks.

## Decisions still requiring evidence or input

| Decision | Why it matters | Default / next check |
| --- | --- | --- |
| Primary real case and version pair | Determines feature questions, geometry, change notes and source accuracy | Kensington is now recommended based on its official design-change attachment; confirm the choice and extract exact features. |
| Teammate ownership and shared-code location | Determines which work can actually proceed in parallel | Agree on frontend/backend ownership and share branches/commits before integration review. |
| LLM provider/model and access | Determines request format, available structured output and latency | User supplies provider; keep extraction behind one backend operation. |
| Actual hosting/database access | Deployed behavior cannot be inferred from provider documentation | Verify account setup and one deployed persistent request during stage B. |

## Checkpoint log

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
