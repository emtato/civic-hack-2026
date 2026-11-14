# Proviso video — edited-script visual cut

**Current composition: `Proviso-Story-v2` — 2:50, 1920×1080, 30 fps.**

The cut follows the edited script saved verbatim in `approved-script-v2.txt`. The visual decisions were recorded in `visual-direction-v2.md` before implementation. Narration is not included; the bottom captions are an approximate script guide for reviewing pacing, not captions aligned to a voice recording.

## Preview and export

From `video/`:

```sh
npm ci
npm run dev
npm run lint
npm run render
```

Open `Proviso-Story-v2` in Studio, currently at `http://localhost:3000/Proviso-Story-v2`. The export is `out/proviso-story-v2.mp4`.

- `npm run render:clean`: export without script-guide captions, to `out/proviso-story-v2-clean.mp4`.
- `npm run render:opening`: export the 14-second Kensington opening.
- `npm run render:v1`: render the retained first draft. Its existing MP4 remains `out/proviso-draft-v1.mp4`.
- `python3 scripts/make-music.py 170 public/audio/story-bed-v2.wav`: regenerate the original v2 background sketch.

Exports, installed dependencies and the rendering browser are ignored by Git. The static assets and generated filming data are kept so the composition renders without a running app or database.

## Visual structure

| Time | Visual treatment |
| --- | --- |
| 0:00–0:14 | Actual City of Toronto diagrams: Phase 3 design and recommended direction, with the consultation statement and source citation |
| 0:14–0:33 | Two chapter cards; chapter 1 moves into the persistent chapter label |
| 0:33–0:47 | Current app map/search, official notice, earlier Labatt version |
| 0:47–1:02 | Clearly illustrative bedroom/loading scene, then the exact resident comment and request |
| 1:02–1:18 | Three original comments move into a shared request group; the app group expands to retain evidence |
| 1:18–1:34 | Residents and bakery share one daily-hours ruler; overall position and feature ratings remain distinct |
| 1:34–1:52 | Same chapter-card transition activates chapter 2; earlier request is compared with revised 9–11 a.m. wording |
| 1:52–2:04 | Bakery's 7:30 a.m. request remains unresolved on the same ruler |
| 2:04–2:21 | Actual review UI: delivery rating Support, overall position Neutral, explicit confirmation, saved current response |
| 2:21–2:33 | Same-respondent comparison and review-state counts, using exported domain data |
| 2:33–2:50 | Kensington recall, connected conversation, pilot needs and closing |

Named connected scenes and headings are editable in Studio. Generated charts, explanatory illustrations, comment motion and screenshot crops are controlled in `src/v2/Story.tsx`. The diagram colour identities distinguish the resident and bakery; position-chart colours retain their app meanings.

## Filming and evidence boundaries

All app JPEGs in `public/v2/` show the actual frontend, captured on a separate Vite instance against `scripts/film-api.py`. This adapter uses the application's real Labatt seed validation, round aggregation, assessment and response-save domain logic with **memory-only storage**. It never starts the production API lifespan, connects to MongoDB or calls an AI provider. The preview endpoint returns an explicitly empty prepared suggestion list for filming.

To match the edited script, the existing delivery-noise respondent becomes `demo-resident` in the isolated filming fixture. Their seeded current-round response is omitted until the filmed review. The original pickup respondent gets a separate fictional ID. The application's actual `backend/data/labatt-demo.json` and live data remain unchanged.

- Earlier has 24 responses; Current starts with 23 and has 24 after the explicit save.
- The filmed resident changes overall Oppose to Neutral and delivery-specific Oppose to Support. Their earlier comment, request and ratings are preserved.
- The final comparison uses the same 20 respondents in both rounds. Review states are 4 awaiting review, 3 reconfirmed and 17 revised.
- The later-delivery group contains 3 requests from 3 distinct fictional respondents. The bakery remains a separate need.
- Groups and requirement assessments are prepared demonstration material. 'Potentially addressed' is not proof that an individual comment caused a municipal amendment.
- The Labatt application reference is real; the delivery/pickup/path arrangements, responses and revision sequence are fictional. Prototype responses are not sent to the City.
- The interface is captured as animated stills, not continuous footage of a live municipal process. The video is not evidence of municipal adoption, live automatic revision interpretation or measured public impact.
- Participation windows, municipal staff responses and assisted access offline are labelled pilot next steps. No comment deadline is invented.

To restage, use two terminals:

```sh
# From video/ (requires the existing backend virtual environment)
npm run capture:api

# From frontend/
VITE_API_BASE_URL=http://127.0.0.1:8012 npm run dev -- --port=5174 --strictPort
```

Open `http://localhost:5174`, search Labatt and open the full demo. This test-only API binds to loopback. Do not deploy it. Restarting resets the memory store. Captures and charts are derived from `public/v2/journey-before.json` and `journey-after.json`; `src/v2/film-data.ts` stores the subset used in the animation.

## Sources and attribution

- Kensington source: City of Toronto, *Kensington Market Safe Streets — Design changes based on feedback from Consultation #3*, pp. 2, 5–6. The original PDF is retained in `public/sources/kensington-design-changes-2023.pdf`; rendered pages are in `public/v2/`. This is a historical 2023 recommendation, not a Proviso deployment or a claim about completed construction. [Official PDF](https://www.toronto.ca/legdocs/mmis/2023/te/bgrd/backgroundfile-237354.pdf).
- Labatt reference: [City of Toronto notice of application](https://secure.toronto.ca/nm/api/individual/notice/8002.do), November 6, 2026. The prepared example must remain visually distinguished from the official record.
- Interface and current cityscape logo: this repository's frontend and `frontend/public/proviso-logo.png`. The layer-mark asset remains with v1.
- Map captures: © OpenStreetMap contributors, Leaflet. Attribution is repeated beside cropped captures.
- Manrope and DM Sans: Google Fonts, SIL Open Font License. License files are alongside the local fonts in `public/fonts/`.
- Music: original synthesized tones generated by `scripts/make-music.py`, with no external samples.
- Code, visual composition and music sketch were produced with Codex assistance using Remotion's official agent guidance. Disclose AI assistance in the submission.

Before a final submission, record the approved narration, align the scenes to that recording, replace the guide captions with corrected speech-aligned captions, verify all disclosures, and test the viewing link while signed out.
