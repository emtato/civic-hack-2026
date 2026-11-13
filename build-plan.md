# CIVIC build plan: proposal feedback and revision follow-through

Planning baseline: Friday, November 13, 2026, approximately 10:30 a.m. Eastern. Two-person team assumed. Submission target: Saturday at 9 a.m.; hard cutoff: November 14 at 10 a.m. Eastern. The organizer requires all building and editing to stop at the cutoff. [Official schedule](https://fciprojects.ca/hackathons/2026-civic-hack/)

This plan follows [the current proposal-feedback concept](proposal-feedback-map-idea.md) and the user's choice of Vite + TypeScript and Python FastAPI. Older discovery notes are historical. This document is an implementation roadmap; the application features remain for the team to build.

Use this file for the agreed scope, implementation defaults, and stage instructions. Use [progress.md](progress.md) for current evidence, unfinished work, blockers, and the next handoff. Read the current stage rather than the entire roadmap before each work session.

The decisions below are recommended hackathon defaults. They make the next steps concrete; they do not claim that these details were already agreed in the original idea discussion. Change a default when the selected source, actual implementation, or user instruction gives a reason, and record that change in the progress log.

## 1. The result to demonstrate

A resident opens a real proposal, understands its source and status, records a position and an explicit condition, and confirms how the tool interpreted that condition. Staff can inspect the grouped feedback and its originals. After a revised proposal appears, the resident reviews the relevant change and records a new response. Staff can trace which conditions remain unresolved and which participants actually reconfirmed.

Example: “I support this if accessible pickup remains near this entrance in the evening.” The system preserves the location and time requirement, rather than reducing that to “parking concern.” A revision introducing morning commercial loading does not automatically satisfy it.

Build one reusable proposal experience backed by a selectively imported MongoDB catalogue. User-selected demo target: at least 20 relevant example proposals, selected for topic and geographic variety, with three real agenda items checked in depth and at least one complete revision cycle. Catalogue breadth and revision depth are separate goals; do not hardcode the application around Kensington. [Challenge requirements](challenge-1.md)

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
| Proposal/source preparation | Selective offline import into one common record format | Fetch a selected batch from a verified city source/API, retain source data, normalize and review it, then serve MongoDB records during the demo. Do not fetch the city source on each user page view. |

Flow: browser on GitHub Pages → FastAPI on Render → MongoDB Atlas and the LLM provider. The browser displays the result; the backend owns saved data, counts, and secret credentials.

Keep the database URI and LLM key in backend environment variables. A frontend API-base-URL setting is public and can be built into the site; secret keys cannot.

Two deployment details belong in the first working checkpoint:

- Configure the Vite base path for the repository's Pages URL, and build from `frontend/`. A repository site normally uses `/<repository-name>/`. [Vite Pages guide](https://vite.dev/guide/static-deploy.html#github-pages)
- Configure FastAPI CORS: the browser permission that allows your Pages frontend to call a backend on another origin. Include the local development origin and deployed Pages origin. This is separate from authorization. [FastAPI guide](https://fastapi.tiangolo.com/tutorial/cors/)

Render's free service sleeps after 15 idle minutes and can take about a minute to wake. Runtime files are temporary, so saved responses belong in Atlas. Show an honest loading state and check the service before recording; if uninterrupted hosting is important, evaluate a paid instance rather than assuming free hosting stays warm. No paid purchase is part of this setup. [Free-service limits](https://render.com/docs/free)

### Local frontend commands

Run these from `frontend/`:

| Command | Result |
| --- | --- |
| `npm run dev` | Starts the development server; use the localhost URL printed in the terminal. Keep the process running while working. |
| `npm run build` | Type-checks TypeScript and creates production files in `dist/`, then exits. It does not start localhost. |
| `npm run preview` | Starts a local server for the already-built production files. Rebuild after source changes before relying on this preview. |

The normal command while developing is `npm run dev`. Stop it with Ctrl+C. [Vite command documentation](https://vite.dev/guide/#command-line-interface)

## 3. Build order, with concrete completion checks

### A. Choose sources and agree on the shared data

Updated direction following the user's correction: build a small reusable import path and a multi-proposal catalogue from the outset. The checkpoints below organize verification; they are not separate throwaway applications. Keep one shared proposal format and one generic UI.

Toronto's Public Notices JSON API is now a verified acquisition source: a date-filtered request returned 648 records and a direct download succeeded. See [the source assessment](sources/import-source-assessment.md) for the exact URL, observed fields, counts and caveats. This does not establish comprehensive coverage of all proposals. Council agenda pages are another source, but parsing HTML is not the same as using a documented API.

Next acquisition task: select at least 20 relevant examples from the verified response, supplementing selected agenda pages if needed for variety, and map common fields into one internal format. Skip irrelevant notices. Multiple notices may describe one proposal: preserve source IDs and group using explicit proposal/agenda references where available; flag ambiguous matches rather than deduplicating by title alone. In the observed payload every `eventList` is empty, including descriptions that contain meeting dates, so empty event data must remain unknown pending extraction/review.

The import runs outside the resident interaction: fetch selected records → keep raw source and retrieval date → normalize common fields → extract/check relevant features and evidence → mark reviewed examples ready → save in MongoDB. Re-running it updates city-source fields without deleting participant responses or overwriting historical snapshots. Keep source-record IDs stable and distinguish import/review state from the official decision status.

Common fields include proposal/source IDs, title, topic, decision body and procedural status, relevant dates, source links, geographic scope, feature list, and version snapshots. Features and their questions are data within each proposal, not separate hardcoded screens. Allow missing facts explicitly; a city-wide proposal need not have a precise map pin. A meeting date is not automatically an input deadline, and a notice publication date is not a decision date.

Choose three real agenda items from the selected catalogue for thorough source/status/participation checks. [Kensington](sources/kensington-case-notes.md) remains a useful possible historical revision example within that catalogue, not the whole product. Its official design-change attachment supplies a promising real version pair; exact features still require checking. Use a clearly labelled hypothetical revision only if a real pair cannot support the demonstration. All synthetic participant feedback remains labelled.

Agree on just two main record types before splitting work:

| Record | Information to preserve |
| --- | --- |
| Proposal | ID, title, checked location, procedural status, sources/verification date, participation information, and version snapshots with feature IDs and change notes. |
| Response | ID, demo-participant ID, proposal ID, version ID, position, original text, confirmed concerns/conditions, optional concern location, and confirmation time. |

A version snapshot means an older version stays intact when a new one is added. A response is always tied to the version reviewed. Saving a version-2 response must not overwrite the version-1 evidence.

Use one response per demo participant per proposal version; multiple conditions belong inside that response. Repeated saves update that version's response instead of increasing the respondent count. Demo-participant IDs support continuity in the demonstration; they do not verify real-world identity.

**Implementation decisions for this stage:**

- Keep a reproducible selected-source list and a non-sensitive export of checked imported examples in the repository. Both developers use the same normalized records. The frontend reads them through FastAPI; source-specific field mapping stays in the importer so adding another source does not require replacing the UI.
- Give each proposal version stable feature IDs, such as a particular loading segment or entrance. A feature ID stays the same across versions when it still refers to the same thing. A new or removed feature is explicitly marked.
- Use five explicit position labels: strongly oppose, oppose, neutral, support, strongly support. Store unsure separately. A missing response is neither neutral nor unsure. Display distributions rather than inventing a combined approval score.
- Each condition keeps an ID, feature/topic, desired arrangement, applicable location/time, and an explicit indication of whether the participant made their support conditional on it. Preserve the original text alongside the structured interpretation.
- Prepare at least six synthetic participants that expose the important cases: evening accessible pickup, morning commercial delivery, opposite requests about one feature, unconditional support, opposition unrelated to the changed feature, and unsure. Their counts are demonstration data, never evidence of real public opinion.

**Work sequence:** verify a selected-source payload → agree on the common record format → implement the selected-batch import → check/prepare the example catalogue → establish version/feature IDs and synthetic responses. Backend connectivity and the generic UI skeleton can proceed alongside the import against the same agreed record format.

**Checkpoint evidence:** a real source payload; its normalized equivalent and provenance; selected-record count and exclusions; a common proposal/response contract; three agenda-item references for deeper checks; and a source-supported revision pair or disclosed fallback. Do not mark the importer working solely because source documentation exists.

**Complete when:** both developers can use the same sample proposal and response without inventing incompatible field names. Capture the example payloads in a short shared note. The initial repository commit now exists (`971f28d`); continue making short, reviewable commits as each checkpoint works.

### B. Connect one browser submission to persistent storage

Build one proposal display and a simple feedback form before map polish or AI. FastAPI serves proposal data, accepts a validated response, and reads saved responses from Atlas. Deploy the frontend and backend early.

**Implementation decisions for this stage:**

- Use two MongoDB collections initially: proposals containing their small version snapshots, and responses containing their conditions. Compute aggregate results on demand. Keep database-specific values out of the frontend contract; expose ordinary string IDs.
- Agree on these operations before wiring the UI: list proposals; read a proposal/version; read the current demo participant's response; save that response; and read a version's aggregate. The extraction operation joins in stage C. Exact URL spelling is less important than sharing one documented contract.
- Use a stable browser-local demo-participant ID for continuity and clearly label this as an unverified demonstration session. This is not a production account or permission system. Limit this demo to synthetic input. Protected editing and staff administration belong to a real pilot; avoid adding public staff-mutation endpoints for the replay.
- Enforce one response for each participant/proposal/version combination in the database. Saving again updates that response. A retry or double-click must not add another respondent.
- The server validates required fields, allowed positions, valid proposal/version/feature IDs, coordinate ranges, and reasonable input lengths. A failed save leaves the form intact and does not display a success receipt.
- Start with standard FastAPI request models and the direct PyMongo driver. Add abstractions only if the real implementation needs them.

**Work sequence:** local backend health check → Atlas connection → load proposal fixture → read it in the browser → save/read one response → deploy the same path. Confirm local functionality before debugging deployment, then verify the deployed version too.

**Checkpoint evidence:** which endpoints work, which request the UI actually makes, one saved record, duplicate-save behavior, refresh/restart result, deployment URLs, and any remaining difference between local and hosted operation. Record environment-variable names only; never copy secret values into progress notes.

**Complete when:** a submission made from the deployed Pages site appears after refresh and survives a backend restart. A second browser session can read the aggregate. This checks hosting, CORS, request validation, and database access together.

**If delayed:** keep the local path working and diagnose one hosting dependency at a time. Mark hosted acceptance as outstanding; a local-only result does not pass the deployed checkpoint. Use the local-demo fallback in section 5 if hosting continues to block the core.

### C. Make the resident interaction useful

Add a map plus an equivalent proposal list, the source/status panel, overall support scale with a separate unsure option, two or three proposal-specific feature questions, and an optional location pin.

Use one LLM call to suggest structured conditions from free text. Preserve the original text. Let the resident edit the suggestion and explicitly confirm it before it contributes to saved condition counts. If the call fails, keep their text and allow manual entry of the essential condition; a model outage must not discard their contribution.

Keep the first AI output small: feature/topic, requested arrangement, and relevant place/time. An ordinary concern is not automatically a promise to support the proposal if resolved.

**Implementation decisions for this stage:**

- Use a proposal map/list, one proposal-detail panel, and a feedback/review panel. A staff-view tab can follow in stage D. Avoid a separate page and routing dependency for every step.
- Keep procedural status, historical-replay status, and public feedback visually separate. A closed real item can still have a labelled demonstration response form; that form must not imply a live official consultation.
- Ask about two or three relevant features using the same position labels as the overall response. Feature ratings are optional and have their own answer counts. The overall response still counts once. Save feature ratings within the version-specific response.
- Treat AI interpretation as an editable draft. Display the original comment next to suggested requirements. Confirmed support conditions must be explicitly endorsed by the participant. Editing the original text invalidates the earlier interpretation until they review it again.
- Ask the model to choose from known feature IDs or mark the feature unknown. Validate its returned structure on the server. Missing place/time details stay unspecified; do not infer hours or invent a location.
- Permit multiple conditions in one response. If the model call fails or produces invalid output, offer a simple manual condition entry and retain the original comment. Show loading, failed, and saved states separately.
- Keep location optional. A map click identifies the concern location, not the participant's home. The list and text fields still support the main task without a map click.

**Work sequence:** meaningful proposal context → position/feature inputs → free text → extraction preview → correction/confirmation → save receipt → map and location connection. Both developers can implement the extraction contract and its UI against the agreed example in parallel.

**Checkpoint evidence:** the input text, proposed interpretation, contributor correction, saved condition and source/version reference; one failed-model example; and the result of completing the flow without a map pin. Identify whether any feature ratings or conditions are still only displayed locally.

**Complete when:** someone can enter the accessible-pickup example, correct an intentionally wrong interpretation, and save the corrected requirement.

**If delayed:** simplify layout and map interactions first. Keep the confirmed-condition flow. If extraction is deferred, label manual entry honestly and record that AI is still outstanding.

### D. Build the inspectable staff view

Show the support distribution, respondent count, and groups of confirmed conditions. Use a few known feature/topic categories initially. Preserve opposite requested outcomes and distinct access needs rather than merging everything with similar wording. Every group opens its underlying responses.

Calculate counts in Python from saved records. The LLM can suggest labels or explanations; it does not supply numerical totals. Count distinct demo participants separately from conditions and show when groups overlap. Label seeded feedback as synthetic and results as a participating sample.

**Implementation decisions for this stage:**

- Require a proposal/version selection. Never silently combine responses about different versions.
- Show total respondents, the overall-position distribution including unsure, and each feature's distribution with its own answered count. Feature questions and multiple conditions do not increase the overall respondent total.
- Begin grouping by feature/topic and requested arrangement. A shared topic alone does not establish the same request. Preserve location/time differences inside a group; when equivalence is uncertain, retain separate groups rather than assert a compromise.
- Include both the number of conditions and the number of distinct participants where useful. One person with two conditions appears once in the respondent count and can appear in multiple condition groups. Explain overlaps rather than summing groups into a population total.
- Each group expands to its original comments and confirmed requirements. Keep an ungrouped/uncertain section so low-frequency or unmatched needs cannot disappear.
- Keep summary recomputation consistent with edits: changing a response updates the next aggregate read. A dashboard containing only the original seed data does not demonstrate this requirement.

**Work sequence:** independently count the small fixture → implement the aggregate response → display distribution → add groups and drill-down → edit a response and verify updated counts.

**Checkpoint evidence:** expected and observed counts from the fixture, the handling of overlapping groups, an opposite-request example, a visible minority requirement, and a changed response propagating into the dashboard.

**Complete when:** the view includes a minority access condition, distinguishes “keep this space” from “remove this space,” and exposes the original contributions behind each group.

**If delayed:** show readable count bars and expandable lists. Extra charts, map heatmaps, automatic grouping, and filters can wait.

### E. Complete one revision and reconsideration cycle

Load the checked second version or disclosed hypothetical revision. Use prepared, source-linked change notes. Match relevant changes to the resident's confirmed requirements, initially through the associated feature IDs. AI may suggest relevance, but uncertainty remains visible.

Show an in-app “new version available” notice when that demo participant returns. Show the previous response, relevant changes, and an explicit choice to reconfirm or revise. Real email/SMS delivery can wait.

Before review, display the old response as “previous version — not yet reviewed.” After review, save a new version-specific response. An AI suggestion that a requirement appears addressed must never change the participant's position by itself.

Show version-by-version totals and, if time permits, a separate comparison for the same participants who answered both versions. Do not attribute a higher aggregate score to the revision if the respondents differ.

**Implementation decisions for this stage:**

- Distinguish response state from condition assessment. “Not reviewed/reconfirmed/revised” describes the participant's action. “Potentially addressed/unresolved/uncertain” describes an interpretation of a condition. Neither implies the other.
- Prepared change notes identify changed feature IDs, describe the change, and cite the supporting version passage. Mark a hypothetical change as hypothetical wherever it is used.
- Use feature matching to decide what deserves review, not whether a person supports the revision. If an evening-hours requirement meets a revision containing no evening-hours evidence, the result stays uncertain or unresolved.
- Notify inside the app using the saved demo-participant ID. On returning, the participant sees the new version, their old response, relevant changes, and options to retain or alter their position. Email delivery is deferred.
- Save a new record for version 2 only after explicit confirmation. Show unreviewed prior participants separately from current-version respondents. Preserve version-1 figures and originals.
- If the matched-participant comparison is omitted for time, label each version's sample and do not claim a like-for-like change in opinion.

**Work sequence:** load two version snapshots → show a dated change list → retrieve the same participant's old response → mark relevant conditions → review and save version 2 → inspect both versions in the staff view. Keep replay selection separate from actual municipal publication.

**Checkpoint evidence:** before/after records for one participant, a version-2 no-response example, the evidence behind one condition assessment, an uncertain time/access case, and dashboard totals that exclude unreviewed responses from current confirmations.

**Complete when:** the same demo participant moves from version 1 to version 2, both responses remain inspectable, and staff can distinguish reconfirmation from silence. Use a labelled replay control or prepared seed operation for advancing the demonstration; a full staff publishing interface is unnecessary.

**If delayed:** use manually checked change notes and deterministic feature matching. Keep the review and history behavior; automatic interpretation is an extension.

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

**Work sequence:** run the complete seeded cycle → check the six failures above → verify all three real items → run a first-time-user task → repair consequential failures → align documentation with the final build → record/upload → verify submission access while signed out.

**Checkpoint evidence:** a pass/fail/untested result for each meaningful check; the actual user-test observation; source-check records for the three items; exact mocked/deferred parts; video duration and access result; report file; repository and submission URLs. Record limitations rather than turning untested behavior into a pass.

**Complete when:** the required package is submitted, its links work for an outside viewer, and its claims match the working build. “Video recorded” and “submitted and accessible” are different checkpoints.

**If delayed:** stop feature work. Use a straightforward working screen recording and concise, accurate documentation. Preserve enough upload time to verify the submission.

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

## 6. Progress reviews and decisions during the build

At each checkpoint, review the actual code, visible behavior, and shared progress log before choosing the next work. A feature's presence in a plan, interface mockup, or comment is not implementation evidence. Code that exists but has not been exercised is implemented/unverified; a successful recorded check supports verified status.

Every progress update should contain:

1. **Current stage and demonstrated outcome.** Say what now works and what evidence supports it.
2. **Remaining work in this stage.** Separate missing UI, backend, stored data, integration, and source verification where relevant.
3. **Decisions made.** Record defaults adopted or changed and the practical reason. The assistant should recommend routine choices rather than hand back a menu of equally weighted options.
4. **Failures, uncertainty, and dependencies.** Name the next consequential risk and what check resolves it. Mark teammate work as reported until shared code or a demonstration verifies it.
5. **Schedule assessment and scope cuts.** Compare actual progress with the current time. If a checkpoint slips, name the concrete simplification and preserve submission time.
6. **Next two or three actions with owners.** Keep the next instruction useful on its own; explain an unfamiliar implementation stage when it becomes current.

Use [progress.md](progress.md) as the durable handoff. Update it after meaningful checks or decisions, not after every keystroke. Keep a short entry per checkpoint and current links to the relevant files/commit. This lets a later chat resume from evidence instead of reconstructing the conversation.

Assistant responsibility in this workflow: track dependencies, notice missing requirements, recommend implementation defaults, inspect integration, select meaningful checks, propose scope reductions, and maintain documentation when asked to review progress. The user's learning preference still applies: teach application changes and review their code; implement application code only when explicitly requested. Updating the roadmap and progress notes is planning work.

Ask for user input when a choice materially changes the intended product, requires unavailable account access or budget, or depends on facts the repository cannot establish. Resolve routine field naming, sequencing, and small architectural choices with a stated recommendation. Do not postpone useful independent work while a genuinely blocking choice is pending.
