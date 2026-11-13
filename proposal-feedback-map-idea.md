# CIVIC idea: proposal feedback map with conditional support and revision rounds

**Context snapshot: November 13, 2026, America/Toronto.** This is the current candidate developed in discussion, not a finished specification or implemented product. It is intended to provide enough context to continue the idea in another chat without replaying the conversation. This document records the agreed direction, user-proposed behaviour, recommended safeguards and optional extensions separately. It does not authorize project implementation; the user prefers to learn and implement code themselves unless they explicitly request otherwise.

## Short summary

A map-based participation tool connected to real Toronto municipal proposals. Residents select a proposal, see what is changing and when input is possible, then give both an overall position and feedback on specific elements. They can explain concerns, identify affected locations and state conditions such as “I support the redesign if accessible pickup remains near this entrance.” AI helps organize contributions into inspectable groups of specific needs, objections and possible compromises. The map and dashboard show distributions and reasons rather than reducing everything to a single approval score.

When the city revises a proposal, previous participants are notified and can update their responses. The tool tracks which conditions appear addressed, which remain unresolved and how the same participants' positions change across versions. Previous answers could be carried forward when relevant conditions remain unchanged, with their review status clearly distinguished from fresh confirmation. The intended integration is an experience usable within Toronto's proposal or consultation pages, linked to official records and an existing staff review process. It fits CIVIC's selected challenge by connecting an understandable municipal decision to personal consequences, timely participation and visible follow-through, without assuming continuous individual negotiation with staff.

## Problem, users and intended value

The resident has a stake in a proposed decision: a street redesign, public-space change, development proposal or other municipal action. They want to express what works, what creates a problem and what would make an alternative acceptable. The municipal reviewer needs to understand those contributions without reading every comment repeatedly or treating every objection as opposition to the whole project.

Primary users are affected residents, businesses and community groups. Municipal engagement, planning, communications or elected-office staff review the results. People unfamiliar with council processes should still be able to complete the core interaction.

The intended value is more specific feedback with less repeated work: residents retain control of their position, staff see actionable concerns, and both can follow how feedback relates to a revised proposal. These benefits are hypotheses to demonstrate and test, not measured outcomes. Participation does not guarantee a preferred decision.

## Core resident interaction

1. **Find a real proposal on a map or arrive from its municipal page.** Show the actual project area or relevant features. An overview map could use colours, markers or layers to communicate participation results and proposal status; the exact legend is undecided. Keep procedural status separate from public opinion. A lack of responses is not agreement.
2. **Open the proposal.** Explain what is proposed, why, who and where it affects, the current stage, what remains open to influence, and the verified means and timing of participation. Link claims to official records and relevant passages. Identify the proposal version the person is reviewing.
3. **Give an overall position.** A scale from strongly oppose to strongly support is a candidate interaction. Include a separate unsure/not-enough-information option. Show the distribution and respondent count; a neutral average can conceal a split between strong supporters and strong opponents.
4. **Respond to specific elements.** Questions or ratings should depend on the proposal's context: delivery arrangements, accessible pickup, pedestrian space, operating hours, or another relevant change. Someone can support the project overall while opposing one provision. A map pin should normally identify the affected place, not require a home address.
5. **Explain the concern or condition.** Permit free text and optionally supporting evidence. AI can suggest a clearer structured interpretation, but the contributor confirms or edits it. People should not have to write a long formal submission to express a concrete need.
6. **Follow the proposal.** Participants can see the aggregate, inspect relevant contributions and return when the proposal changes. Posting here counts as an official submission only if the municipality has actually adopted that route; otherwise the official participation route remains explicit.

## Conditional support: position, concern and requirement

Preserve three distinct meanings:

| Contribution | Meaning |
| --- | --- |
| “I oppose this proposal.” | Current overall position. |
| “I am worried about deliveries.” | A concern; it does not establish what would change the person's position. |
| “I would support it if loading were available near my shop from 7–9 a.m.” | Explicit conditional support tied to a requirement. |

Conditions can include place, time, access needs and acceptable arrangements. Distinguish essential requirements from preferences when the person can do so. A condition should not become a claimed willingness to compromise unless the participant confirms that meaning.

Contributions on the same topic may require different solutions. Commercial deliveries and accessible passenger pickup may both concern curb space but have different requirements. Requests to keep and remove the same feature conflict; they must not be merged merely because their wording is similar. Preserve the originals and let people reject an incorrect grouping.

## Aggregation and the municipal view

The dashboard should answer: what specific concerns recur, which conditions explain support or opposition, where do they apply, and what remains unresolved?

An illustrative aggregate might say:

> Twenty participants would support the redesign if loading access were preserved. Three business respondents specify morning delivery hours. Five participants remain strongly opposed for other stated reasons.

The three business respondents may be a subset of the twenty; show overlap rather than automatically adding categories. Count distinct contributors separately from comments, ratings and requirements. Describe business/resident roles as self-reported unless actually verified; do not infer identities or sensitive traits from language.

Useful views include overall and element-specific rating distributions, concern categories, conditional support, location filters and unresolved requirements. Every aggregate should lead back to supporting contributions. Small but consequential access needs remain visible even when another topic dominates counts. Results describe participating contributors, not a representative vote of Toronto or the neighbourhood.

A topic summary such as “parking concerns” is insufficient when staff need to distinguish delivery hours, accessible pickup and a general preference for parking. Likewise, a concern is not a feasible compromise until a concrete arrangement has been examined by the appropriate people.

## Revision rounds and response continuity

The user-proposed negotiation mechanism is a repeated consultation cycle:

1. Residents respond to version 1 and confirm their conditions.
2. The city publishes a revised proposal at an appropriate project milestone.
3. Previous participants are notified, ideally with the changes relevant to their contributions.
4. They review and update their position or confirm it remains the same.
5. Staff see changes in support, newly raised issues and conditions still awaiting attention.

This allows a municipal revision to function as a response to collected feedback without requiring staff to negotiate continuously in individual threads. The city still decides which changes are possible; no commitment to satisfy every request is implied.

### Automatic reuse: desired behaviour and safeguards to decide

The user proposed automatically reusing a previous rating when a revision clearly does not affect the person's requirements, while still notifying them and allowing changes. This remains part of the intended concept. The exact consent model and rules for deciding that requirements are unaffected have not been finalized.

Recommended response states are:

| State | What it establishes |
| --- | --- |
| Reconfirmed | The participant reviewed this version and submitted or confirmed a position. |
| Carried forward | The previous response is retained, but this version has not been reviewed by that person. |
| Needs review | A relevant condition changed, or its relationship to the revision is uncertain. |

An optional standing-response permission could let someone authorize reuse while specified conditions remain unchanged. Label that as an authorized standing response, separately from a fresh review. Without such permission, retaining an old response should not silently create a new confirmation.

Recorded requirements may be incomplete. A revision can introduce a new concern that the person never needed to mention before. AI assessment that a condition appears satisfied is therefore distinct from the person's satisfaction or support. Ambiguous changes should trigger review rather than a confident automatic decision.

For comparison across rounds, show results for participants who responded to both versions as well as the full results for each round. Report new participants, nonresponses and carried-forward answers separately. A more supportive second round may reflect a different respondent group; it does not by itself establish that the revision caused greater support.

## Concrete example

A resident supports a street redesign on the condition that accessible pickup remains near an entrance during evening appointments. Businesses raise a related but separate need for morning deliveries. The map shows both concern locations and preserves their different requirements.

The city publishes version 2 with a new loading arrangement. The tool points to the relevant plan changes, flags which recorded conditions may be affected, and asks focused follow-up questions. The resident might confirm that the revised pickup location works, identify that evening availability remains unclear, or update their position for another reason. Staff receive an aggregate showing confirmed changes in response and unresolved details. This is an illustrative interaction, not an assessed street design or a promise of an actual municipal response.

## Integration and municipal realism

The user wants to retain this idea despite competition. The candidate differentiator can be a meaningful improvement in integration and use for Toronto; it need not invent a new participation mechanism.

The intended experience could sit within a proposal or consultation page, preserve the official item context, connect versions and source records, and feed an existing staff review process. Embedding is a proposed deployment route, not an established permission or technical integration. A prototype can show an embeddable component in a clearly labelled sample page using real records. Actual deployment on the city's website requires municipal ownership and access.

Toronto already operates [Have Your Say](https://haveyoursay.toronto.ca/) using Social Pinpoint. Do not claim that Toronto lacks a participation platform. “Better integration” needs a concrete demonstrated advantage over the current experience: fewer context switches, clearer links between item and version, easier reconsideration, or a better staff handoff. No hands-on comparison or confirmed gap has been completed.

Some municipal decisions have required consultation procedures, but consultation is not a promise of negotiated agreement or unanimous approval. The exact obligations depend on the decision. Ontario's [zoning guidance](https://www.ontario.ca/document/citizens-guide-land-use-planning/zoning-bylaws) describes council deciding after public input. Toronto's [Esplanade record](https://www.toronto.ca/community-people/get-involved/public-consultations/infrastructure-projects/the-esplanade-mill-street/) connects feedback to an accessible loading zone; [Kensington's record](https://www.toronto.ca/community-people/get-involved/public-consultations/infrastructure-projects/kensington-market-construction/) documents multi-round engagement and design changes. These establish relevant practice, not demand for this software.

This is feedback about proposed decisions. General pothole/report-and-repair mapping would be a different product with substantial [Toronto 311](https://www.toronto.ca/home/311-toronto-at-your-service/311-mobile-apps/) overlap and weaker direct fit to the selected challenge.

## AI's role and purposeful technical work

AI can help extract contributor-confirmed concerns and conditions, suggest related contributions, organize inspectable aggregates, and identify potentially relevant changes in new proposal records. Counts should be computed from recorded data, with the interpretation behind each category visible. AI should not invent public opinion, infer acceptance, promise feasibility or make the municipal decision.

Potential engineering depth lies in preserving meaning across grouping and revisions, keeping version-specific responses accurate, explaining uncertain matches and carrying corrections through the resident and staff views. No stack, model, database, notification channel or architecture has been selected. No 3D rendering or traffic forecasting is wanted for this event.

## Optional improvements, not agreed scope

These suggestions fit the core but should earn their place through a useful task:

- **Consolidated clarification questions.** Detect repeated unanswered questions such as “What hours will this operate?” Staff can answer a shared question once at a review milestone, with the answer linked back to affected conditions.
- **Personal participation receipt.** Show each contributor their submitted position, confirmed conditions, version reviewed and subsequent changes. This makes it easier to spot an incorrect interpretation and resume later.
- **A staff view of what is new.** Separate genuinely new concerns or evidence from repeated comments and already reviewed material. Preserve reviewer decisions when aggregates are recomputed.
- **Feedback on a precise plan feature.** Attach a concern to an entrance, loading segment or proposed facility rather than a vague neighbourhood pin. Before/after feature overlays are a possible extension if reliable spatial records exist.
- **Source-linked bulk explanations.** Staff can attach one explanation of a constraint or declined change to multiple relevant concerns. Distinguish reason provided, request accepted, condition met and change implemented.
- **Low-friction and accessible participation.** Direct project links or QR codes, mobile and keyboard use, plain language, and an equivalent list view for people who cannot use the map. Voice, translation or offline intake are possible extensions with accuracy and data-handling work of their own.
- **Participation coverage indicators.** Display response counts, unanswered questions and differences in participation across areas or voluntarily supplied roles. Avoid interpreting a quiet area as satisfied or automatically claiming representativeness.
- **A small set of supplied alternatives.** Let participants assess specific versions or arrangements under the same confirmed requirements. Automatic generation of feasible plans or a general negotiation solver is outside the current core.

## Originality research and current judgment

Public documentation checked on November 13, 2026 establishes substantial precedent:

| Existing system | Relevant documented overlap |
| --- | --- |
| [Commonplace](https://www.commonplace.is/blog/introducing-design-feedback-for-commonplaces) | Proposal-specific comments, mapped engagement, themes and sentiment dashboards. |
| [Maptionnaire](https://support.maptionnaire.com/hc/en-us/articles/28479260162972-Turn-map-comments-into-actionable-insights) | Map comments, hotspots, AI concern grouping and comparisons between respondent groups. |
| [Go Vocal](https://support.govocal.com/en/articles/609603-finding-common-ground) | Trade-off statements, agree/unsure/disagree reactions and visible alignment. Its documented Common Ground method fixes votes, but this limitation does not apply to all its methods. |
| [LiquidFeedback](https://principles.liquidfeedback.org/The_Principles_of_LiquidFeedback_1st_edition_online_version.pdf) | Conditional support and suggestion requirements on printed pages 61–62; draft updates, notifications, continued support without a new response, and latest-draft acknowledgement on page 68. These mechanisms were documented in 2014. |
| [Loomio](https://www.loomio.com/docs/en/guides/making_decisions/consent_process) | Amending proposals in response to objections, notifying participants and asking them to reconsider in successive rounds. |

The research was a public-documentation check, not hands-on benchmarking. Neither broad public familiarity with LiquidFeedback nor these judges' awareness was established. Its obscurity should not be the originality strategy. Automatic source-linked checking of a real municipal revision against individual confirmed requirements remains a possible differentiator; no exact match was identified in the reviewed sources, which does not establish market-wide absence.

The final discussion position is to continue with the concept and evaluate a meaningful local improvement rather than keep pivoting solely because precedent exists. Do not claim firstness or measured superiority. Assess against Toronto's actual workflow as well as abstract competitors. A small difference can be worthwhile if its consequence is demonstrable; branding alone does not establish that consequence.

The repository's completed HTV synthesis supports this approach: compare the same person's task, locate a useful difference, direct engineering at protecting it, and demonstrate the legitimate next action. The HT6 category findings similarly emphasize meaningful handoffs and inspectable correction. These are design lessons, not a formula for winning; no completed cross-event synthesis or validated civic outcome is implied.

## CIVIC fit and a plausible proof of concept

Only Challenge 1, **Making municipal decisions easier to understand**, was selected. The brief asks how residents can understand a proposal, recognize its effects and know when to participate. It also explicitly asks how a municipality can show that input was considered even when the decision did not change. This concept addresses those tasks through proposal context, location-specific feedback and revision follow-through.

The tool still needs source-linked explanations, correct proposal/decision status, verified participation details, important conditions and uncertainty, neutral language and consideration of excluded users. The brief expects accuracy checks on **two or three real agenda items** and independent municipal use. Deeply demonstrate one interaction while checking the others; do not substitute a wholly fictional proposal for the required real-item evidence.

A useful prototype would show a real proposal, a confirmed conditional response, an inspectable aggregate, a disclosed revision or historical revision replay, and a participant reconsidering that version. Simulated contributions, notification delivery or municipal participation must be labelled. Historical cases must not appear open for current input. Use public/open/organizer-provided data under the event rules; do not assume private correspondence or live personal data is available.

Check the failure cases that protect the concept: same topic/opposite request, overlapping participant groups, an omitted minority condition, an uncertain revision, and carried-forward support being distinguished from a fresh response. Compare the distinctive task with a plain list or spreadsheet using review effort, missed requirements, incorrect groupings and traceability. No benefit has yet been measured.

The [official rubric](https://fciprojects.ca/hackathons/2026-civic-hack/) assigns project 40 points, software 20 and presentation 40. It explicitly accepts incremental improvement under practical value; it does not require an unprecedented participation mechanism. Required deliverables are a repository, a 2–3 minute video, a one-page Municipal Readiness Report and a short description. Published cutoff is **November 14, 2026, 10 a.m. Eastern**, when all building and editing stop.

## Decisions still open

- Which real proposal and revision provide a useful, sufficiently detailed example?
- What specific friction in Toronto's present experience will the prototype improve?
- Which contextual ratings and condition fields are necessary for that example?
- How should automatic reuse be authorized, assessed and labelled?
- What municipal team would own the workflow, and what input/output would fit its existing process?
- Which optional improvements justify their scope during the event?

No final product name, team capacity, stack, municipal partner, production integration or validated demand has been established. This summary authorizes no submissions, outreach or project code changes. Older repository handoffs describe an earlier problem-discovery stage; for this candidate, this document records the later direction while official event sources continue to govern event facts.
