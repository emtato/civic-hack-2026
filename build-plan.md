# CIVIC build plan: proposal feedback and revision follow-through

Planning baseline: Friday, November 13, 2026, approximately 10:30 a.m. Eastern. Two-person team assumed. Submission target: Saturday at 9 a.m.; hard cutoff: November 14 at 10 a.m. Eastern. The organizer requires all building and editing to stop at the cutoff. [Official schedule](https://fciprojects.ca/hackathons/2026-civic-hack/)

This plan follows [the current proposal-feedback concept](proposal-feedback-map-idea.md) and the user's choice of Vite + TypeScript and Python FastAPI. Older discovery notes are historical. This document is an implementation roadmap; the application features remain for the team to build.

## 1. The result to demonstrate

A resident opens a real proposal, understands its source and status, records a position and an explicit condition, and confirms how the tool interpreted that condition. Staff can inspect the grouped feedback and its originals. After a revised proposal appears, the resident reviews the relevant change and records a new response. Staff can trace which conditions remain unresolved and which participants actually reconfirmed.

Example: “I support this if accessible pickup remains near this entrance in the evening.” The system preserves the location and time requirement, rather than reducing that to “parking concern.” A revision introducing morning commercial loading does not automatically satisfy it.

Aim for one excellent complete cycle. Include two additional real agenda items for the brief's required accuracy checks; they need not have equally elaborate revision demonstrations. [Challenge requirements](challenge-1.md)

## 2. Technology decisions

| Part | Choice | Purpose and boundary |
| --- | --- | --- |
| Frontend | Vite + TypeScript, initially the plain TypeScript template | Keep the UI in familiar tools. Vite is the development/build tool; this choice does not require React. |
| Frontend hosting | GitHub Pages | Publish the built frontend. Pages serves static HTML/CSS/JavaScript; Python runs separately. [GitHub documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) |
| Backend | Python FastAPI with Uvicorn | Validate requests, save feedback, compute aggregates, and call the LLM. |
| Backend hosting | Render Python web service | Render documents a direct FastAPI deployment using a requirements file and Uvicorn. Start with this rather than learning several hosts. [Deployment guide](https://render.com/docs/deploy-fastapi) |
| Database | MongoDB Atlas Free, accessed through PyMongo | Store responses and their version history. Atlas offers a free proof-of-concept cluster; PyMongo is its Python driver. [Atlas setup](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/), [PyMongo guide](https://www.mongodb.com/docs/languages/python/pymongo-driver/current/get-started/) |
| Map | Leaflet with an appropriate basemap | Proposal markers/areas and optional concern pins. Hand-enter checked coordinates for the few sample cases. Preserve the basemap attribution. [Leaflet guide](https://leafletjs.com/examples/quick-start/) |
| AI | One provider/model supplied by the user | First extract suggested concerns and conditions. Add revision relevance only after feedback submission works. |
| Proposal/source preparation | Manually curated, checked records | Start from official item pages and reports. A city-wide crawler, document upload pipeline, vector database, and general chatbot do not serve the first demo. |

Flow: browser on GitHub Pages → FastAPI on Render → MongoDB Atlas and the LLM provider. The browser displays the result; the backend owns saved data, counts, and secret credentials.

Keep the database URI and LLM key in backend environment variables. A frontend API-base-URL setting is public and can be built into the site; secret keys cannot.

Two deployment details belong in the first working checkpoint:

- Configure the Vite base path for the repository's Pages URL, and build from `frontend/`. A repository site normally uses `/<repository-name>/`. [Vite Pages guide](https://vite.dev/guide/static-deploy.html#github-pages)
- Configure FastAPI CORS: the browser permission that allows your Pages frontend to call a backend on another origin. Include the local development origin and deployed Pages origin. This is separate from authorization. [FastAPI guide](https://fastapi.tiangolo.com/tutorial/cors/)

Render's free service sleeps after 15 idle minutes and can take about a minute to wake. Runtime files are temporary, so saved responses belong in Atlas. Show an honest loading state and check the service before recording; if uninterrupted hosting is important, evaluate a paid instance rather than assuming free hosting stays warm. No paid purchase is part of this setup. [Free-service limits](https://render.com/docs/free)

## 3. Build order, with concrete completion checks

### A. Choose sources and agree on the shared data

Timebox source selection to about 45 minutes. Choose a street/access proposal because its separate design features and mapped concerns suit the current idea. Inspect the Esplanade or Kensington sources already linked in the idea file as leads, then choose based on accessible evidence rather than the name.

Prepare one primary item with two dated, source-supported versions if available. Record its official identifier, location, actual procedural status, material conditions, source passages, and verified participation route or closed/unknown state. Distinguish a staff recommendation from an adopted decision. Do not infer a comment deadline from a meeting date.

If a suitable real version pair is unavailable within the timebox, keep the real proposal context and use a clearly labelled hypothetical revision scenario. Do not present invented design changes as municipal action. A genuine historical revision replay is preferable when the records support it.

Also choose two smaller real agenda items for later checks. Use synthetic, clearly labelled contributions for the demo; do not copy personal public correspondence into participant profiles.

Agree on just two main record types before splitting work:

| Record | Information to preserve |
| --- | --- |
| Proposal | ID, title, checked location, procedural status, sources/verification date, participation information, and version snapshots with feature IDs and change notes. |
| Response | ID, demo-participant ID, proposal ID, version ID, position, original text, confirmed concerns/conditions, optional concern location, and confirmation time. |

A version snapshot means an older version stays intact when a new one is added. A response is always tied to the version reviewed. Saving a version-2 response must not overwrite the version-1 evidence.

Use one response per demo participant per proposal version; multiple conditions belong inside that response. Repeated saves update that version's response instead of increasing the respondent count. Demo-participant IDs support continuity in the demonstration; they do not verify real-world identity.

**Complete when:** both developers can use the same sample proposal and response without inventing incompatible field names. Capture the example payloads in a short shared note. Make the first repository commit early; the repository currently has no commits.

### B. Connect one browser submission to persistent storage

Build one proposal display and a simple feedback form before map polish or AI. FastAPI serves proposal data, accepts a validated response, and reads saved responses from Atlas. Deploy the frontend and backend early.

**Complete when:** a submission made from the deployed Pages site appears after refresh and survives a backend restart. A second browser session can read the aggregate. This checks hosting, CORS, request validation, and database access together.

### C. Make the resident interaction useful

Add a map plus an equivalent proposal list, the source/status panel, overall support scale with a separate unsure option, two or three proposal-specific feature questions, and an optional location pin.

Use one LLM call to suggest structured conditions from free text. Preserve the original text. Let the resident edit the suggestion and explicitly confirm it before it contributes to saved condition counts. If the call fails, keep their text and allow manual entry of the essential condition; a model outage must not discard their contribution.

Keep the first AI output small: feature/topic, requested arrangement, and relevant place/time. An ordinary concern is not automatically a promise to support the proposal if resolved.

**Complete when:** someone can enter the accessible-pickup example, correct an intentionally wrong interpretation, and save the corrected requirement.

### D. Build the inspectable staff view

Show the support distribution, respondent count, and groups of confirmed conditions. Use a few known feature/topic categories initially. Preserve opposite requested outcomes and distinct access needs rather than merging everything with similar wording. Every group opens its underlying responses.

Calculate counts in Python from saved records. The LLM can suggest labels or explanations; it does not supply numerical totals. Count distinct demo participants separately from conditions and show when groups overlap. Label seeded feedback as synthetic and results as a participating sample.

**Complete when:** the view includes a minority access condition, distinguishes “keep this space” from “remove this space,” and exposes the original contributions behind each group.

### E. Complete one revision and reconsideration cycle

Load the checked second version or disclosed hypothetical revision. Use prepared, source-linked change notes. Match relevant changes to the resident's confirmed requirements, initially through the associated feature IDs. AI may suggest relevance, but uncertainty remains visible.

Show an in-app “new version available” notice when that demo participant returns. Show the previous response, relevant changes, and an explicit choice to reconfirm or revise. Real email/SMS delivery can wait.

Before review, display the old response as “previous version — not yet reviewed.” After review, save a new version-specific response. An AI suggestion that a requirement appears addressed must never change the participant's position by itself.

Show version-by-version totals and, if time permits, a separate comparison for the same participants who answered both versions. Do not attribute a higher aggregate score to the revision if the respondents differ.

**Complete when:** the same demo participant moves from version 1 to version 2, both responses remain inspectable, and staff can distinguish reconfirmation from silence. Use a labelled replay control or prepared seed operation for advancing the demonstration; a full staff publishing interface is unnecessary.

### F. Verify, document, and submit

Check sources/status/participation on all three real items. Have someone outside the implementation complete the main task. Record what actually happened and compare the staff task with a plain comment list: can they find each requirement and its evidence, including the minority condition? Do not claim measured improvement without recording a comparison.

Check the following failures because they directly threaten the product's purpose:

1. Same topic, opposite request: separate meanings remain visible.
2. One person contributes several conditions: the respondent count stays correct.
3. A loading revision says nothing about evening pickup: unresolved stays unresolved.
4. A participant has not reviewed version 2: no new confirmed support appears.
5. A model call or backend request fails: the UI explains it and preserves unsent input.
6. A case is historical: it never appears open for official input today.

Prepare concise requirements, a UML sequence diagram matching the actual submit/review workflow, architecture rationale, setup instructions, source references, dependency attribution, and AI disclosure. Separate working features from prepared data and simulated municipal actions. Finish the one-page report, 2–3 minute video, short description, and accessible repository/demo links. [Submission and scoring reference](judging-and-submission.md)

## 4. Schedule and division of work

All times are Eastern, November 13–14. Adjust the first block to the actual start time; preserve the feature freeze and submission buffer.

| Time | Checkpoint | Frontend owner | Backend/data owner |
| --- | --- | --- | --- |
| Now–11:15 a.m. Fri | Source choice, shared records, accounts | Sketch the main screens; run starter; Pages setup | Check primary source/version pair; create Atlas/Render services |
| 11:15 a.m.–1 p.m. | Deployed persistent submission | Proposal display and basic form | Proposal/read/save endpoints and Atlas persistence |
| 1–3 p.m. | Resident workflow | Map/list, feature questions, confirmation UI | Condition extraction, validation, manual fallback |
| 3–5 p.m. | Staff inspection | Distribution and inspectable groups | Correct counts, grouping, synthetic seed cases |
| 5–7 p.m. | Revision cycle | Returning-participant notice and review screen | Version-specific responses and relevant-change matching |
| 7–9 p.m. | Verified core; feature freeze | First-time-user test and UI repairs | Three-item source checks and meaning/count failures |
| 9–11:30 p.m. | Submission draft and initial recording | Demo rehearsal/recording and usability notes | Report, diagrams, setup/attribution; cross-review together |
| 11:30 p.m.–6 a.m. Sat | Rest | Rest | Rest |
| 6–7:30 a.m. | Final verification and recording | Complete video and access checks | Verify clean setup, demo data, source links and report |
| 7:30–9 a.m. | Submit complete package | Upload/check video | Upload/check report, repo, description; verify together |
| 9–10 a.m. | Submission buffer | Resolve submission/access failures | Resolve submission/access failures |

Suggested ownership: the user owns the familiar TypeScript frontend; the teammate owns FastAPI/data if comfortable. Swap ownership if their skills make another split faster. Both inspect the source choice and rehearse the full cycle.

Integrate after each checkpoint. The frontend owner can begin with the agreed sample records while the backend owner builds, but replace those samples with real requests during the persistent-submission block. Avoid a first integration late Friday night.

## 5. What to cut when time slips

Cut in this order: styling refinements and heatmaps; extra filtering/charts; automatic concern clustering; automatic revision interpretation; additional fully interactive proposals. Keep one revision cycle with explicit resident review, even if change notes and condition matching are prepared manually.

For this deadline, leave production accounts, verified identities, email/SMS, automatic vote carry-forward, continuous scraping, arbitrary document uploads, social discussion threads, automated feasible-plan generation, and actual Toronto embedding for a later pilot. An explicit staff/resident demo mode and synthetic personas are enough to demonstrate the workflow. Actual city adoption and official submission remain future integrations.

If the hosted backend becomes a time sink, use the local FastAPI application for the working recording and provide accurate run instructions. A hosted prototype is optional; a working proof of concept remains necessary. Do not silently switch to canned AI output and present it as a live call.

Protect the confirmed condition, inspectable aggregate, revision/review distinction, source accuracy, and submission time. Those are the evidence that this is more than a generic feedback map.
