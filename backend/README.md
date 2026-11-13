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
- `POST /api/proposals` - Save display edits in `display_overrides`, preserving the rich source record, and optionally its aggregate.
- `POST /api/proposals/seed` - Trigger seeding from `data/proposals.formatted.json` (`?force=true` to reseed).
- `POST /api/proposals/{proposal_id}/feedback` - Submit citizen feedback; stores the submission in MongoDB and atomically updates the proposal's attached aggregate.
- `GET /api/proposals/{proposal_id}/feedback` - Retrieve all feedback submissions for a proposal.
- `GET /api/proposals/{proposal_id}/feedback/{participant_id}` - Retrieve a specific participant's feedback.
- `GET /api/proposals/{proposal_id}/aggregate` - Retrieve just the current community aggregate feedback object.

List/detail/aggregate routes and feedback writes use the same imported proposal
IDs. The service reverses GeoJSON longitude/latitude into frontend
latitude/longitude, permits null coordinates for citywide records, creates
feature questions from imported features, and preserves saved aggregate counts.
Archived, unreviewed statuses are labelled as archived notices; no current input
window or project boundary is invented. The existing legacy `proposals`
collection is left untouched.

References: [FastAPI server setup](https://fastapi.tiangolo.com/deployment/manually/)
and [PyMongo connections](https://www.mongodb.com/docs/languages/python/pymongo-driver/current/connect/).
