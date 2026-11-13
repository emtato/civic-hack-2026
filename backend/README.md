# FastAPI backend

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

This is the backend foundation. Proposal, feedback, and aggregate routes still
need their shared data contract and implementation.

References: [FastAPI server setup](https://fastapi.tiangolo.com/deployment/manually/)
and [PyMongo connections](https://www.mongodb.com/docs/languages/python/pymongo-driver/current/connect/).
