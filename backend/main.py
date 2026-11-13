"""FastAPI entry point. Run from backend/ with uvicorn main:app --reload."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pymongo.errors import PyMongoError

load_dotenv(Path(__file__).with_name(".env"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Share one MongoDB client across requests and close it on shutdown."""
    uri = os.getenv("MONGODB_URI", "").strip()
    client = None
    if uri:
        client = MongoClient(
            uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=5000,
        )
    app.state.mongo_client = client
    app.state.database = (
        client[os.getenv("MONGODB_DATABASE", "civic_hack")] if client is not None else None
    )
    try:
        yield
    finally:
        if client is not None:
            client.close()


app = FastAPI(title="Civic Hack API", lifespan=lifespan)

origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in origins.split(",") if origin.strip()],
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health():
    """Check that the API is running, independently of MongoDB."""
    return {"status": "ok"}


@app.get("/health/database")
def database_health(request: Request):
    """Verify database connectivity without exposing connection credentials."""
    client = request.app.state.mongo_client
    if client is None:
        raise HTTPException(status_code=503, detail="MongoDB is not configured.")
    try:
        client.admin.command("ping")
    except PyMongoError:
        raise HTTPException(status_code=503, detail="MongoDB is unavailable.") from None
    return {"status": "ok", "database": "connected"}
