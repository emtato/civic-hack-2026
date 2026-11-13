"""Database package."""

from .database import ensure_indexes, get_database, get_mongo_client

__all__ = ["ensure_indexes", "get_database", "get_mongo_client"]
