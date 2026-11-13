# Demo proposal feedback queue

Created November 13, 2026. This file is the handoff for populating **synthetic demonstration feedback**, not reporting actual public opinion.

## Current checkpoint

- **Completed: 18 / 24 proposals.** Batches 1–3 persisted and verified; 784 synthetic responses, including 239 ordinary comments.
- **Next: Batch 4, items 19–24.** Start only on a new request.
- Work on **at most six proposals per request**, in the order below. Stop after that batch and update this file. Do not automatically start the next batch.
- Status here tracks this task, not whether a proposal already has other feedback. Inspect existing data before writing anything.
- On resumption, read this file first, recheck the current proposal records and feature IDs, and continue from the first unfinished item. Do not regenerate completed items.

Suggested future request:

> Continue `demo-feedback-queue.md`. Populate the next six unfinished proposals with synthetic comments and votes, following the instructions in that file. Leave “What would make a difference” and all its condition data unchanged. Update the queue with what was actually saved and verified, then stop.

## User instructions to retain

The original request below is preserved, with whitespace and the pasted HTML space normalized:

> before we start the below, create a queue with the ones to fill out in order, the instructions that i will paste below, put that into the queue md itself and other tips. i will refer to that file in the future to continue the fill out process. only do 6 at a time
>
> add fake data to the proposals. this means comments and votes. the "What would make a difference
> 0 conditions
> Explore grouped requirements and their original comments. A condition is a specific need; it only means conditional support when the participant explicitly says so." (section that ai analyzes comments and generalizes) should not be touched. the data should be convincing ish, were not lying about this being real, but were showing that this could be what it looks like.
>
> the fake data's comments, opposition/support,"Connection to this place", "The details matter" should be realistic; inspect what this area itself is, use general knowledge to estimate the number of residents , "Business Owner / Worker**0**0%
> Regular Transit / Commuter**0**0%
> Occasional Visitor**0**0%
> Citywide Interest" that might be impacted. dont dig too deep with actual research, a vague notion that fits at first glance the locaiton is enough. thus, your votes for support and oppose and other votes for proposal specific should use that knowldge of "personas" of each location to do these votes and comments.

## Rules for every batch

1. Fill overall positions, primary place connections, proposal-specific ratings, and ordinary free-text comments. Use the current proposal's actual features; do not add or rewrite questions just to make the demo richer.
2. **Do not touch “What would make a difference.”** Preserve `total_conditions` and the entire `condition_clusters` structure, including counts, percentages, labels, quotes and requirements. Preserve existing structured conditions on existing submissions. If the section currently has zero conditions, it must still have zero afterward. No AI grouping, extracted requirements, fabricated condition evidence, or changes to that section's UI/copy.
3. New synthetic submissions must have `condition: null`. An ordinary comment may express a concern without creating a structured condition. Never put comments into condition clusters merely to make them visible.
4. Read the saved summary, address/location, source notice text and current feature questions first. Use those and broad general knowledge for a quick area impression. No deep demographic or municipal research is needed. If a detail is uncertain, avoid depending on it; do not invent a local fact.
5. Note a rough affected-audience scale and likely connections for each proposal before generating feedback. A lane naming has a much smaller immediate audience than a major housing project or citywide policy. Any approximate population range is a **demo planning assumption**, not a researched count, and is separate from the number of synthetic respondents.
6. Let the audience mix inform both the ratings and the comments. Local residents, workers, commuters and visitors can each disagree internally; a role does not determine a person's position.
7. Keep everything identifiable as synthetic demo material in the saved batch artifacts and the presentation context. Do not imply these are real residents, a representative poll, verified population figures, or an official consultation. Use fictional participant identifiers, not actual people's identities.
8. Preserve existing feedback and municipal source/history/status data. No forced catalogue reseeding, collection replacement or unrelated feature work. This task authorizes demo feedback population; it does not require broad application rewrites.
9. **Clean up after each completed batch.** Once MongoDB persistence, read-back reconciliation, protected-condition comparisons and available UI checks pass, keep only the final `submissions.json` and a compact `manifest.json` in that batch folder. Delete temporary generation/snapshot/persistence/revision scripts, baselines, superseded or duplicate payloads, standalone verification reports, extra READMEs and caches. Summarize verification and synthetic origin in the retained manifest and this queue; remove links to deleted artifacts. Keep temporary files while a batch is unfinished or a write/verification issue remains unresolved. Never delete MongoDB records as part of this local cleanup.

## Ordered queue

Order starts with substantial place-based proposals, then covers transport and heritage, then citywide policy, and finishes with the smaller property/procedural decisions. This gives the first batch useful variety while keeping later work easy to resume. All IDs come from the current saved 24-proposal catalogue.

The audience notes below are **fictional scenario prompts**, not findings about actual residents or public sentiment. Choose final participant counts and distributions when working on that batch; no votes are preassigned here.

### Batch 1 — place-based housing and community tradeoffs

| # | Done | Proposal ID | Saved location / subject | Persona and rating guidance |
| --- | --- | --- | --- | --- |
| 1 | [x] | `toronto-labatt-river-towers` | 7 Labatt Avenue / 77 River Street; two 46-storey towers, 1,170 homes and separate non-residential space | A substantial urban housing proposal can attract nearby residents, workers, people passing through and broader housing interest. Mix support for more homes with differing views on scale and the separate non-residential building. Proposed homes are not current residents. |
| 2 | [x] | `toronto-augusta-hotel` | 309–311 Augusta Avenue; six-storey hotel and restaurant | Consider a market/commercial-street scenario with residents, shop workers and occasional visitors. Rate the hotel and restaurant separately; interest in dining need not imply support for the hotel's scale or activity. |
| 3 | [x] | `toronto-neilson-medical-housing` | 1333 Neilson Road; six-storey housing behind a retained medical building | Consider nearby households, medical workers, patients visiting the site and regular travellers. Housing support and support for retaining medical services can differ. Do not invent loss of the medical building. |
| 4 | [x] | `toronto-lawrence-heights-revitalization` | Leila Lane / Flemington Road / Bredonhill Court; Phase 2 housing and public realm | Give local residents a substantial voice alongside workers and citywide housing interest. Replacement social housing, new affordable housing, market housing, and streets/parks/community uses should receive distinct ratings. Include uncertainty about disruption without claiming actual displacement outcomes. |
| 5 | [x] | `toronto-fleet-property-lease` | 701 Fleet Street; long-term lease for a basketball practice facility with community amenities | Consider nearby households, recreation visitors, workers and broader sports/community interest. A person can favour amenities but question the long lease. Do not invent public-access hours, ticket prices or guaranteed benefits. |
| 6 | [x] | `toronto-six-points-road-closure` | Specified portions of Dundas West, Kipling and Bloor in Six Points | Include regular travellers, nearby residents and businesses. Rate the three identified closure locations independently where a persona has a view. These are specified road portions, not a proposal to close entire streets; uncertainty about the exact footprint is plausible. |

### Batch 2 — local transport and heritage

| # | Done | Proposal ID | Saved location / subject | Persona and rating guidance |
| --- | --- | --- | --- | --- |
| 7 | [x] | `toronto-permit-parking-area-1e` | 3459–3461 Dundas Street West excluded from permit-parking area 1E | Consider nearby permit holders, people considering housing there, local workers and transit users. Do not assume all residents own cars or all new residents favour exclusion. One current feature question. |
| 8 | [x] | `toronto-lawrence-road-closure` | Specified Lawrence Avenue East / Ridgewood Road portions | Keep the scenario focused on the affected parcels, nearby households and regular travellers. Avoid inventing a through-road closure, traffic diversion or final redevelopment. One current feature question. |
| 9 | [x] | `toronto-aren-levy-lane` | Existing lane west of Vaughan Road, north of Ellsworth Avenue; proposed naming | A comparatively small, local audience is plausible; some neutrality about the name is natural. Do not invent a new lane, construction project, access restriction or biography of the person named. |
| 10 | [x] | `toronto-lawrence-heritage-intention` | Arena at 2125 Lawrence Avenue West, Weston | Consider local residents, recreation users, workers and heritage interest. This is the Weston arena, distinct from the Lawrence Heights housing proposal. Designation does not itself establish renovation funding or future programming. |
| 11 | [x] | `toronto-weston-heritage-demolition` | 1151 Weston Road; alteration/removal of a heritage attribute for a 46-storey mixed-use building | Mix local residents, workers, housing interest and heritage interest. Differentiate alteration approval, attribute removal, and relocation/conservation planning. Do not describe wholesale demolition of the entire property when the source specifies an attribute. |
| 12 | [x] | `toronto-stotts-bridge-heritage` | Twyn Rivers Drive; heritage bridge demolition, temporary bridge and permanent replacement | Consider regular route users, nearby households, recreational visitors and heritage interest. Support for a replacement can coexist with opposition to demolition or strong support for documentation/salvage. Do not invent closure dates or engineering safety findings. |

### Batch 3 — heritage and citywide business/rental policy

| # | Done | Proposal ID | Saved location / subject | Persona and rating guidance |
| --- | --- | --- | --- | --- |
| 13 | [x] | `toronto-queen-heritage-amendment` | 339 Queen Street East; expanded historical reasons and architectural/structural attributes | Consider nearby residents/workers and citywide heritage interest. Distinguish historical recognition from protection of architecture/timber framing. Do not invent a demolition application or new use. |
| 14 | [x] | `toronto-nightclub-definition` | Citywide; premises under an occupant load of 151 and licensing/zoning alignment | Include small-venue workers/operators, nearby residents, visitors and wider policy interest. Favouring simpler licensing need not mean opposing noise protections. Do not recast the threshold as a limit on all venue attendance or proof of exemptions from unrelated rules. |
| 15 | [x] | `toronto-business-licence-action-plan` | Citywide; operating hours, goods registers, nightclub definition and videotape-store licensing repeal | Give business/worker connections meaningful weight, alongside residents and wider city interest. The four changes should not receive identical automatic ratings; obsolete licensing repeal may provoke less concern than operating hours. |
| 16 | [x] | `toronto-street-vending-rules` | Citywide; sidewalk applications, mobile vending hours, permit regime and on-foot vendor licensing | Consider vendors/workers, other storefront workers, residents, commuters and visitors. Include both enjoyment/convenience and space/access or administrative concerns. Separate extended hours from the new licensing obligations. |
| 17 | [x] | `toronto-rentsafeto-fees` | Citywide; sign reissuance fees, social-housing exemptions and remedial-work fees | Include renter/resident perspectives, property workers/operators and broader housing interest. Ratings for exemptions can differ from ratings for other fees. Do not assert that a particular fee will be passed through to rent or guarantee enforcement results. |
| 18 | [x] | `toronto-permit-parking-exclusion-process` | Citywide; decision authority and consolidated excluded-address schedule | Consider permit users, housing/development workers, regular travellers and wider policy interest. It is a procedural proposal, not a blanket removal of parking permits. People can favour a clearer schedule while remaining unsure about decision authority. |

### Batch 4 — fees and smaller property decisions

| # | Done | Proposal ID | Saved location / subject | Persona and rating guidance |
| --- | --- | --- | --- | --- |
| 19 | [ ] | `toronto-ravine-permit-fees` | Citywide; tree-related applications and standalone grade alterations | Consider residents with property concerns, relevant business workers, ravine visitors and citywide environmental interest. Differentiate the two fee types; do not invent rates or assert that fees alone prevent environmental damage. |
| 20 | [ ] | `toronto-budget-user-fees-2026` | Citywide; 2026 user-fee package | Use a broad mix with meaningful citywide interest. Some people can support service funding and still question affordability; uncertainty is credible because the saved notice defers detailed rates to another document. Do not invent service-specific fee questions or amounts. |
| 21 | [ ] | `toronto-development-application-fees` | Citywide; site-plan application fees | Include development-related workers, residents and wider housing/fiscal interest. The saved notice does not establish the amounts or even a direction of change; comments and votes must not assume an increase or reduction. |
| 22 | [ ] | `toronto-sheppard-surplus-lane` | Lane portions between 145 and 181 Sheppard Avenue East | Consider nearby residents, adjacent businesses and regular users of the area. Separate sale to the adjacent owner from the permanent-closure condition. Do not invent a guaranteed public shortcut, buyer's development plan or sale price. |
| 23 | [ ] | `toronto-van-horne-surplus` | 32.6 m² at 575 Van Horne Avenue; transfer from library purposes to the City | A small local/property-administration audience and some neutrality are plausible. Include nearby residents and library visitors without implying the library is closing or losing a specified service. This is a municipal transfer, not a sale to a private developer. |
| 24 | [ ] | `toronto-woodbine-surplus` | 213.5 m² at 996 Woodbine Avenue; proposed sale to 2-Spirited People of the First Nations | Consider nearby residents/workers and broader municipal-property interest. Do not invent the purchaser's future use, price, sale conditions or a particular community's views. Rate the actual proposed sale. |

## Tips for convincing synthetic feedback

- **Choose an audience before choosing a result.** For each item, write two or three sentences about the place/policy, approximate reach and likely reasons to participate. The notes above are starting points, not demographic evidence.
- **Separate affected people from respondents.** Many people may be affected while only dozens respond. Vary synthetic response totals with the scale and salience of the proposal; do not give all 24 identical totals. If a numerical affected-population estimate would be arbitrary, use “small local audience,” “neighbourhood scale,” or “citywide reach” instead.
- **Assign one primary connection per participant.** Someone who lives and works nearby still contributes to only one connection category. For citywide proposals, use a participant's main relevant connection rather than forcing an imaginary project-site neighbourhood.
- **Keep most comments serious, with varied voices.** Use a mix of short reactions, questions, practical explanations and occasional longer paragraphs. Vary capitalization, punctuation, contractions, vocabulary and formality; some people write polished prose, others use fragments, lowercase, missing apostrophes or a stray typo. Do not mechanically damage every sentence or give everyone the same internet slang.
- **Include a small minority of exaggerated or NIMBY objections when relevant.** A few fictional participants can be petty, sarcastic, inconsistent or focused on their own view/parking/quiet. Keep the majority substantive. Do not make all opposition ridiculous or all support thoughtful, and do not tie writing quality or unreasonable views to a demographic or connection category. Avoid abuse, invented evidence and defamatory claims.
- **Keep each voice coherent with its votes.** Even an unreasonable opinion should match that participant's overall stance and element ratings. Ordinary concerns and jokes remain comment text with `condition: null`.
- **Show saved comments directly.** Overview and the bottom of Community display the current proposal's nonempty stored submission comments, with primary connection labels. Community uses two comments per row, collapsing to one column on narrow screens. Do not restore generic placeholders or feed comments into condition groups. Use the heading “Comments”; explain sample/illustrative data in the overall presentation, without repetitive per-comment disclosure labels.
- **Generate participant-level records, then derive totals.** This keeps comments, roles, positions and feature votes coherent. Do not invent separate headline counts disconnected from the saved submissions.
- **Allow mixed views.** Overall housing support can coexist with opposition to building height; support for heritage can coexist with support for replacement infrastructure. Neutral and unsure are legitimate responses, especially when details are absent.
- **Vary comment length and voice.** Apply the user-requested variation guidance above to every future batch. Mix short observations with more specific explanations. Some participants need no comment or can skip some feature ratings. Avoid repeating the same “I support this, but…” template or making every comment sound like a planner.
- **Use practical, proposal-relevant concerns.** Construction disruption, getting to an existing destination, operating hours, affordability, administrative clarity, conservation and public access can be plausible concerns. Phrase unknown effects as concerns/questions, not established facts.
- **Avoid invented local evidence.** A fictional speaker may say they visit a medical building or use the area, but should not cite fabricated collision statistics, neighbourhood population totals, consultations, promised amenities or verified technical impacts.
- **Do not force a predetermined verdict.** Neither uniform approval nor a fixed 50/50 split is required. Context should explain variation; participant roles should not become stereotypes.

## Repository map and important implementation constraints

These are observations from queue preparation, not instructions to change application code now:

- Current catalogue: [`backend/data/proposals.formatted.json`](backend/data/proposals.formatted.json), with 24 rich source records under `proposals`. The saved file has no `community_aggregate` fields at this checkpoint; existing database aggregates must be checked independently.
- Current reviewed feature choices: [`backend/data/feature-topic-review.md`](backend/data/feature-topic-review.md) and [`backend/data/proposal-enrichment.json`](backend/data/proposal-enrichment.json). Prefer live/current feature IDs when resuming, since they may change after this queue was written.
- Active proposal collection: `imported_proposals`. Participant records live in `feedback`. The old three-example `backend/data/seed_proposals.json` and frontend fixtures are not the current 24-proposal catalogue.
- Submission and aggregate fields: [`backend/proposals_DTO.py`](backend/proposals_DTO.py) and [`frontend/src/data/proposalFeedbackDTO.ts`](frontend/src/data/proposalFeedbackDTO.ts).
- Overall position keys: `strongly_oppose`, `oppose`, `neutral`, `support`, `strongly_support`, `unsure`.
- Connection keys: `resident`, `business`, `commuter`, `visitor`, `citywide`.
- Feature rating keys: `oppose`, `neutral`, `support`, `unsure`. Use exact current feature IDs as the keys of `element_ratings`.
- Ordinary comments are saved on feedback submissions. [`ProposalComments.tsx`](frontend/src/components/ProposalComments.tsx), mounted in Overview by [`Sidebar.tsx`](frontend/src/components/Sidebar.tsx) and at the bottom of Community by [`ProposalFeedback.tsx`](frontend/src/components/ProposalFeedback.tsx), loads nonempty comments from the feedback endpoint for the selected proposal. It handles loading, empty and error states and refreshes after saved feedback. [`ProposalFeedback.tsx`](frontend/src/components/ProposalFeedback.tsx) still shows condition evidence separately. **Do not populate condition groups to make ordinary comments visible.**
- [`backend/service/service.py`](backend/service/service.py) aggregates feedback. `condition: null` prevents adding a new condition, but the aggregation function also recalculates existing cluster percentages. Therefore a normal submission is **not by itself proof** that condition data stayed unchanged. Snapshot and compare the protected fields; choose a scoped write approach that preserves them exactly if the normal path would alter them.
- The feedback persistence key combines proposal and participant IDs. Stable fictional IDs such as `demo-v1-<proposal-slug>-001` make reruns identifiable and prevent accidental duplicate participants when used correctly. Stay within the participant ID length limit of 100 characters.
- Unknown metadata is ignored by the DTOs. Do not assume adding `is_demo` to an API payload will persist a disclosure flag. Keep the synthetic origin explicit in the artifact manifest, participant IDs and demo presentation context using supported mechanisms.

## Batch workflow and verification

1. Select the next six unchecked items. Check that each ID exists and inspect its current features, existing feedback and aggregate. If a proposal was removed or materially changed, record that before generating data.
2. Record the audience assumptions and chosen synthetic respondent total for each. No deep research is required; use the stored proposal material first.
3. Save final participant-level records in `submissions.json` and synthetic-origin labeling, stable participant IDs, proposal IDs, generation date and audience assumptions in `manifest.json`. Record their paths here. Use temporary baselines/scripts as needed to protect existing data during writes and verification; retain them only until the batch has been successfully persisted and verified.
4. Validate the submissions against the current DTO. Confirm every feature rating refers to a current feature. New synthetic submissions have no structured conditions.
5. Persist only this batch's feedback and corresponding vote/connection/feature aggregates to the intended demo environment. Avoid destructive reseeding or replacing existing participants. If the destination is unavailable, record “prepared, not persisted” rather than marking completion.
6. Read back what was saved. Verify both position counts and connection counts sum to `total_participants`. Each feature's distribution must sum to its own `total_responses`, which cannot exceed total participants. Reconcile the added synthetic contributions with the baseline rather than assuming existing feedback was empty.
7. Confirm comments exist as ordinary submission comments. Compare `total_conditions` and all of `condition_clusters` against the baseline for exact equality. Confirm proposal features, source records and history were preserved. Inspect the displayed vote/connection/feature results where a running UI is available; state if UI verification was unavailable.
8. Mark only verified proposals complete, update the checkpoint and add a batch log entry with counts, files/destination, verification and any remaining issue.
9. Complete the local cleanup in rule 9 above: retain only final `submissions.json` and compact `manifest.json`, with verification results summarized in the manifest and queue. Remove stale artifact links. **Stop after these six.**

## Batch log

### Queue preparation — November 13, 2026

- Listed all 24 saved proposal IDs exactly once in four ordered batches of six.
- Read the saved summaries, addresses and current feature choices; added scenario guidance based on those records.
- Documented the protected condition fields and the distinction between ordinary comments and structured conditions.
- No synthetic participants, comments, votes, aggregates or database writes created. No application code changed.

### Future batch entry template

- Date / batch:
- Proposal IDs completed:
- Audience assumptions and synthetic participant/comment counts per proposal:
- Local artifact / manifest path:
- Destination and persistence status:
- Existing feedback preserved / rerun behavior checked:
- Totals reconciled / current feature IDs verified:
- `total_conditions` and `condition_clusters` unchanged:
- Stored comments verified / UI verification result:
- Issues or prepared-but-not-persisted items:
- Next unfinished batch / item:

### Batch 1 — November 13, 2026 — completed

- **Synthetic demo data only:** fictional participant IDs start with `demo-v1-`. These responses are illustrative, not actual public opinion or a representative poll. Explain sample/illustrative data in the overall presentation; no repetitive labels are needed on individual comments.
- Saved **299 new synthetic participants and 84 ordinary comments** in configured MongoDB database `civic_hack`, collections `feedback` and `imported_proposals`. All 299 new submissions have `condition: null`.

| Proposal completed | Audience planning assumption (not researched) | New synthetic participants | New comments | Existing participants preserved | Verified total |
| --- | --- | ---: | ---: | ---: | ---: |
| `toronto-labatt-river-towers` | Neighbourhood scale, several thousand potentially interested people plus wider housing interest; mostly nearby residents | 62 | 14 | 1 | 63 |
| `toronto-augusta-hotel` | Hundreds of immediate neighbours/workers plus a wider commercial-street visitor audience | 31 | 14 | 0 | 31 |
| `toronto-neilson-medical-housing` | Neighbourhood and medical-destination scale; residents, workers, patient visitors and travellers | 43 | 14 | 0 | 43 |
| `toronto-lawrence-heights-revitalization` | Multi-block neighbourhood scale with wider housing interest; residents have a substantial majority | 76 | 14 | 0 | 76 |
| `toronto-fleet-property-lease` | Neighbourhood recreation destination plus broader sports interest; residents and visitors prominent | 48 | 14 | 0 | 48 |
| `toronto-six-points-road-closure` | Transport-node and neighbourhood audience; commuters and residents prominent, with uncertainty about listed parcels | 39 | 14 | 0 | 39 |

- Retained artifacts: [`manifest.json`](backend/data/demo-feedback/batch-1/manifest.json) and [`submissions.json`](backend/data/demo-feedback/batch-1/submissions.json). These preserve the final fictional records, audience assumptions, feature IDs/questions, synthetic-origin disclosure and verification summary. Temporary scripts, baselines and separate reports were deleted after verification, per the user-requested cleanup.
- Persistence used one MongoDB transaction and stable fictional IDs. An identical second run verified without writes or duplicate participants. Final records remain in `submissions.json`; the one-off generator, persistence scripts and before-state snapshots were removed after verification.
- Validation: current DTOs accepted all generated submissions; every feature rating uses a live feature ID. Position and connection counts sum to each proposal total. Feature distributions reconcile to baseline plus synthetic votes and sum to their respective response totals, never exceeding participants.
- Protection: `total_conditions` and the entire `condition_clusters` structure match the baseline's effective display data exactly for all six. The existing Labatt/River stored condition structure also matches exactly. The five proposals with no stored aggregate now have their original empty display condition structure stored alongside the votes; all remain at **zero conditions**, with no new condition evidence. Existing feedback, proposal source fields, features, history and status were preserved; all other proposal and feedback records matched baseline hashes.
- UI verification: all six Community panels at `http://localhost:5173/` displayed the verified totals, positions, connections and feature distributions, with zero conditions. At initial batch completion, ordinary comments were stored but not listed in the UI. The follow-up below replaces the static Overview examples with the saved comments; no condition-group workaround was used.
- Presentation context: identify these as synthetic demo responses when showing the vote panels; the batch artifacts explicitly disclose their origin. This batch did not add a new on-screen disclosure feature.
- Issues: none blocking persistence. The initial sandboxed connection attempt failed; access succeeded after authorized network escalation.
- **Stopped after batch 1. Next unfinished: batch 2, item 7 (`toronto-permit-parking-area-1e`).** Do not regenerate completed batch 1.

### Batch 1 follow-up — November 13, 2026 — saved comments and voice variation

- User requested Overview show saved comments instead of the generic “Example comments,” and asked for more varied grammar, punctuation, capitalization, vocabulary, length, seriousness and formality, including some exaggerated/NIMBY objections where relevant. Most comments should remain serious. This guidance is now in “Tips for convincing synthetic feedback” above for all future batches.
- User clarified that sample/illustrative data can be explained for the presentation as a whole; do not add repetitive disclosure text specifically to each comment.
- Overview now shows **Comments**, fetched from the selected proposal's stored submissions, labelled by primary place connection. Empty comments are omitted. Loading, no-comments and retryable error states replace the generic example list. Comments refresh on proposal changes and after saved feedback; multiline text is preserved.
- Revised **all 84 existing batch 1 synthetic comment texts**, without adding participants or changing ratings. Mixed short fragments, conversational phrasing, longer serious explanations and a small minority of exaggerated objections. Counts remain **299 synthetic participants / 84 comments**, and the original non-batch response remains untouched.
- Final revised records remain in [`submissions.json`](backend/data/demo-feedback/batch-1/submissions.json), with a comment-revision summary in [`manifest.json`](backend/data/demo-feedback/batch-1/manifest.json). Original comment payloads, revision instructions, before-state snapshots and standalone verification reports were removed after verification.
- Persistence updated only the 84 matching synthetic `feedback.comment` fields in a MongoDB transaction. All proposal documents, aggregates, votes, condition data and other feedback were verified unchanged; the verification summary is retained in the batch manifest.
- Validation: frontend production build/typecheck and all 10 existing tests passed. Browser verification recorded in the revision verification artifact. This supersedes the initial batch log's UI limitation: saved ordinary comments are now visible in Overview.
- This follow-up only revises batch 1 comments and the Overview display. It does not populate another proposal batch or change completion checkboxes. Use the current checkpoint for subsequent batch work.

### Batch 2 — November 13, 2026 — completed

- **Synthetic demonstration data only:** all new participant IDs use `demo-v1-`. These votes and voices are entirely fictional, not real public opinion, a representative poll, or an official consultation. Use the overall presentation disclosure retained in [`manifest.json`](backend/data/demo-feedback/batch-2/manifest.json).
- Saved **192 new synthetic participants and 69 ordinary comments** to configured MongoDB database `civic_hack`, collections `feedback` and `imported_proposals`. All generated submissions have `condition: null`. All six proposals had zero feedback at the read-only baseline.

| Proposal completed | Audience planning assumption (not researched) | New synthetic participants | Ordinary comments | Verified total |
| --- | --- | ---: | ---: | ---: |
| `toronto-permit-parking-area-1e` | Small local parking catchment around two Dundas West addresses; nearby households, permit users, prospective residents, workers and transit users | 28 | 12 | 28 |
| `toronto-lawrence-road-closure` | Small parcel-specific audience at Lawrence East/Ridgewood; nearby households and regular travellers, with uncertainty about the footprint | 19 | 9 | 19 |
| `toronto-aren-levy-lane` | Very small local naming audience near Vaughan/Ellsworth, with some neutrality and no assumed physical changes | 13 | 8 | 13 |
| `toronto-lawrence-heritage-intention` | Neighbourhood recreation destination at the Weston arena; local residents and recreation visitors prominent, plus workers and heritage interest | 36 | 12 | 36 |
| `toronto-weston-heritage-demolition` | Neighbourhood-scale mixed-use/heritage decision with wider housing and heritage interest; separate views on alteration, attribute removal and conservation planning | 52 | 14 | 52 |
| `toronto-stotts-bridge-heritage` | Twyn Rivers route catchment and recreational visitors; commuters, nearby households and heritage interest with mixed demolition/replacement views | 44 | 14 | 44 |

- Retained artifacts: [`manifest.json`](backend/data/demo-feedback/batch-2/manifest.json) and [`submissions.json`](backend/data/demo-feedback/batch-2/submissions.json). These preserve final fictional records, audience assumptions, current feature IDs/questions, synthetic-origin disclosure and verification summary. Temporary scripts, snapshots, superseded payloads, the extra README and separate reports were deleted after verification.
- Persistence: one MongoDB transaction, stable participant IDs, and no catalogue reseeding or participant replacement. An identical second run verified **without writes or duplicates**. DTO validation and feature-ID checks passed; all position/connection counts and feature distributions reconcile to the baseline plus the participant-level records.
- Protected data: `total_conditions` and the complete `condition_clusters` match the baseline’s effective display values exactly. These six proposals had no stored aggregate, so the original empty display condition structure was saved with the new votes. All remain at **zero conditions**, with no fabricated condition evidence. Source fields, features, history, status and all unrelated proposal/feedback data were verified unchanged by this batch.
- User-requested comment revision: all 69 ordinary comments were revised for varied lengths, punctuation, capitalization, vocabulary, grammar and formality, with most serious and a small number of exaggerated or NIMBY-style reactions. Future batches must follow the voice guidance above. This separate atomic write changed only comment text; every proposal document, vote, condition and unrelated feedback record was verified unchanged. The final voices remain in `submissions.json`, with the verification summary in the manifest; intermediate revision artifacts were removed.
- UI verification at `http://localhost:5173/`: all six Community panels displayed the verified participants, positions, connections and feature distributions with zero conditions. The current Overview Comments panels displayed the saved comment counts **12, 9, 8, 12, 14, 14** and ordinary comment text. Saved comments are visible through separate application work. No application/UI code changed by Batch 2; no condition-group workaround used.
- Presentation context: artifacts explicitly label the data synthetic. Use the disclosure for the presentation as a whole; no repetitive per-comment labels were added.
- Issues: none blocking completion. Initial sandbox DNS access was restricted; the configured database was reached through authorized network escalation. Unrelated-record hashes reflect verification time; later authorized batch/comment updates can change those historical hashes. No prepared-but-unpersisted proposals remain in Batch 2.
- **Stopped after Batch 2. Next unfinished: Batch 3, item 13 (`toronto-queen-heritage-amendment`).** Do not regenerate completed Batches 1 or 2.

### Completed-batch cleanup — November 13, 2026

- User requested minimal retained artifacts for all future completed batches: only final `submissions.json` and compact `manifest.json`. Temporary generation files and backups are deleted after persistence and verification succeed.
- Applied to Batches 1 and 2: removed 20 auxiliary files; kept four final data/manifest files. Updated retained manifests and this queue to summarize verification and remove stale artifact links.
- MongoDB data and application code were not changed by this cleanup. Batch 3 was left untouched.


### Batch 3 — November 13, 2026 — completed

- **Synthetic demonstration feedback only:** saved **293 fictional participants and 86 ordinary comments** to the configured MongoDB database `civic_hack`, collections `feedback` and `imported_proposals`. IDs use `demo-v1-`; all new submissions have `condition: null`. Explain synthetic origin in the presentation as a whole. These are not real public opinion, a representative poll or an official consultation.

| Proposal completed | Audience planning assumption (not researched) | New synthetic participants | Ordinary comments | Verified total |
| --- | --- | ---: | ---: | ---: |
| `toronto-queen-heritage-amendment` | Small local audience at Queen East/Parliament, nearby households and workers, visitors and broader heritage interest | 27 | 12 | 27 |
| `toronto-nightclub-definition` | Citywide reach, concentrated among small-venue staff/operators, neighbours, visitors and cultural-policy interest | 58 | 16 | 58 |
| `toronto-business-licence-action-plan` | Citywide sector-specific policy; second-hand/jewellery and entertainment workers, residents and business-policy interest | 46 | 14 | 46 |
| `toronto-street-vending-rules` | Citywide street-use audience; vendors, storefront workers, residents, commuters and visitors | 67 | 16 | 67 |
| `toronto-rentsafeto-fees` | Citywide rental-building audience; renters prominent, with building/social-housing workers and broader housing interest | 61 | 16 | 61 |
| `toronto-permit-parking-exclusion-process` | Citywide procedure with narrower permit-user, prospective-renter, housing-worker and regular-traveller interest | 34 | 12 | 34 |

- Retained artifacts: [`manifest.json`](backend/data/demo-feedback/batch-3/manifest.json) and [`submissions.json`](backend/data/demo-feedback/batch-3/submissions.json). The manifest retains the audience assumptions, current feature IDs/questions, synthetic-origin disclosure, per-proposal counts and verification summary. Temporary generation, snapshot, persistence and audit scripts, baseline and standalone reports were removed after completion under cleanup rule 9. No MongoDB records were deleted.
- Baseline: all six proposals had zero existing feedback. Read the live summaries, locations, source notice text and feature questions before generating voices. Current DTO validation and feature-ID checks passed for all records. Audience scale is a fictional planning assumption, separate from the chosen respondent counts.
- Persistence and reconciliation: one MongoDB transaction; only the six target proposal aggregates and new stable participant IDs were written. Saved submissions matched the prepared records exactly. Position and connection counts sum to each participant total; feature counts reconcile to participant ratings, sum to their own response totals and never exceed participants. An identical second run verified **without writes or duplicates**, and the fixed-seed generator reproduced the final records exactly.
- Protected data: `total_conditions` and the entire `condition_clusters` structure exactly match each proposal's baseline effective display values. All six remain at **zero conditions**. Their originally unstored empty display condition structures were saved alongside the votes. Ordinary concerns remain comment text; no grouping or condition evidence was created. Proposal source fields, current features, history and status were preserved.
- Browser verification at `http://localhost:5173/`: all six Overview panels showed saved ordinary comments and counts **12, 16, 14, 16, 16, 12**. Community participant totals, overall distributions, connections and every feature distribution matched the saved data; all condition panels remained zero. No application code was changed by this batch.
- Concurrent activity: the initial global hash check detected unrelated changes to `toronto-labatt-river-towers` and other feedback after the snapshot. This batch left them untouched and did not restore historical data. Unrelated proposal and feedback hashes remained stable during the final read-back verification. Exact unrelated feedback field differences cannot be inferred from the original hashes; the manifest records this limitation. Batch 3's six targets and condition comparisons all passed.
- Queue reconciliation: Batch 2 artifacts already reported completion when this request began; its 192 final records, 69 comments, totals, distributions and zero conditions were independently rechecked without writes. No completed batch was regenerated.
- **Stopped after Batch 3. Next unfinished: Batch 4, item 19 (`toronto-ravine-permit-fees`).** No prepared-but-unpersisted Batch 3 proposals remain.
