# proviso frontend

A Vite + React + TypeScript prototype for discovering proposals and recording feedback. The labelled demo mode works without a backend or API key.

```sh
npm install
npm run dev
```

`npm run build` checks TypeScript and produces the static site in `dist/`.

## What works

- Leaflet map centred on Toronto, with clickable proposal markers, zoom controls and reset-to-results.
- Proposal search, topic filters and status filters shared by the map and list.
- Proposal detail panel with an illustrative project route and Overview, Community and Updates tabs.
- Following shortlist saved in this browser's local storage. It does not send notifications.
- Community dashboard with overall and element distributions, self-reported connections, and expandable condition evidence.
- Feedback form with a review step, explicit requirement confirmation, save receipt, and editing without duplicate participants.
- Server-backed feedback when FastAPI is available; explicitly labelled browser-local demo responses otherwise. Failed server writes retain the form and show an error.
- About dialog with keyboard dismissal.
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
- `src/data/proposals.ts`: typed frontend fixtures. Replace these with API responses later.
- `src/style.css`: layout, visual styling and mobile breakpoints.

Project references are real, but summaries, statuses, locations, feature questions and seeded community feedback are illustrative. They do not establish an active participation window, official boundaries or a verified proposal version. Feedback is not an official City submission. Use synthetic input in this prototype.

## Feedback connection and verification

`VITE_API_BASE_URL` sets the FastAPI origin (default: `http://localhost:8000`). The component reads the aggregate and this browser participant's saved response when a proposal opens. Server saves use the returned aggregate. Read failures enter a visibly labelled demo mode; writes never silently fall back to local success. Demo responses stay separate from server responses and are not automatically uploaded when a server becomes available.

Only explicitly confirmed requirements contribute to condition counts. General comments remain on the response, and support is never inferred from them. New requirements remain inspectable in the ungrouped section until someone actually reviews grouping equivalence. Existing fixture groups supply example quotes, not a complete respondent-level dataset.

The current contract supports one manual requirement per response. AI extraction, multiple requirements, map concern pins, version-specific revision rounds and notifications remain separate work.

Run `npm test` for aggregate regression checks (Node 22.18+), and `npm run build` for TypeScript plus a production bundle. Backend API/service/persistence checks run from `backend/` with `.venv/bin/python -m unittest service.test_service persistence.test_persistence test_api`.

## Basemap

Leaflet 1.9.4 uses the standard OpenStreetMap raster tiles by default. No key or account is needed for the prototype. Attribution remains visible. Browser requests use normal referrer and cache behaviour; there is no tile prefetch or offline download feature.

The public OSM service is best-effort and has usage limits. Follow its [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) and choose an appropriate hosted provider if deploying at greater scale.

To change providers, set these Vite environment variables before starting/building:

```dotenv
VITE_MAP_TILE_URL=https://your-provider.example/{z}/{x}/{y}.png
VITE_MAP_ATTRIBUTION=Your provider's required attribution HTML
```

Vite variables are public client configuration. Do not put private credentials here. Fonts load from Google Fonts with system fallbacks when unavailable. The map requires a network connection; the proposal list still works if tiles cannot load.
