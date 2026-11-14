"""Run one recoverable request-analysis pass without starting the HTTP server.

Existing successful analyses are skipped. Failures are persisted for automatic retry.
"""

import json
import argparse

from database.database import get_database, get_mongo_client
from service.grouping_scheduler import GroupingScheduler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--status", action="store_true", help="Read grouping status without changing data")
    args = parser.parse_args()
    client = get_mongo_client()
    if client is None:
        raise SystemExit("Configure MONGODB_URI before running the backfill.")
    try:
        db = get_database(client)
        if args.status:
            rows = list(db["imported_proposals"].find({}, {"id": 1, "community_aggregate": 1}))
            print(json.dumps({"feedback": db["feedback"].count_documents({}), "proposals": [
                {"id": row.get("id") or str(row["_id"]),
                 "status": row.get("community_aggregate", {}).get("grouping_status", "not_processed"),
                 "requests": row.get("community_aggregate", {}).get("total_conditions", 0),
                 "groups": sum(bool(c.get("is_suggested")) for c in row.get("community_aggregate", {}).get("condition_clusters", []))}
                for row in rows
            ]}), flush=True)
            return
        result = GroupingScheduler(db).run_due()
        print(json.dumps(result), flush=True)
        if result["failed"]:
            raise SystemExit(1)
    finally:
        client.close()


if __name__ == "__main__":
    main()
