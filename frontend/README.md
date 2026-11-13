# Civic frontend

A Vite + TypeScript prototype of the proposal-discovery layer. No backend or API key is required.

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
- Placeholder feedback and About dialogs, with keyboard dismissal.
- Responsive map/list toggle for small screens and keyboard-accessible controls.

## Files to build on

- `src/proposals.ts`: typed frontend fixtures. Replace these with checked proposal records or API responses later.
- `src/main.ts`: map setup, application state, rendering and event handlers.
- `src/style.css`: layout, visual styling and mobile breakpoints.
- `src/icons.ts`: small inline SVG icon helper.

Project references are real, but the UI summaries, statuses, marker locations and route highlights are illustrative. They do not establish an active participation window, official boundaries or a verified proposal version. No feedback is collected and no backend requests are made.

## Basemap

Leaflet 1.9.4 uses the standard OpenStreetMap raster tiles by default. No key or account is needed for the prototype. Attribution remains visible. Browser requests use normal referrer and cache behaviour; there is no tile prefetch or offline download feature.

The public OSM service is best-effort and has usage limits. Follow its [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) and choose an appropriate hosted provider if deploying at greater scale.

To change providers, set these Vite environment variables before starting/building:

```dotenv
VITE_MAP_TILE_URL=https://your-provider.example/{z}/{x}/{y}.png
VITE_MAP_ATTRIBUTION=Your provider's required attribution HTML
```

Vite variables are public client configuration. Do not put private credentials here. Fonts load from Google Fonts with system fallbacks when unavailable. The map requires a network connection; the proposal list still works if tiles cannot load.
