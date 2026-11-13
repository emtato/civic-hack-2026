# proviso

A municipal proposal explorer and feedback prototype built for CIVIC Hack 2026. See the [frontend guide](frontend/README.md) and [API guide](backend/README.md) for setup.

The existing `civic_hack` MongoDB database name is retained for data compatibility; `MONGODB_DATABASE` selects a different database if needed. Browser storage uses the `proviso` prefix and reads legacy `civic` keys to preserve saved proposals and responses.

## Event context archive

**Historical planning snapshot:** Challenge 1 selected; problem discovery; no project chosen at the time. This record captures the event and the conversation through November 12, 2026, Eastern time. Retrieval timestamps and file hashes are in the [source manifest](sources/manifest.json).

Start future CIVIC chats with [the event instructions and handoff](civic-hack-main-prompt-instructions.md), then read the relevant references below. The most recent user preference is to start from consequential real user problems and participation barriers. Earlier recommendations centered on information explainers were shelved.

| File | Purpose |
| --- | --- |
| [Event instructions and handoff](civic-hack-main-prompt-instructions.md) | Current objective, user preferences, accepted corrections, scope, and how to resume |
| [Event overview](overview.md) | Organizer, eligibility, rules, exact schedule, prizes, support, and source discrepancies |
| [Judging and submission](judging-and-submission.md) | All scoring categories, performance expectations, deliverables, and actual template prompts/word limits |
| [Selected Challenge 1](challenge-1.md) | Detailed problem, stakeholders, success requirements, constraints, data, and research questions |
| [All five themes](themes.md) | Theme map, detailed summaries of the four unselected themes, datasets, and boundaries |
| [Discussion context](discussion-context.md) | Initial ideas, why they were set aside, current search direction, research leads, and uncertainties |
| [Source archive](sources/README.md) | Five original PDFs, original DOCX template, website snapshot, searchable text, PDF hyperlinks, and provenance |
| [Initial idea guide](idea-guide.md) | Historical first-pass guide; its recommendation and initial shortlist are superseded |

## Facts future chats should retain

- Only **Making municipal decisions easier to understand** is the selected challenge. The other four are background, not alternative tracks that teams can freely choose.
- The selected question includes effects on residents and opportunities to participate. A useful project can center on these, while still satisfying the brief's source, status, clarity, and real-item requirements.
- Published cutoff: **Saturday, November 14, 2026, 10:00 a.m. Eastern**. Code, report, video, and other edits all stop then.
- Scoring: **project 40, software 20, presentation 40**. The report and video are each worth 20.
- A working proof of concept is expected. A hosted prototype URL is optional; this does not make working functionality optional.
- The user wants teaching and collaboration on code. Do not implement a project or supply a full solution unless specifically asked. Exporting this context authorized repository documentation and source archiving only.
- No 3D rendering or traffic forecasting for the current idea search. Games and other interactions remain possible if they provide a worthwhile capability.
- Use HTV research as evidence-backed inspiration. Awards do not explain their own causes or validate claimed benefits.

The previous Hack the 6ix research remains paused at its existing checkpoint. This event export does not resume that research or create new cross-event findings.
