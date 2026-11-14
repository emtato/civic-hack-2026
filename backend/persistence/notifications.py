"""One document per recipient/change; retries never duplicate or unread an alert."""

from datetime import datetime, timezone
from hashlib import sha256

try:
    from notifications_DTO import NotificationDTO, NotificationInboxDTO
except ImportError:
    from backend.notifications_DTO import NotificationDTO, NotificationInboxDTO


def _timestamp(value):
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if not isinstance(value, datetime):
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


class NotificationRepository:
    def __init__(self, db):
        self.db = db
        self.collection = db["notifications"]

    def notify_participants(self, diff, snapshot):
        if diff.is_demo or not diff.changes:
            return
        proposal = self.db["imported_proposals"].find_one({"_id": diff.proposal_id}) or {}
        title = proposal.get("display_overrides", {}).get("title") or proposal.get("title") or diff.proposal_id
        changed_at = _timestamp(snapshot.captured_at)
        interactions = list(self.db["feedback"].find({"proposal_id": diff.proposal_id}))
        interactions.extend(self.db["proposal_follows"].find({"proposal_id": diff.proposal_id}))
        for feedback in interactions:
            username = feedback.get("participant_id")
            # Existing feedback is the participation record. Do not notify seed
            # personas, or people who first participated after this observation.
            participated_at = _timestamp(feedback.get("created_at") or feedback.get("submitted_at"))
            if not username or participated_at is None or participated_at > changed_at:
                continue
            if self.db["users"].find_one({"_id": username}) is None:
                continue
            key = sha256(f"{username}\0{diff.id}".encode()).hexdigest()
            self.collection.update_one({"_id": key}, {"$setOnInsert": {
                "id": key, "username": username, "proposal_id": diff.proposal_id,
                "proposal_title": title, "diff_id": diff.id,
                "created_at": changed_at, "read_at": None,
            }}, upsert=True)

    def follow(self, username, proposal_id):
        if self.db["imported_proposals"].find_one({"_id": proposal_id}) is None:
            return False
        key = sha256(f"{username}\0{proposal_id}".encode()).hexdigest()
        self.db["proposal_follows"].update_one({"_id": key}, {"$setOnInsert": {
            "participant_id": username, "proposal_id": proposal_id,
            "created_at": datetime.now(timezone.utc),
        }}, upsert=True)
        return True

    def unfollow(self, username, proposal_id):
        self.db["proposal_follows"].delete_one({"participant_id": username, "proposal_id": proposal_id})

    def following(self, username):
        return [row["proposal_id"] for row in self.db["proposal_follows"].find({"participant_id": username})]

    def inbox(self, username):
        cursor = self.collection.find({"username": username}).sort("created_at", -1)
        items = [NotificationDTO.model_validate(row) for row in cursor]
        return NotificationInboxDTO(
            items=items,
            unread_count=self.collection.count_documents({"username": username, "read_at": None}),
        )

    def mark_all_read(self, username):
        self.collection.update_many({"username": username, "read_at": None}, {
            "$set": {"read_at": datetime.now(timezone.utc)},
        })
        return self.inbox(username)
