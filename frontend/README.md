# proviso frontend

A Vite + React + TypeScript prototype for discovering proposals and recording feedback. The catalogue loads from FastAPI; feedback retains its explicitly labelled local demo mode when its endpoints are unavailable.

```sh
npm install
npm run dev
```

`npm run build` checks TypeScript and produces the static site in `dist/`.

## What works

- Leaflet map centred on Toronto, with clickable proposal markers, zoom controls and reset-to-results.
- Proposal search, topic filters and status filters shared by the map and list.
- Proposal detail panel with an illustrative project route and Overview, Community and Updates tabs.
- Following saved to the signed-in account in MongoDB; following and submitting feedback both subscribe the user to proposal updates.
- Community dashboard with overall and element distributions, self-reported connections, and expandable condition evidence.
- Feedback form with a review step, explicit requirement confirmation, save receipt, and editing without duplicate participants.
- Server-backed feedback when FastAPI is available; explicitly labelled browser-local demo responses otherwise. Failed server writes retain the form and show an error.
- Header notification bell with a red dot for new updates. Opening the inbox marks the entire queue as seen without deleting history; clicking an alert opens its source comparison in Updates.
- Responsive map/list toggle for small screens and keyboard-accessible controls.

## Files to build on

- `src/index.tsx`: application root mounting `<App />`.
- `src/App.tsx`: main application state, layout, map lifecycle, and explorer/detail views.
- `src/components/`: modular UI components (e.g. `Icon.tsx`).
- `src/components/ProposalFeedback.tsx`: community dashboard, data loading, response lifecycle and save states. Sidebar mounts this component per proposal.
- `src/components/FeedbackForm.tsx`: position, connection, optional feature answers, original comment and one manually entered requirement, followed by review and confirmation.
- `src/components/ProposalFeedback.css`: feedback-specific styling and responsive layouts.
- `src/data/proposalFeedbackDTO.ts`: the shared aggregate/submission contract and immutable demo aggregate updates.
- `src/data/feedbackSession.ts`: unverified browser identity and explicitly local demo storage.
- `src/data/proposals.ts`: display types and legacy fixtures. The explorer/map do not load the fixture array.
- `src/api/proposalsApi.ts`: published catalogue and feedback requests.
- `src/api/catalogue.ts`: validation of public catalogue records and map-coordinate checks.

## Proposal catalogue connection

The explorer calls `GET /api/proposals` on startup and stores the response in
React state. `VITE_API_BASE_URL` defaults to `http://localhost:8000`; copy
`.env.example` to `.env.local` to choose another backend origin. Restart Vite
after changing the setting; deployed builds need it configured at build time.
The backend must allow the frontend origin through CORS.

The expected response is an array of published display DTOs: `id`, `title`,
`neighbourhood`, `topic`, `status`, `coordinates`, `summary`, `changes`, `source`,
`shape` and optional `community_aggregate`. This is not the rich import envelope.
The backend owns conversion of imported records to this format.

The catalogue shows loading, a retryable error, or an empty published catalogue.
Neither request failure nor an empty array silently loads fixtures. Topic/status
filters and the map legend come from fetched records. Missing or invalid
coordinates keep a record in the list without a marker; coordinate order is
latitude/longitude. Missing shapes do not create invented project boundaries.
Saved follow IDs survive asynchronous loading. Source titles render as plain
text in map tooltips. Existing sample comments are explicitly labelled examples.

Verified using a temporary API fixture: error/retry recovery, dynamic categories,
two records with one marker, filtering and opening an unmapped record, and an
empty response. This does not verify the parallel backend's imported-record
projection or production deployment.
- `src/style.css`: layout, visual styling and mobile breakpoints.

Project references are real, but summaries, statuses, locations, feature questions and seeded community feedback are illustrative. They do not establish an active participation window, official boundaries or a verified proposal version. Feedback is not an official City submission. Use synthetic input in this prototype.

## Feedback connection and verification

`VITE_API_BASE_URL` sets the FastAPI origin (default: `http://localhost:8000`). The component reads the aggregate and this browser participant's saved response when a proposal opens. Server saves use the returned aggregate. Read failures enter a visibly labelled demo mode; writes never silently fall back to local success. Demo responses stay separate from server responses and are not automatically uploaded when a server becomes available.

Only explicitly confirmed requirements contribute to condition counts. General comments remain on the response, and support is never inferred from them. New requirements remain inspectable in the ungrouped section until someone actually reviews grouping equivalence. Existing fixture groups supply example quotes, not a complete respondent-level dataset.

The current contract supports one manual requirement per response. AI extraction, multiple requirements, map concern pins and version-specific reconfirmation rounds remain separate work. Source change detection/comparison and account notifications are implemented.

## Notifications and following

The existing hourly backend source checker saves a notification for each registered participant/follower when a non-demo source change is detected. The bell reads saved notifications on sign-in and every minute, without triggering extra source checks. Baseline captures, unchanged sources and synthetic demo comparisons do not generate alerts. Repeated checks do not duplicate alerts or mark old alerts new again.

Following now requires sign-in and is stored per account rather than per browser. Existing anonymous local bookmarks are not automatically attached to an account. Unfollowing stops follow-only alerts; feedback participation remains a subscription. Notifications and seen state persist across browser refreshes and devices.

Run `npm test` for aggregate regression checks (Node 22.18+), and `npm run build` for TypeScript plus a production bundle. Backend API/service/persistence checks run from `backend/` with `.venv/bin/python -m unittest service.test_service persistence.test_persistence test_api`.

## Proposal update polling and comparison

`ProposalUpdatesProvider` wraps the application and reads saved updates for every
loaded catalogue proposal immediately, then once a minute. Requests run
serially without overlapping passes. Unmounting or changing the catalogue IDs
aborts the old polling session and clears its timer. Browser suspension can delay
timers; these reads do not control the backend's independent hourly source schedule.

`fetchProposalUpdates` sends the last received snapshot sequence to
`GET /api/proposals/{id}/updates?after_sequence=...`. It only reads stored results.
The backend checks official sources at the start of each hour, saves changed
snapshots and comparisons even with no browsers open. Initial capture is a
baseline, not a reported amendment. This requires the backend host to stay awake.

UI components read `useProposalUpdates()[proposalId]` from
`src/data/ProposalUpdatesContext.tsx`. Each entry has `status`, `snapshot_id`,
`snapshot_sequence`, `checked_at`, accumulated/deduplicated `diffs`, and `error`.
An unchanged response retains previous diffs. A failed request retains both data
and cursor, continues with other proposals, and retries the next minute. State is held
in memory; reloading retrieves history again from sequence zero. Detected changes
remain unclassified.

`checked_at` is the last successful source check, not when the browser last read
the data. Pending initial captures and failed source checks are represented
separately; stored comparisons remain available after a source failure.

The Updates tab displays earlier/later fields with word-level removal/addition
highlights, a change selector, capture dates and official source links. It fetches
both saved notices through `GET /api/proposals/{id}/snapshots/{snapshot_id}`.
The viewer shows changed fields only. On narrow screens the earlier/later cells
stack with explicit labels.
If full-source reads fail, changed fields remain visible and a retry is available.
No-change, source-check failure and loading states are explicit. The Overview card
also reflects the current detected-change count.

Verified with an isolated in-memory HTTP fixture: desktop layout, 390px width,
older-change selection, full source content, saved-version failure/retry and an
initial capture with no changes. This does not establish live source/Atlas behavior.

## Basemap

Leaflet 1.9.4 uses the standard OpenStreetMap raster tiles by default. No key or account is needed for the prototype. Attribution remains visible. Browser requests use normal referrer and cache behaviour; there is no tile prefetch or offline download feature.

The public OSM service is best-effort and has usage limits. Follow its [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) and choose an appropriate hosted provider if deploying at greater scale.

To change providers, set these Vite environment variables before starting/building:

```dotenv
VITE_MAP_TILE_URL=https://your-provider.example/{z}/{x}/{y}.png
VITE_MAP_ATTRIBUTION=Your provider's required attribution HTML
```

Vite variables are public client configuration. Do not put private credentials here. Fonts load from Google Fonts with system fallbacks when unavailable. The map requires a network connection; the proposal list still works if tiles cannot load.
