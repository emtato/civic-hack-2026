# Selected Challenge 1 municipal decisions

**Selected challenge, confirmed at launch.** The user reported that only the first theme was selected; the Devpost live announcement confirms it. Other themes remain background only.

Original sources: [archived PDF](sources/official/CIVIC-Hack_brief-1_municipal-decisions.pdf), [full extracted text with page labels](sources/extracted/CIVIC-Hack_brief-1_municipal-decisions.txt), [hyperlinks embedded in the PDF](sources/extracted/CIVIC-Hack_brief-1_municipal-decisions.links.json), and [official URL](https://fciprojects.ca/hackathons/2026-civic-hack/images/CIVIC-Hack_brief-1_municipal-decisions.pdf). The archived PDF is byte-identical to the user's attachment, verified in [manifest](sources/manifest.json).

## Official question and deliverable

> How might we help residents understand a proposed municipal decision, how it could affect them, and when they can have a say?

The organizer asks for a working proof of concept a municipality could realistically pilot. Format is flexible: web application, map, data tool, dashboard or another appropriate format. A municipal leader should be able to operate it without the team present. Flexibility of format does not remove the accuracy and resident-use requirements below.

## Problem described in the brief

Municipal decisions shape everyday life through zoning, budgets, bylaws, transit, infrastructure, cycling facilities, development applications, fees and service levels. Relevant information is spread over agendas, minutes, staff reports and decisions, sometimes spanning hundreds of pages and using planning/legal terminology.

Residents may not discover a decision early enough, recognize its relevance, interpret what changes for them, or identify a remaining opportunity to influence it. Participation happens at specific points, including notices, public meetings, speaking-registration deadlines and comment periods. Learning about an issue when construction starts can be too late for the original decision.

The source record itself changes. Agendas acquire new material; committee recommendations and council decisions can differ; motions can amend conditions. An accurate explanation may require connecting several records rather than summarizing one report. A meeting date, a recommendation, a recorded vote and an adopted final decision have different meanings.

The brief identifies delays/rework from late opposition, uneven participation, and lost trust as possible costs. It specifically mentions renters, newcomers, students and shift workers as voices that may be missed. It also notes that an application alone excludes people who are offline.

## Claimed background figures and provenance

These are figures cited by the organizer's brief, not statistics independently audited in this export:

- 20% of Canadians have ever participated in municipal public consultation and 9% report being very likely to do so in future, attributed to Ipsos/Municipal World.
- Ontario's 2022 municipal turnout was about 36%, versus 38.3% in 2018, attributed to AMO; the brief also makes a historical comparison over four decades.
- A Toronto survey identified difficulty finding information and lack of awareness of input opportunities as leading obstacles.

Use the original studies before relying on sample definitions, trend claims or numerical comparisons in the team's pitch. An organizer's prevalence figure does not establish demand for a particular app.

## Intended users and stakeholders

| Group | Roles and needs named by the brief |
| --- | --- |
| Primary residents | People unfamiliar with council processes; renters, newcomers, youth, older adults, people with lower literacy or limited English |
| Community users | Groups and residents wanting to know what was decided and how it affects them |
| Municipal operators | Clerks, communication and engagement staff maintaining accurate explanations and participation information |
| Elected-office users | Councillors and staff communicating with constituents |
| Other affected people | Local businesses, associations and people affected by a decision |
| Monitoring users | Local journalists and civic advocates |

The primary brief is resident-facing, but municipal users are explicitly included. A back-office or engagement tool needs a clear connection to resident consequences or participation. The user's preferred emphasis is recorded separately in [discussion context](discussion-context.md); it is not a change to the official stakeholder list.

## Questions the organizer invites teams to investigate

1. Why are agendas, minutes and reports difficult to use, and which details must survive simplification?
2. How can someone follow a proposal across meetings and distinguish proposed, decided and still-open matters?
3. When and how is input possible, and how can an opportunity be made visible before it expires?
4. What information makes effects on a person or neighbourhood meaningful?
5. How can a municipality show that input was considered even when the outcome did not change?
6. How can municipal staff communicate clearly while keeping information current, accurate and connected to records?

These questions define room for investigation. They do not mandate an AI summarizer, a map, notifications, a chatbot or any other specific interaction.

## What success must show

The brief expects the tool to take a real decision or staff report and convey:

- The proposal and its reason.
- Who and where it affects, including geographic relevance.
- Important dates and the verified means/timing of participation.
- A source document for each claim, including relevant amendments and conditions.
- Awareness of people the experience may exclude.
- Accuracy and neutral tone on **two or three real agenda items**.
- Independent use by a municipal leader and a plausible public-understanding benefit.

Source links should point to exact supporting passages, not merely to a city homepage or an unrelated report. A genuine quotation can still misrepresent a decision if its condition, exception or procedural stage is dropped.

## Explicit constraints

- Preserve the distinction between staff advice, committee action and final council action. Some bodies have delegated authority; do not impose a universal stage sequence without checking the record.
- Date explanations and show their sources.
- Preserve uncertainty, important conditions and exceptions. Check AI-produced statements against the records.
- Confirm participation details on the official item page. **Do not derive a submission deadline solely from a meeting date.**
- Use accessible, clear language. Avoid unnecessary personal information from public correspondence.
- Keep communication neutral and non-partisan.

The brief treats an inaccurate decision summary as a serious failure. The same accuracy obligations apply if the interface centers on participation or consequences rather than reading.

## Technical considerations named by the brief

PDF structure and parsing can be inconsistent. Decisions, places, dates and recommendations may be difficult to extract. Summarization can distort or invent facts. Location matching may require addresses, legal descriptions, boundaries and maps. Personal relevance can depend on tenure or travel patterns, raising data-minimization issues. Notice, meeting, decision and appeal stages need consistent temporal meaning. Accessibility considerations include plain language, translation, mobile use and WCAG.

These are considerations rather than a required checklist of technologies. Neither 3D rendering nor traffic simulation appears as a mandatory technique. The user's current search excludes both.

## Starter datasets and limits

| Dataset | Useful contents and role | Interpretation limits |
| --- | --- | --- |
| [Report Request Log — City Council and its Committees](https://open.toronto.ca/dataset/report-request-log-city-council-and-its-committees/) | Adopted requests for staff reports, originating item references, reporting timeframes and status; a lead to related records | It covers report requests, not all decisions. A request marked closed does not prove delivery of a broader pledge or physical project. |
| [Council Voting Record](https://open.toronto.ca/dataset/members-of-toronto-city-council-voting-record/) | Recorded votes, item references, motion descriptions and results | A vote can concern an amendment. Not all decisions have a recorded vote. A result alone does not establish the complete substantive decision. |

The user pasted a shorter Report Request Log URL, https://open.toronto.ca/dataset/report-request-log/, which failed to open in the research browser. The longer URL above is embedded in the official PDF and is the resolved catalogue lead. The original shorter link is preserved here as provenance, not a second dataset.

Other allowed public sources include municipal agendas, minutes, decisions, staff reports, development applications, zoning, ward boundaries, public notices, engagement pages and accessibility/plain-language guidance. Starter datasets are optional; use other public data when it better supports the task and cite it.

No complete data-resource ingest, schema audit, refresh test or production API integration has been completed. Catalogue links and PDFs establish leads, not guaranteed current machine-readable access.

## Official background links

The PDF's hyperlink annotations contain:

- [Toronto council records](https://secure.toronto.ca/council/).
- [Participating in council/committee meetings](https://www.toronto.ca/city-government/council/council-committee-meetings/participate/).
- [Be informed](https://www.toronto.ca/city-government/council/my-local-government-its-for-me/be-informed/).

The extracted annotations preserve the URLs directly even where display labels and bibliography ordering are imperfect.

## Evidence and scope for our project search

The user now wants to investigate consequences and meaningful participation, starting with people who already have a practical reason to act. Potential outcomes include recording an essential access need, presenting evidence of an adverse effect, securing a mitigation, reducing the burden of participation, or coordinating a group request. These are current discussion directions, not official additional requirements or validated product ideas.

Any project should still explain enough of the decision, its effects, provenance, current stage and participation context to satisfy this brief. An unrelated business-operations app, generic organizing platform or general service finder does not acquire challenge fit merely by naming a municipality.
