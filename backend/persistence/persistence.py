"""Persistence layer communicating with MongoDB for Proposals and Citizen Feedback.

Pure persistence:
- ProposalRepository: CRUD and query operations for proposals in MongoDB.
- FeedbackRepository: CRUD and query operations for feedback in MongoDB.
- Uses database connection from backend.database.
"""

import json
import hashlib
import logging
from pathlib import Path
from typing import List, Optional, Tuple

from pymongo import ASCENDING
from pymongo.database import Database

try:
    from proposals_DTO import Proposal, ProposalCommunityAggregateDTO, ProposalFeedbackSubmissionDTO
except ImportError:
    from backend.proposals_DTO import Proposal, ProposalCommunityAggregateDTO, ProposalFeedbackSubmissionDTO

try:
    from database.database import get_database
except ImportError:
    from backend.database.database import get_database

logger = logging.getLogger("proviso.persistence")

# Default seed data path
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DEFAULT_SEED_FILE = DATA_DIR / "proposals.formatted.json"


def feedback_revision(submission: ProposalFeedbackSubmissionDTO) -> str:
    return hashlib.sha256(submission.model_dump_json(exclude={
        "upvotes", "downvotes", "score", "my_vote",
    }).encode()).hexdigest()


class ProposalRepository:
    """Concrete persistence operations for proposals in MongoDB."""

    def __init__(self, db: Optional[Database] = None):
        self.db = db if db is not None else get_database()
        if self.db is None:
            raise ValueError("MongoDB database handle is required for ProposalRepository.")
        self.collection = self.db["imported_proposals"]

    def get_all(self) -> list[dict]:
        """Return stored source records; the service owns display conversion."""
        return list(self.collection.find({}))

    def get_by_id(self, proposal_id: str) -> Optional[dict]:
        """Retrieve a single proposal by its ID."""
        doc = self.collection.find_one({"_id": proposal_id})
        if doc is None:
            doc = self.collection.find_one({"id": proposal_id})
        if doc is None:
            return None
        return doc

    def save(self, record: dict) -> dict:
        """Update supplied fields without replacing source/history/aggregate data."""
        data = dict(record)
        proposal_id = data.get("id") or str(data["_id"])
        data.pop("_id", None)
        data["id"] = proposal_id
        self.collection.update_one({"_id": proposal_id}, {"$set": data}, upsert=True)
        return self.get_by_id(proposal_id)

    def update_aggregate(
        self, proposal_id: str, aggregate: ProposalCommunityAggregateDTO
    ) -> bool:
        """Update only the community_aggregate sub-document on a proposal in MongoDB."""
        agg_data = aggregate.model_dump(mode="python")
        result = self.collection.update_one(
            {"_id": proposal_id},
            {"$set": {"community_aggregate": agg_data}},
        )
        if result.matched_count == 0:
            result = self.collection.update_one(
                {"id": proposal_id},
                {"$set": {"community_aggregate": agg_data}},
            )
        return result.matched_count > 0

    def replace_aggregate_if_current(self, record: dict, aggregate: ProposalCommunityAggregateDTO) -> bool:
        """Compare against the raw stored snapshot so older records work too."""
        result = self.collection.update_one(
            {"_id": record["_id"], "community_aggregate": record.get("community_aggregate")},
            {"$set": {"community_aggregate": aggregate.model_dump(mode="python")}},
        )
        return result.matched_count > 0

    def seed_if_empty(
        self, seed_file_path: Optional[Path] = None, force: bool = False
    ) -> int:
        """Seed proposals from the saved set of proposals if the collection is empty."""
        current_count = self.collection.count_documents({})
        if current_count > 0 and not force:
            logger.info("Proposals collection already has %d documents, skipping seed.", current_count)
            return 0

        target_file = seed_file_path or DEFAULT_SEED_FILE
        if not target_file.exists():
            logger.warning("Seed file not found at %s", target_file)
            return 0

        with open(target_file, "r", encoding="utf-8") as f:
            raw_data = json.load(f)

        rows = raw_data["proposals"] if isinstance(raw_data, dict) else raw_data
        seeded = 0
        for item in rows:
            self.save(item)
            seeded += 1

        logger.info("Successfully seeded %d proposals into MongoDB.", seeded)
        return seeded


class FeedbackRepository:
    """Concrete persistence operations for citizen feedback in MongoDB."""

    def __init__(self, db: Optional[Database] = None):
        self.db = db if db is not None else get_database()
        if self.db is None:
            raise ValueError("MongoDB database handle is required for FeedbackRepository.")
        self.collection = self.db["feedback"]

    def _doc_id(self, proposal_id: str, participant_id: str) -> str:
        return f"{proposal_id}:{participant_id}"

    def save_submission(
        self, submission: ProposalFeedbackSubmissionDTO
    ) -> Tuple[ProposalFeedbackSubmissionDTO, bool, Optional[ProposalFeedbackSubmissionDTO]]:
        """Save or update a feedback submission in MongoDB.

        Returns:
            Tuple of (saved_submission, is_new, previous_submission)
        """
        from datetime import datetime, timezone

        doc_id = self._doc_id(submission.proposal_id, submission.participant_id)
        existing = self.collection.find_one({"_id": doc_id})
        previous_sub: Optional[ProposalFeedbackSubmissionDTO] = None
        is_new = existing is None

        if existing is not None:
            existing_clean = dict(existing)
            existing_clean.pop("_id", None)
            try:
                previous_sub = ProposalFeedbackSubmissionDTO.model_validate(existing_clean)
            except Exception:
                pass

        if not submission.submitted_at:
            submission.submitted_at = datetime.now(timezone.utc).isoformat()

        doc_data = submission.model_dump(mode="python")
        doc_data["_id"] = doc_id
        doc_data["updated_at"] = datetime.now(timezone.utc)
        # Analysis must not consume a new raw response before its count update.
        doc_data["_aggregate_pending"] = True
        doc_data["_aggregate_previous"] = (
            existing.get("_aggregate_previous") if existing and existing.get("_aggregate_pending")
            else previous_sub.model_dump(mode="python") if previous_sub else None
        )
        # Preserve first participation across edits for change notifications.
        doc_data["created_at"] = (
            (existing.get("created_at") or existing.get("submitted_at"))
            if existing is not None else doc_data["updated_at"]
        )

        self.collection.replace_one({"_id": doc_id}, doc_data, upsert=True)
        return submission, is_new, previous_sub

    def mark_aggregated(self, submission: ProposalFeedbackSubmissionDTO) -> None:
        self.collection.update_one(
            {"_id": self._doc_id(submission.proposal_id, submission.participant_id),
             **submission.model_dump(mode="python")},
            {"$set": {"_aggregate_pending": False}},
        )

    def previous_aggregate_submission(self, submission, fallback=None):
        document = self.collection.find_one({"_id": self._doc_id(submission.proposal_id, submission.participant_id)})
        if document is None or "_aggregate_previous" not in document:
            return fallback
        previous = document["_aggregate_previous"]
        return ProposalFeedbackSubmissionDTO.model_validate(previous) if previous else None

    def get_for_analysis(self, proposal_id: str) -> list[ProposalFeedbackSubmissionDTO] | None:
        documents = list(self.collection.find({"proposal_id": proposal_id}))
        if any(doc.get("_aggregate_pending") for doc in documents):
            return None
        return [ProposalFeedbackSubmissionDTO.model_validate(doc) for doc in documents]

    def get_pending_aggregates(self, proposal_id: str):
        for doc in self.collection.find({"proposal_id": proposal_id, "_aggregate_pending": True}):
            previous = doc.get("_aggregate_previous")
            yield (ProposalFeedbackSubmissionDTO.model_validate(doc),
                   ProposalFeedbackSubmissionDTO.model_validate(previous) if previous else None)

    def get_by_proposal(self, proposal_id: str) -> List[ProposalFeedbackSubmissionDTO]:
        """Retrieve all feedback submissions for a proposal, sorted by submitted_at."""
        cursor = self.collection.find({"proposal_id": proposal_id}).sort("submitted_at", ASCENDING)
        results: List[ProposalFeedbackSubmissionDTO] = []
        for doc in cursor:
            doc.pop("_id", None)
            results.append(ProposalFeedbackSubmissionDTO.model_validate(doc))
        return results

    def get_by_participant(
        self, proposal_id: str, participant_id: str
    ) -> Optional[ProposalFeedbackSubmissionDTO]:
        """Retrieve a specific participant's feedback for a proposal."""
        doc_id = self._doc_id(proposal_id, participant_id)
        doc = self.collection.find_one({"_id": doc_id})
        if doc is None:
            return None
        doc.pop("_id", None)
        return ProposalFeedbackSubmissionDTO.model_validate(doc)

    def count_by_proposal(self, proposal_id: str) -> int:
        """Count total feedback submissions for a proposal."""
        return self.collection.count_documents({"proposal_id": proposal_id})


class CommentVoteRepository:
    """Persistence for upvotes/downvotes on individual comments.

    A comment is identified by the proposal plus the comment author's
    participant id (one submission per participant per proposal). A vote is
    identified by that pair plus the voter, so each user holds at most one
    vote per comment and can change or clear it.
    """

    def __init__(self, db: Optional[Database] = None):
        self.db = db if db is not None else get_database()
        if self.db is None:
            raise ValueError("MongoDB database handle is required for CommentVoteRepository.")
        self.collection = self.db["comment_votes"]

    def _doc_id(self, proposal_id: str, comment_owner: str, voter: str) -> str:
        return f"{proposal_id}:{comment_owner}:{voter}"

    def set_vote(self, proposal_id: str, comment_owner: str, voter: str, value: int) -> None:
        """Record, change, or clear a single voter's vote on a comment."""
        doc_id = self._doc_id(proposal_id, comment_owner, voter)
        if value == 0:
            self.collection.delete_one({"_id": doc_id})
            return
        self.collection.replace_one(
            {"_id": doc_id},
            {
                "_id": doc_id,
                "proposal_id": proposal_id,
                "comment_owner": comment_owner,
                "voter": voter,
                "value": value,
            },
            upsert=True,
        )

    def tallies_by_proposal(self, proposal_id: str) -> dict[str, dict[str, int]]:
        """Return per-comment-owner vote tallies: {owner: {up, down}}."""
        tallies: dict[str, dict[str, int]] = {}
        for doc in self.collection.find({"proposal_id": proposal_id}):
            owner = doc.get("comment_owner")
            if owner is None:
                continue
            bucket = tallies.setdefault(owner, {"up": 0, "down": 0})
            if doc.get("value", 0) > 0:
                bucket["up"] += 1
            elif doc.get("value", 0) < 0:
                bucket["down"] += 1
        return tallies

    def votes_by_voter(self, proposal_id: str, voter: str) -> dict[str, int]:
        """Return {comment_owner: value} for all of one voter's votes on a proposal."""
        result: dict[str, int] = {}
        for doc in self.collection.find({"proposal_id": proposal_id, "voter": voter}):
            owner = doc.get("comment_owner")
            if owner is not None:
                result[owner] = doc.get("value", 0)
        return result


class UserRepository:
    """Concrete persistence operations for user accounts in MongoDB.

    Uses the username as the MongoDB ``_id`` so that account creation is
    naturally unique even without relying on a separately-created unique
    index (useful in the in-memory test double, which does not enforce
    indexes).
    """

    def __init__(self, db: Optional[Database] = None):
        self.db = db if db is not None else get_database()
        if self.db is None:
            raise ValueError("MongoDB database handle is required for UserRepository.")
        self.collection = self.db["users"]

    def get_by_username(self, username: str):
        """Return the stored user record for a username, or None."""
        try:
            from users_DTO import UserRecordDTO
        except ImportError:
            from backend.users_DTO import UserRecordDTO

        doc = self.collection.find_one({"_id": username})
        if doc is None:
            doc = self.collection.find_one({"username": username})
        if doc is None:
            return None
        doc.pop("_id", None)
        return UserRecordDTO.model_validate(doc)

    def create(self, record) -> bool:
        """Insert a new user. Returns False if the username already exists."""
        if self.collection.find_one({"_id": record.username}) is not None:
            return False
        if self.collection.find_one({"username": record.username}) is not None:
            return False

        data = record.model_dump(mode="python")
        data["_id"] = record.username
        self.collection.replace_one({"_id": record.username}, data, upsert=True)
        return True
