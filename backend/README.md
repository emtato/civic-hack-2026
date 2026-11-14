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

Set `GROQ_API_KEY` in the backend environment to enable automatic request analysis.
This uses Groq (OpenAI-compatible Chat Completions, model `openai/gpt-oss-120b`
by default; override with `GROQ_MODEL`). The background worker starts with a
backfill of existing feedback, then checks for new/edited feedback every ten
seconds, even when no browser is open. `GROUPING_SCHEDULER_ENABLED=false` disables
it. The backend must remain running for this in-process worker to make progress.

Analysis extracts specific requests from original comments, requires an exact
supporting quote, and groups these with explicit requirements using their time
and place. General opinions do not become requests, and extracted requests never
imply conditional support. Equivalent requests from one author count once within
a suggested group. Unique requests and residents' grouping opt-outs stay visible.
Existing fixture counts without original feedback records are preserved.

Comment analyses are cached by content and analysis version in
`feedback_request_analysis`. Completed proposals are skipped until their relevant
feedback changes. MongoDB leases prevent duplicate background work across API
workers. Provider failures retain existing evidence, expose an error status and
retry after a minute. Interrupted feedback saves are recovered before analysis;
aggregate compare-and-swap prevents stale AI results overwriting new feedback.
Original comments and explicit requirements are never rewritten by analysis.
Rate limits use the provider's retry time and a shared cooldown across workers,
so one limited request does not cause repeated calls for every proposal.

Signed-in residents can **Refresh groups** (queues analysis without waiting for
the provider) or remove their own request from a suggested group. Public aggregate
reads include `grouping_status`, `grouping_error` and `grouping_updated_at`; the
frontend refreshes them every five seconds. Internal `total_conditions` and
`condition_clusters` field names are retained for API compatibility, but include
comment-derived requests as well as explicitly recorded requirements.

To process existing feedback immediately without starting the HTTP server, run
`.venv/bin/python backfill_feedback_groups.py` from `backend/`. Use `--status`
for a read-only summary. Reruns skip completed content and reuse cached comment
analysis; failed proposals respect their retry time.

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
- `GET /api/following` - Authenticated account's followed proposal IDs.
- `PUT /api/proposals/{proposal_id}/follow` - Follow a proposal and subscribe to source-change notifications.
- `DELETE /api/proposals/{proposal_id}/follow` - Remove the follow; existing feedback still qualifies for notifications.
- `GET /api/notifications` - Authenticated account's notification history and new count.
- `POST /api/notifications/read` - Mark the account's entire current queue seen and return retained history.
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

### Persistent update notifications

`proposal_follows` stores account/proposal follow records and first-follow time.
Existing `feedback` records identify participants; edits preserve first participation
time. `notifications` stores one document per recipient/source diff, with a stable
ID, proposal/title, diff ID, detected time and nullable `read_at`. No notification
array or duplicated password/user record is added to `users`.

After the hourly checker persists a real nonempty comparison, it notifies registered
users who followed or participated before that change was captured. Baselines,
unchanged sources, demo comparisons and synthetic personas do not create alerts.
Scheduler retries repair interrupted delivery using insert-only upserts, preserving
seen state and preventing duplicate alerts. The frontend reads this inbox once a
minute; all inbox/follow routes derive identity from the authenticated token.

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

`GET /api/proposals/{proposal_id}/updates?after_sequence=0` reads the saved results
of the backend's hourly checker. On subsequent requests, use the last received
`snapshot_sequence`. It returns `proposal_id`, `checked_at` (last successful source
check), `snapshot_id`, `snapshot_sequence`, `snapshot_created: false`, `source_status`,
`source_error`, and all unseen `diffs` including before/after values and text diffs.
Before the first capture, status is `pending`, sequence is zero, and snapshot/time
are null. Source failures retain saved comparisons and the last successful check.
The old `POST .../updates/check` remains as a deprecated read-only compatibility
endpoint; opening a browser never triggers a source fetch or database write.

`GET /api/proposals/{proposal_id}/snapshots/{snapshot_id}` returns `SnapshotViewDTO`
for the comparison viewer: ID, proposal ID, sequence, capture time, source URLs
and complete normalized content. It performs no source refresh or database write.
Unknown IDs and IDs belonging to another proposal return 404; database failures
return 503. Raw duplicate records and internal hashes are excluded from this view.

Unknown proposals return 404, invalid/ahead cursors 422/409, and database failures
503. No live database capture is performed as part of the tests.

### Hourly backend checks

FastAPI lifespan starts `service/snapshot_scheduler.py` automatically when MongoDB
is configured. It catches up once for the current hour on startup, then runs at
`:00` each hour (UTC hour slots). Official source fetches run in a worker thread,
leaving the API event loop available. Closing every browser does not stop the job.
Successful hours are not repeated after restart or by other API workers:
`proposal_snapshot_jobs` stores atomic claims keyed by proposal/hour. Claims expire
after ten minutes if a worker dies; failed jobs retry after five minutes. The
scheduler wakes at most every five minutes to recover due work, while successful
checks remain deduplicated. Individual source failures do not block other proposals.
`proposal_snapshot_status` stores the last attempt/success and readable failure state.
Snapshots and missing comparisons are saved by the scheduler, not by readers.

Shutdown stops taking new proposals, waits for the current HTTP/DB work and then
closes MongoDB. Set `SNAPSHOT_SCHEDULER_ENABLED=false` to disable the job, for example
in an API-only test environment. It never changes catalogue records, published
versions, aggregates or feedback.

The backend process must stay running for this in-process schedule. Render Free
web services [sleep after 15 minutes without inbound traffic](https://render.com/docs/free#spinning-down-on-idle);
an always-on instance or an external scheduler is required for hourly execution
while the host would otherwise be asleep. A restarted process catches up for its
current hour; it cannot reconstruct source changes that happened while offline.

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

### Seeded comparison examples

`seed_demo_snapshot_diffs.py` adds one labelled fictional predecessor per proposal.
It changes the description's opening sentence to "Demo previous version example."
and prefixes its title with "Demo previous title —". The real saved source is the
right side. Synthetic predecessors reserve sequence zero, contain no claimed raw
source evidence, and never become the latest observed source. Existing snapshots,
catalogue records and feedback are left intact. `is_demo` and `demo_label` travel
through the DTOs and are shown in the viewer and Overview card.

Run from `backend/`: `.venv/bin/python seed_demo_snapshot_diffs.py` previews;
add `--write` to insert the demo snapshots and comparisons. Rerunning reuses the
same IDs and comparisons. `--manifest data/demo-snapshot-diffs-manifest.json`
retains a non-sensitive record of the seeded pairs. A real baseline must exist for
every proposal before seeding. Polling includes these labelled examples even when
a browser has already seen the current snapshot sequence. Future actual changes
still compare real snapshots and remain distinct from the seeded example.
