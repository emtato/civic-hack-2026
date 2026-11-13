# proviso — pitch notes

Working notes for the 2–3 min demo video, the 5-min finalist pitch, and Q&A.
Not a script; a bank of framing, quotes, and answers. Trim to fit.

> Reminder: the judges are **not** the municipal leaders quoted below. The
> summit speakers are stakeholders whose words we use as *validation of the
> problem*, not as judges to please. Judges score the rubric
> (project 40 / software 20 / presentation 40).

---

## 1. The one-liner

proviso turns a municipal proposal into a place where residents say what would
make it work for them — an overall position, the specific conditions that matter,
and the location they apply to — and lets staff see those needs grouped without
flattening them into a single score.

## 2. The problem, in the stakeholders' own words

These paraphrase municipal leaders from the Nov 13 CUI summit videos shared by
the organizers. Use one or two; attribute as "municipal leaders at the summit."
Content rephrased for licensing compliance.

- **"Show residents where their input still counts."** (Ryan, Canadian Real
  Estate Association — zoning roadmap idea.) A focused input page that makes
  clear what is still open for decision, to cut through town-hall misinformation.
- **"Bring residents in early — while motions are being discussed — so they help
  shape policy instead of being consulted after the fact."** (Janelle & Nadia —
  flyer-to-co-creation idea.)
- **"Put the stated reasons side by side with the facts, so residents can judge
  for themselves."** (Reno's team — ask-anything interface.)
- **"Make a resident care in the first 10 seconds."** (Dylan, City of Ottawa
  zoning / Dan Kligerman, Esri Canada.) — a presentation/UX bar, not a feature.

**Why this helps us:** the summit's "input still counts / bring them in early"
theme is our pitch in their words. proviso's conditional feedback + revision
rounds are exactly "where does my input still count, and did it change anything."

## 3. What's wrong today (the gap)

- Toronto already takes per-item comments (TMMIS "Submit Comments") and runs
  Have Your Say. So the *channel* exists — we don't claim to invent it.
- What's missing: comments arrive as a flat pile. Nothing preserves that 40
  people want the *same* thing in different words, that two people want *opposite*
  changes to the same feature, or that one person's support is *conditional* on a
  specific requirement. Staff re-read everything; minority access needs vanish
  under louder topics.
- proviso's job: keep meaning intact — position vs concern vs condition — and
  carry it across a revision so residents can see whether their condition was met.

## 4. The demo path (what the video shows, in order)

1. Open the map, pick a real Toronto proposal (status shown: open / updated / review).
2. Read what's proposed and whether input is still open — claims link to source.
3. Log in, submit a response: overall position + a specific condition
   ("I support this if accessible pickup stays near this entrance in the evenings").
4. See the community picture: distributions + grouped conditions that keep
   opposite requests and minority needs visible, each expandable to originals.
5. (Stretch) A revised version arrives; the condition is shown as addressed /
   unresolved / uncertain — closing the loop.

Keep it to one proposal, end to end. The rubric rewards showing the *full* core
workflow with real outputs and visible limits.

## 5. Honesty / limits to state out loud (scores trust points)

- Seeded community responses are **fictional and labelled**. Not an official
  City consultation.
- Three real Toronto proposals are used as references; descriptions, marker
  locations and routes are illustrative.
- A meeting date is **not** a submission deadline; we only show a deadline we can
  verify, otherwise we say "check the official page."
- AI condition extraction is an **editable draft the resident confirms** — it
  never auto-decides support or invents a time/location.

## 6. Software talking points (for the 20 software pts + Q&A)

Be ready to explain *what and why* for each choice:

- **Stack:** Vite + React + TypeScript (frontend, static on GitHub Pages),
  Python FastAPI + Uvicorn (backend on Render), MongoDB Atlas via PyMongo,
  Leaflet map. Familiar, documented, deployable in the time we had.
- **Layering:** controller (FastAPI routes) → service (domain/aggregation logic)
  → persistence (repositories) → MongoDB. Aggregates are computed in Python from
  stored records; the LLM never supplies counts.
- **Auth:** username + password. Passwords hashed with **bcrypt** (salted, slow
  hash — a leaked DB doesn't expose passwords). Sessions use a stateless **JWT**
  signed with a backend secret, verified by one FastAPI dependency applied only
  to write routes. **Reading is public; only submitting feedback needs an
  account.** The participant identity comes from the verified token, so a user
  can only submit as themselves.
- **Why not more:** no roles/refresh-tokens/password-reset — nothing in the demo
  needs them. We deliberately kept auth minimal; the rubric rewards justified
  structure, not more frameworks.
- **Testing:** 27 backend unittest cases (service aggregation, persistence,
  API integration, auth flow, importer). Opposite-request and
  minority-condition cases are tested explicitly.
- **Data:** proposals imported offline from Toronto's Public Notices JSON API
  into MongoDB; raw source snapshots retained. We don't call the city source on
  each page view.

## 7. Answers to likely Q&A

- **"Isn't this just a petition / Have Your Say?"** No. Have Your Say collects
  comments; proviso preserves *conditional* support and tracks it across a
  revision. The differentiator is keeping meaning intact and closing the loop,
  not the comment channel.
- **"Where does the data come from?"** Toronto Public Notices API + agenda pages,
  imported and reviewed offline. Community responses are synthetic and labelled.
- **"Who's the city in your demo?"** Nobody live — staff responses/revisions are
  seeded from real records and clearly labelled. We don't simulate a live
  consultation.
- **"What would a municipality need to pilot it?"** Ownership of the workflow,
  a source feed (they already publish it), and staff to review AI drafts. Listed
  in the readiness report.
- **"How do you stop wrong AI groupings?"** Nothing auto-merges. New conditions
  stay ungrouped until reviewed; residents can reject a grouping; opposite
  requests are never merged on wording alone.

## 8. Adoption / scaling (readiness report + closing line)

The workflow is one reusable pattern — "one board per proposal, conditions
preserved, revisions tracked." Any municipality that publishes agenda items and
takes public comment can adopt it; what changes per city is the source format,
meeting rules, and which staff own the review. That reusability is the Pahlka
"small tool that travels" point.

---

*Sources: CUI summit idea videos shared by organizers (Preethi Raghuraman,
Nov 13); CIVIC Hack brief and rubric; Toronto TMMIS / Have Your Say public pages.
Quotes rephrased for licensing compliance.*
