# proviso API

For the selected 24-example public-notice importer and richer optional source
schema, see [IMPORTING.md](IMPORTING.md). The service converts rich
`imported_proposals` records into the frontend display DTO when serving requests.

Requires Python 3.10 or newer. From the repository root:

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload
```

Open http://127.0.0.1:8000/docs for the interactive API documentation.

- `GET /health` returns `{"status":"ok"}` when the API is running.
- `GET /health/database` pings MongoDB. It returns HTTP 503 if MongoDB is
  unconfigured or unreachable. This does not verify collection write permissions.

The API can start without database credentials so you can first verify FastAPI.
For Atlas, choose **Drivers and Client Libraries → Python**, copy the connection
string into `MONGODB_URI` in `.env`, and replace its credential placeholders.
URL-encode special characters in the database password. Ensure Atlas permits your
machine's IP and that the database user has access to the chosen database.
Restart the server after changing `.env`.

`MONGODB_DATABASE` selects the database name. MongoDB creates the database when
you first write data; pinging it does not create a database or collection.
The shared database handle is available as `request.app.state.database` when
adding routes. Use regular `def` routes for this synchronous PyMongo client;
FastAPI runs these handlers in its thread pool.

`CORS_ORIGINS` lists the frontend URLs allowed to call the API. The defaults
cover Vite on port 5173. Add the deployed frontend origin when hosting it.
The frontend should call the API on port 8000; keep the MongoDB URI in the backend.

For a Render web service, use `backend` as the root directory, install with
`pip install -r requirements.txt`, and start with
`uvicorn main:app --host 0.0.0.0 --port $PORT`. Set environment variables in
Render rather than uploading `.env`. Use `/health` as the health check path.

This backend provides the persistence layer communicating with MongoDB for:
- **Proposals Storage & Retrieval**: Reads `imported_proposals` and converts records in `service/service.py` into the display DTO. Source snapshots/history remain intact. An empty collection can seed from `data/proposals.formatted.json`; the old three-example `proposals` collection is not used by the catalogue.
- **Feedback Storage & Retrieval**: Stores citizen feedback submissions with stance, stakeholder role, element ratings, comments, and structured conditions. Repeat submissions by the same participant update their record without inflating respondent counts.
- **Live Community Aggregate Updates**: Atomically updates the proposal's attached aggregate in MongoDB whenever feedback is submitted or modified.

### Endpoints
- `GET /health` - API server status.
- `GET /health/database` - Database ping check.
- `GET /api/proposals` - List all proposals (with attached feedback aggregates). Filterable by `topic` and `status`.
- `GET /api/proposals/{proposal_id}` - Get a single proposal with its attached community feedback aggregate.
- `POST /api/proposals/{proposal_id}/feedback` - Submit citizen feedback; stores the submission in MongoDB and atomically updates the proposal's attached aggregate.
- `GET /api/proposals/{proposal_id}/feedback` - Retrieve all feedback submissions for a proposal.
- `GET /api/proposals/{proposal_id}/feedback/{participant_id}` - Retrieve a specific participant's feedback.
- `GET /api/proposals/{proposal_id}/aggregate` - Retrieve just the current community aggregate feedback object.

Proposal creation, editing, and forced seeding are not exposed through the HTTP API.
An empty catalogue can still be seeded automatically at startup.

List/detail/aggregate routes and feedback writes use the same imported proposal
IDs. The service reverses GeoJSON longitude/latitude into frontend
latitude/longitude, permits null coordinates for citywide records, creates
feature questions from imported features, and preserves saved aggregate counts.
Archived, unreviewed statuses are labelled as archived notices; no current input
window or project boundary is invented. The existing legacy `proposals`
collection is left untouched.

References: [FastAPI server setup](https://fastapi.tiangolo.com/deployment/manually/)
and [PyMongo connections](https://www.mongodb.com/docs/languages/python/pymongo-driver/current/connect/).

## Internal source snapshots and comparisons

`service/proposal_snapshots.py` exposes two methods on
`ProposalSnapshotService(db)`, where `db` is the existing PyMongo database handle:

- `refresh_proposal_snapshot(proposal_id)` fetches the proposal's linked Toronto
  notices through the official JSON API. The first call saves a baseline;
  subsequent calls append only when normalized content differs from the latest
  snapshot. It returns `SnapshotRefreshDTO` with `created` and `snapshot`.
- `compare_proposal_snapshots(proposal_id, before_snapshot_id, after_snapshot_id)`
  reads two saved snapshots and persists a `SnapshotDiffDTO` containing added,
  removed and changed fields, before/after values, and unified diffs for text.
  Repeating the same ordered comparison returns the same stored result.

DTOs live in `proposal_snapshots_DTO.py`. MongoDB collections are
`proposal_snapshots` and `proposal_snapshot_diffs`; snapshots retain raw source
records, readable normalized content, source URLs, capture times, hashes and
previous-snapshot IDs. A unique proposal/sequence index guards concurrent appends.
Reverting to older content still creates a new observation in the history.

`POST /api/proposals/{proposal_id}/updates/check` now orchestrates these methods
for frontend polling. Send `{"after_sequence": 0}` on the first request, then
the last successfully received `snapshot_sequence` on subsequent requests.
The public endpoint returns `proposal_id`, `checked_at`, `snapshot_id`,
`snapshot_sequence`, `snapshot_created`, and all unseen `diffs` (including full
before/after values and text diffs). The initial snapshot establishes a baseline
without a diff. Even when refresh finds no new content, the endpoint returns
unseen historical transitions detected by other visitors. Missing comparisons
are generated from saved snapshots, so an interrupted earlier request can recover.

`GET /api/proposals/{proposal_id}/snapshots/{snapshot_id}` returns `SnapshotViewDTO`
for the comparison viewer: ID, proposal ID, sequence, capture time, source URLs
and complete normalized content. It performs no source refresh or database write.
Unknown IDs and IDs belonging to another proposal return 404; database failures
return 503. Raw duplicate records and internal hashes are excluded from this view.

Unknown proposals return 404, invalid/ahead cursors 422/409, source failures 502,
and database failures 503. There are no startup hooks or backend scheduled jobs;
checks run when requested by an open frontend. They do not modify imported
proposals, published versions, aggregates or feedback. No live database capture
is performed as part of the tests.

Formatting attributes, whitespace, array ordering and generated map-image URLs
are excluded from change detection. Description text, link targets, contact
details and other source fields are compared. Fetch failures, incomplete
responses and missing linked notices raise errors rather than saving an apparent
deletion or partial proposal. Source publication dates select narrow API windows;
if a notice moves outside those windows, the refresh fails without a write.
Official HTTPS requests use the installed `certifi` CA bundle with certificate
and hostname verification enabled, matching the MongoDB TLS configuration.

The [Toronto API field guide](https://secure.toronto.ca/nm/opendata.do) does not
document an amendment-versus-editorial-edit flag. Diffs therefore remain
`unclassified`, with `review_required` when changes exist. New notice IDs are not
automatically discovered, and linked webpages/PDF contents are not downloaded;
only changes to their references are detected. Source observations are not
automatically published municipal revisions.

Run the isolated checks from `backend/` with
`.venv/bin/python -m unittest service.test_proposal_snapshots`.
