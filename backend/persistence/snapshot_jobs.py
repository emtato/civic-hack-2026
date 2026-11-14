"""Persistent hourly claims and source-check status shared by API workers."""

from datetime import timedelta

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError


class SnapshotJobRepository:
    def __init__(self, db):
        self.jobs = db["proposal_snapshot_jobs"]
        self.status = db["proposal_snapshot_status"]

    def claim(self, proposal_id, hour, owner, now):
        job_id = f"{proposal_id}:{hour.isoformat()}"
        fields = {"proposal_id": proposal_id, "hour": hour, "owner": owner,
                  "status": "running", "started_at": now, "lease_until": now + timedelta(minutes=10)}
        try:
            self.jobs.insert_one({"_id": job_id, **fields, "attempts": 1})
            return job_id
        except DuplicateKeyError:
            # Completed hours cannot run again. A crashed worker's expired claim
            # or a failed attempt can be retried without losing the hour slot.
            claimed = self.jobs.find_one_and_update({
                "_id": job_id, "status": {"$in": ["running", "failed"]}, "lease_until": {"$lte": now},
            }, {"$set": fields, "$inc": {"attempts": 1}}, return_document=ReturnDocument.AFTER)
            return job_id if claimed is not None else None

    def finish(self, job_id, proposal_id, owner, now):
        result = self.jobs.update_one({"_id": job_id, "owner": owner, "status": "running"}, {
            "$set": {"status": "completed", "finished_at": now},
        })
        if result.matched_count:
            self.status.update_one({"_id": proposal_id}, {"$set": {
                "last_successful_at": now, "last_attempt_at": now, "source_status": "ready", "source_error": None,
            }}, upsert=True)

    def fail(self, job_id, proposal_id, owner, now):
        result = self.jobs.update_one({"_id": job_id, "owner": owner, "status": "running"}, {
            "$set": {"status": "failed", "finished_at": now, "lease_until": now + timedelta(minutes=5)},
        })
        if result.matched_count:
            self.status.update_one({"_id": proposal_id}, {"$set": {
                "last_attempt_at": now, "source_status": "error",
                "source_error": "The backend could not refresh the official notice. It will retry automatically.",
            }}, upsert=True)
