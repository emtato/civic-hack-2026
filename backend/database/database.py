"""MongoDB connection and database management."""

import os
from pathlib import Path
from typing import Optional

import certifi
from dotenv import load_dotenv
from pymongo import ASCENDING, MongoClient
from pymongo.database import Database

# Load environment variables from backend/.env if present
HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")
load_dotenv(HERE.parent / ".env")


def get_mongo_client(uri: Optional[str] = None) -> Optional[MongoClient]:
    """Create a MongoClient with TLS certificate verification enabled."""
    connection_uri = (uri or os.getenv("MONGODB_URI", "")).strip()
    if not connection_uri:
        return None
    try:
        return MongoClient(
            connection_uri,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=5000,
        )
    except Exception:
        return None


def get_database(
    client: Optional[MongoClient] = None, database_name: Optional[str] = None
) -> Optional[Database]:
    """Retrieve the target MongoDB database."""
    if client is None:
        client = get_mongo_client()
    if client is None:
        return None
    name = (database_name or os.getenv("MONGODB_DATABASE", "civic_hack")).strip()
    return client[name]


def ensure_indexes(db: Database) -> None:
    """Ensure essential indexes exist for proposals and feedback collections."""
    try:
        # Proposals collection
        db.imported_proposals.create_index([("category", ASCENDING)])
        db.imported_proposals.create_index([("status", ASCENDING)])

        # Feedback collection: unique per proposal + participant
        db.feedback.create_index(
            [("proposal_id", ASCENDING), ("participant_id", ASCENDING)],
            unique=True,
            name="uniq_proposal_participant",
        )
        db.feedback.create_index([("proposal_id", ASCENDING), ("submitted_at", ASCENDING)])
    except Exception:
        # Indexes may fail if offline or permissions are read-only; allow gracefully
        pass
