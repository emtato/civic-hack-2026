# CIVIC Hack 2026 theme reference

**Only Theme 1 was selected.** The other four were pre-vote alternatives and are retained for context. Do not choose an unselected theme as an independent competition track. The complete organizer briefs, page-labeled searchable text and embedded links are saved locally; the summaries below are navigation aids.

## Theme map

| Theme | Central subject | Status |
| --- | --- | --- |
| 1. Making municipal decisions easier to understand | A proposal, its effects on residents, and opportunities for input | **Selected** |
| 2. Finding gaps in transit access | Practical access to essential destinations across places/times | Background only |
| 3. Making long-term infrastructure costs visible | Upfront versus lifecycle financial/environmental costs | Background only |
| 4. Tracking a city's commitments | Dated evidence of progress against public targets | Background only |
| 5. From housing approval to construction | Distinct development milestones and gaps between records | Background only |

## Shared framing

All five briefs call for a working proof of concept a municipality could plausibly pilot, with flexible format and independent use by a municipal leader. They allow other suitable public data and require sources, dates, visible assumptions and limitations. Teams should explain users, design decisions, output checks, instructions, pilot needs and any AI role. A dataset's presence does not establish that it supports the desired conclusion.

The original sources include background statistics and referenced studies. Those assertions remain in the source text; this export did not independently audit every underlying study, numerical estimate or legal provision.

## Theme 1 selected

See [detailed Challenge 1](challenge-1.md): proposal meaning, personal/local effects, procedural status and verified participation. Its primary residents include people unfamiliar with municipal processes. Source passages, material conditions and neutrality matter; two or three real agenda items should be checked.

Original: [PDF](sources/official/CIVIC-Hack_brief-1_municipal-decisions.pdf), [text](sources/extracted/CIVIC-Hack_brief-1_municipal-decisions.txt), [links](sources/extracted/CIVIC-Hack_brief-1_municipal-decisions.links.json).

## Theme 2 transit access

Purpose: find practical barriers to reaching essential destinations and compare service changes, including access to/from stops. Nearby routes alone cannot establish useful trips at required times. The brief covers waits, transfers, early/late/weekend service, walking conditions and different mobility needs.

Primary operators are transit planners; affected residents include shift workers, students, caregivers, older adults and people with mobility limitations. Intended benefits concern jobs, health, food access and inclusion.

Success means identifying specific weak places/times, explaining criteria, and comparing one or two improvements with resource and coverage/frequency trade-offs. Define accessibility thresholds and use valid feed calendars. Scheduled times do not measure actual reliability; straight lines do not establish accessible walking routes. Population claims need geographic evidence.

Data leads: [TTC GTFS](https://open.toronto.ca/dataset/merged-gtfs-ttc-routes-and-schedules/), [library locations/hours](https://open.toronto.ca/dataset/library-branch-general-information/), [GRT feeds](https://www.grt.ca/about-grt/open-data/) and [feed listing](https://mobilitydatabase.org/feeds/gtfs/mdb-721), plus Statistics Canada table 23-10-0314-01 via the [June 2026 release](https://www150.statcan.gc.ca/n1/daily-quotidien/260610/dq260610e-eng.htm). Libraries are example destinations, not a complete essential-services inventory. Check table joins and feed dates.

Original: [four-page PDF](sources/official/CIVIC-Hack_brief-2_transit-access.pdf), [complete text](sources/extracted/CIVIC-Hack_brief-2_transit-access.txt), [all embedded URLs](sources/extracted/CIVIC-Hack_brief-2_transit-access.links.json).

## Theme 3 infrastructure lifetime costs

Purpose: compare construction spending with operation, maintenance, renewal, replacement and environmental burdens across decades. Cheap construction may create larger later obligations, while construction grants may leave local upkeep unfunded.

Users include residents/ratepayers, finance staff, asset managers, operations staff and councillors. Service users and future residents bear consequences. Success means comparing stated service options over an explicit period and allowing important assumptions to change.

Define asset, service, study period, price year and included costs. Keep spending categories distinct; avoid duplication. Explain inflation/discounting and test major uncertainties. Operational emissions omit construction impacts; disclose boundaries and any monetary conversions.

Data leads: [ten-year capital plans by ward](https://open.toronto.ca/dataset/budget-capital-budget-plan-by-ward-10-yr-approved/) (amounts in thousands; allocations are not necessarily actual or full lifetime spending), [building utility records](https://open.toronto.ca/dataset/annual-energy-consumption/) (linked facility/meter records; missing costs are not zero; no direct GHG total), [Ontario FIR](https://efis.fma.csc.gov.on.ca/fir/index.php/en/open-data/), and [Statistics Canada infrastructure tables](https://www150.statcan.gc.ca/n1/daily-quotidien/241021/dq241021b-cansim-eng.htm), including 34-10-0284-01 and 34-10-0289-01. Municipal asset plans supply further context.

Original: [four-page PDF](sources/official/CIVIC-Hack_brief-3_infrastructure-costs.pdf), [complete text](sources/extracted/CIVIC-Hack_brief-3_infrastructure-costs.txt), [all embedded URLs](sources/extracted/CIVIC-Hack_brief-3_infrastructure-costs.links.json).

## Theme 4 public commitments

Purpose: connect a public pledge with evidence of delivery, preserving target revisions, reporting gaps and uncertainty. Reports, budgets and dashboards can use inconsistent definitions and timeframes.

Users include residents, advocates, journalists, councillors, delivery/reporting staff and partner agencies. Success requires an identifiable original promise, responsible organization, target/deadline where available, dated evidence, defined status and an update plan.

Separate actions, spending and outputs from outcomes. Compare compatible measures, dates and organizational boundaries. Preserve revisions. Missing updates do not prove inactivity; measurement dates differ from publication/retrieval dates. Municipal action is not necessarily the cause of a change.

Data leads: [City building energy records](https://open.toronto.ca/dataset/annual-energy-consumption/) and [renewable installations](https://open.toronto.ca/dataset/renewable-energy-installations/), with strategic plans, budgets and progress reports. The building file lacks direct emissions and an established comparable 2008 baseline. Installation capacity differs from annual energy generated; technology/units must match before aggregation. The brief illustrates this with City-building emissions and renewable-capacity targets, whose underlying references remain in the source.

Original: [three-page PDF](sources/official/CIVIC-Hack_brief-4_city-commitments.pdf), [complete text](sources/extracted/CIVIC-Hack_brief-4_city-commitments.txt), [all embedded URLs](sources/extracted/CIVIC-Hack_brief-4_city-commitments.links.json).

## Theme 5 housing delivery milestones

Purpose: connect planning approval, subsequent conditions, permits and physical construction while exposing what public records cannot explain. Financing, demand, servicing, labor and material constraints may affect delivery without appearing in planning data.

Users include residents awaiting homes, neighbours, housing/planning staff, providers, developers, utilities and funders. Success means tracing well-defined projects/phases, preventing duplicate unit counts, and identifying evidence-backed intervals and useful follow-up questions.

Planning approval, permit application, issuance, start and occupancy are separate milestones. Addresses, revisions and phases need careful matching. Receipt dates are not approval dates. Missing matches or long intervals do not prove a stalled project or its cause. Respect unobserved private decisions.

Data leads: [Development Pipeline](https://open.toronto.ca/dataset/development-pipeline/), [active permits](https://open.toronto.ca/dataset/building-permits-active-permits/), and [Application Information Centre](https://www.toronto.ca/city-government/planning-development/application-information-centre/). Pipeline data is a rolling snapshot; proposed units are not completed homes. Active permits exclude cleared records and may overlap unit counts. AIC's active coverage can omit closed applications. Permit issuance alone is not evidence of a physical start.

Original: [three-page PDF](sources/official/CIVIC-Hack_brief-5_housing-approval-to-construction.pdf), [complete text](sources/extracted/CIVIC-Hack_brief-5_housing-approval-to-construction.txt), [all embedded URLs](sources/extracted/CIVIC-Hack_brief-5_housing-approval-to-construction.links.json).

## Boundaries when borrowing methods

| Borrowed method | Connection needed for selected Theme 1 |
| --- | --- |
| Transit journey/access comparison | Examine the consequence of a particular proposed decision and relevant participation |
| Financial/lifetime comparison | Help someone weigh a real proposed municipal option with sourced assumptions |
| Progress evidence | Keep the proposal/current decision/input question central rather than building a general pledge tracker |
| Development milestones | Connect to a particular proposed decision or resident action rather than a general construction pipeline |

These are scope interpretations, not organizer-approved exceptions. A strong method does not replace compliance with the selected brief.
