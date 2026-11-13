# CIVIC Hack judging and submission reference

**Source snapshot: November 12, 2026, Eastern.** The [official rubric](https://fciprojects.ca/hackathons/2026-civic-hack/) and [Devpost rules](https://civic-hack-2026.devpost.com/rules) establish scoring. The original [website HTML](sources/official/event-website.html) and [searchable website text](sources/extracted/event-website.txt) preserve the full 1/3/5 descriptors. This file paraphrases them for navigation.

## All scoring categories

| Area | Criterion | Points |
| --- | --- | ---: |
| Project | Problem and stakeholders | 10 |
| Project | Functionality and output quality | 15 |
| Project | Usability, design and feasibility | 10 |
| Project | Impact and practical value | 5 |
| Software | Requirements and UML design | 5 |
| Software | Architecture rationale and scaling | 5 |
| Software | Understanding source code | 5 |
| Software | References and attribution | 5 |
| Presentation | Municipal Readiness Report | 20 |
| Presentation | Demo video | 20 |
| **Total** | **Project 40 + software 20 + presentation 40** | **100** |

## Performance expectations

The organizer describes levels 1, 3 and 5. The following compact comparison is a paraphrase; consult the archived descriptors for nuance.

| Criterion | Weak | Meets expectations | Excellent |
| --- | --- | --- | --- |
| Stakeholders | Unclear need | Defined primary user | Multiple needs and trade-offs |
| Functionality | Core fails | Main task works | Checked, reliable outputs |
| Feasibility | Heavy rework | Guided use | Independent novice use |
| Value | Little improvement | Plausible incremental benefit | Credible transferable impact |
| Requirements | Incomplete/inaccurate diagrams | Essential requirements modeled | Testable requirements; accurate UML |
| Architecture | Unjustified structure | Choices tied to needs | Alternatives and bottlenecks evaluated |
| Code knowledge | Cannot explain code | Explains and verifies | Independently debugs and adapts |
| Attribution | Missing references | Reuse and AI disclosed | Traceable versions, licenses, verification |
| Report | Unsupported/incomplete | Answers all prompts | Evidence linked to pilot steps |
| Video | Unclear claim | Main feature demonstrated | Clear complete task and limitations |

## Important interpretation

The discussion initially included a teammate's claim that 60% was unrelated to the idea. The user and assistant did not retain that interpretation. The report needs a credible problem, evidence and adoption path; the video needs a meaningful working task; the software portion needs understandable design. Treat the percentages as evaluation weights, not a prescribed build-time allocation or permission to submit a weak core.

The rubric rewards evidence, useful operation, realistic municipal use and communication. It does not state a minimum number of frameworks, microservices, agents, AI models or features. It explicitly includes understanding and verification of generated/adapted code. A familiar stack can satisfy that expectation when it supports the actual task.

## Required submission package

1. **Repository URL.** Required; commits may be checked. A hosted working-demo URL is optional, while a working proof of concept remains expected by the challenge.
2. **Video lasting two to three minutes.** Must show the tool operating and identify its users. Over three minutes is excluded.
3. **One-page Municipal Readiness Report.** A linked PDF in the repository is acceptable according to the event description.
4. **Short description.** Explain the problem, intended users, solution and next work.

Submit through Devpost by **Saturday November 14, 2026, 10 a.m. Eastern**. All generation and editing stop then. There is no published late-submission allowance.

## Original submission template

Retained files: [original DOCX](sources/official/CIVIC-Hack_submission-template.docx), [extracted prompts](sources/extracted/CIVIC-Hack_submission-template.txt), [official download](https://fciprojects.ca/hackathons/2026-civic-hack/images/CIVIC-Hack_submission-template.docx).

The template is blank reference material, not a completed team report. It asks for project/team names, a UW contact email, and participant names, schools and programs. Its stated team rule is one to four people including a currently enrolled UW student, even though the table has more blank rows.

| Template field | Requested substance, paraphrased | Stated limit |
| --- | --- | --- |
| The problem | Identify the part of the selected problem addressed | 60 words |
| Your solution | Describe the build, intended users and use | 60 words |
| What changes | Explain the existing failure, improvement and impact scope | 30 words |
| Data sources and tools | List datasets/APIs/tools/AI, origins and assumptions; use allowed data | 60 words |
| What could be piloted today | Separate working/mocked parts and remaining resident needs | 40 words |
| Adopting or scaling it | Explain systematic adoption across municipalities and provinces | No word limit printed in the inspected template |

The template directs participants to save the completed page as a PDF and attach it to their Devpost project. Do not infer that blank field dimensions authorize exceeding the published one-page report requirement.

The website additionally asks about users, data/resources, approximate costs, privacy, what residents need to know, and adaptation elsewhere. These are not all separate template boxes. Address both the template and website expectations compactly. The sources do not establish that any particular appendix or extra report will be read; ask organizers if a genuine format conflict remains.

## Where software evidence fits

The rubric names requirements, UML, architecture choices, scaling, code knowledge and attribution but does not specify a separate mandatory upload for each. Repository documentation is a practical place to make these reviewable; that is an implementation suggestion rather than an additional organizer deliverable.

Useful evidence would include testable requirements tied to the actual task, diagrams that match the final build, reasons for choosing the architecture over alternatives, meaningful checks and failure handling, known limitations, dependencies/versions/licenses, and a precise account of AI assistance and verification. Avoid writing documentation for planned architecture as though implemented.

## Video guidance from the organizer

The site prioritizes a clear user/problem, a working task shown early, a visible improvement over the existing process, identified data and assumptions, disclosure of mocked parts, and a pilot path. It suggests screen recording with understandable narration, corrected captions and tested viewing access. Leave submission time; the site's suggested buffer is at least three hours. Do not assume an elaborate edited introduction is required.

These recommendations are distinct from the mandatory duration limit and core scoring criteria. The exact public tips are retained near the end of [website text](sources/extracted/event-website.txt).

## Judging sequence

Round one begins at 10:30 a.m. Saturday with asynchronous review of submitted videos and reports. Five finalists are announced at noon. The 12:30 p.m. showcase gives each finalist five minutes for a pitch/live demo and three for questions. Panel feedback follows at 1:30 p.m.; awards at 1:45 p.m. No guarantee was found that judges will run every repository or inspect every supplemental document during round one.
