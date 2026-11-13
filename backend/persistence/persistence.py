"""Persistence layer communicating with MongoDB for Proposals and Citizen Feedback.

Pure persistence:
- ProposalRepository: CRUD and query operations for proposals in MongoDB.
- FeedbackRepository: CRUD and query operations for feedback in MongoDB.
- Uses database connection from backend.database.
"""

import json
import logging
from pathlib import Path
from typing import List, Optional, Tuple

from pymongo import ASCENDING
from pymongo.database import Database

try:
    from models import Proposal, ProposalCommunityAggregateDTO, ProposalFeedbackSubmissionDTO
except ImportError:
    from backend.models import Proposal, ProposalCommunityAggregateDTO, ProposalFeedbackSubmissionDTO

try:
    from database.database import get_database
except ImportError:
    from backend.database.database import get_database

logger = logging.getLogger("civic.persistence")

# Default seed data path
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DEFAULT_SEED_FILE = DATA_DIR / "seed_proposals.json"


class ProposalRepository:
    """Concrete persistence operations for proposals in MongoDB."""

    def __init__(self, db: Optional[Database] = None):
        self.db = db if db is not None else get_database()
        if self.db is None:
            raise ValueError("MongoDB database handle is required for ProposalRepository.")
        self.collection = self.db["proposals"]

    def get_all(self) -> List[Proposal]:
        """Retrieve all proposals from MongoDB."""
        cursor = self.collection.find({})
        proposals: List[Proposal] = []
        for doc in cursor:
            if "id" not in doc and "_id" in doc:
                doc["id"] = str(doc["_id"])
            doc.pop("_id", None)
            proposals.append(Proposal.model_validate(doc))
        return proposals

    def get_by_id(self, proposal_id: str) -> Optional[Proposal]:
        """Retrieve a single proposal by its ID."""
        doc = self.collection.find_one({"_id": proposal_id})
        if doc is None:
            doc = self.collection.find_one({"id": proposal_id})
        if doc is None:
            return None
        if "id" not in doc and "_id" in doc:
            doc["id"] = str(doc["_id"])
        doc.pop("_id", None)
        return Proposal.model_validate(doc)

    def save(self, proposal: Proposal) -> Proposal:
        """Upsert a proposal into MongoDB."""
        data = proposal.model_dump(mode="python")
        proposal_id = proposal.id
        data["_id"] = proposal_id
        self.collection.replace_one({"_id": proposal_id}, data, upsert=True)
        return proposal

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

        seeded = 0
        for item in raw_data:
            proposal = Proposal.model_validate(item)
            self.save(proposal)
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
        if is_new:
            doc_data["created_at"] = doc_data["updated_at"]

        self.collection.replace_one({"_id": doc_id}, doc_data, upsert=True)
        return submission, is_new, previous_sub

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
