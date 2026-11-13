"""Tests for concrete MongoDB persistence layer (ProposalRepository and FeedbackRepository)."""

import copy
import unittest
from pathlib import Path
from types import SimpleNamespace

try:
    from proposals_DTO import Proposal, ProposalFeedbackSubmissionDTO
    from persistence.persistence import FeedbackRepository, ProposalRepository
except ImportError:
    from backend.proposals_DTO import Proposal, ProposalFeedbackSubmissionDTO
    from backend.persistence.persistence import FeedbackRepository, ProposalRepository

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SEED_FILE = DATA_DIR / "seed_proposals.json"


class MockMongoCollection:
    """In-memory collection mock for sandboxed testing."""

    def __init__(self, name="collection"):
        self.name = name
        self.documents = {}

    def create_index(self, *args, **kwargs):
        pass

    def count_documents(self, query=None):
        query = query or {}
        return len(list(self._filter(query)))

    def find_one(self, query, projection=None):
        results = list(self._filter(query))
        return copy.deepcopy(results[0]) if results else None

    def find(self, query=None):
        query = query or {}
        matches = [copy.deepcopy(doc) for doc in self._filter(query)]

        class MockCursor:
            def __init__(self, docs):
                self.docs = docs

            def sort(self, key, direction=1):
                return self

            def __iter__(self):
                return iter(self.docs)

        return MockCursor(matches)

    def replace_one(self, query, replacement, upsert=False):
        matches = list(self._filter(query))
        if matches:
            doc_id = matches[0]["_id"]
            self.documents[doc_id] = copy.deepcopy(replacement)
            return SimpleNamespace(matched_count=1, modified_count=1, upserted_id=None)
        elif upsert:
            doc_id = replacement.get("_id") or query.get("_id") or f"id-{len(self.documents)}"
            data = copy.deepcopy(replacement)
            data["_id"] = doc_id
            self.documents[doc_id] = data
            return SimpleNamespace(matched_count=0, modified_count=0, upserted_id=doc_id)
        return SimpleNamespace(matched_count=0, modified_count=0, upserted_id=None)

    def update_one(self, query, update, upsert=False):
        matches = list(self._filter(query))
        if matches:
            doc = self.documents[matches[0]["_id"]]
            for k, v in update.get("$set", {}).items():
                if "." in k:
                    p, c = k.split(".", 1)
                    doc.setdefault(p, {})[c] = copy.deepcopy(v)
                else:
                    doc[k] = copy.deepcopy(v)
            return SimpleNamespace(matched_count=1, modified_count=1, upserted_id=None)
        return SimpleNamespace(matched_count=0, modified_count=0, upserted_id=None)

    def _filter(self, query):
        for doc in self.documents.values():
            match = True
            for k, v in query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                yield doc


class MockMongoDatabase:
    """In-memory database mock."""

    def __init__(self):
        self.collections = {}

    def __getitem__(self, name):
        if name not in self.collections:
            self.collections[name] = MockMongoCollection(name)
        return self.collections[name]

    def __getattr__(self, name):
        return self[name]


class PersistenceTests(unittest.TestCase):
    def setUp(self):
        self.db = MockMongoDatabase()
        self.proposals_repo = ProposalRepository(self.db)
        self.feedback_repo = FeedbackRepository(self.db)

    def test_seed_proposals_if_empty(self):
        self.assertEqual(self.proposals_repo.get_all(), [])
        count = self.proposals_repo.seed_if_empty()
        self.assertEqual(count, 3)

        all_props = self.proposals_repo.get_all()
        self.assertEqual(len(all_props), 3)

        kensington = self.proposals_repo.get_by_id("kensington")
        self.assertIsNotNone(kensington)
        self.assertEqual(kensington.id, "kensington")
        self.assertEqual(kensington.title, "A new chapter for Kensington Market")

    def test_save_and_retrieve_proposal(self):
        proposal = Proposal(
            id="park-redesign",
            title="Park Redesign",
            neighbourhood="Downtown",
            topic="Public space",
            status="Open for feedback",
            coordinates=[43.65, -79.38],
            summary="New park amenities",
            changes=["New benches"],
            source="https://toronto.ca/test",
            shape=[[43.65, -79.38]],
        )
        self.proposals_repo.save(proposal)

        retrieved = self.proposals_repo.get_by_id("park-redesign")
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.id, "park-redesign")
        self.assertEqual(retrieved.changes, ["New benches"])

    def test_save_and_retrieve_feedback(self):
        sub = ProposalFeedbackSubmissionDTO(
            proposal_id="kensington",
            participant_id="user-1",
            position="support",
            stakeholder_role="resident",
            element_ratings={"loading_windows": "support"},
            comment="Delivery access needed",
        )
        saved, is_new, prev = self.feedback_repo.save_submission(sub)
        self.assertTrue(is_new)
        self.assertIsNone(prev)

        feedbacks = self.feedback_repo.get_by_proposal("kensington")
        self.assertEqual(len(feedbacks), 1)
        self.assertEqual(feedbacks[0].participant_id, "user-1")

        user_sub = self.feedback_repo.get_by_participant("kensington", "user-1")
        self.assertIsNotNone(user_sub)
        self.assertEqual(user_sub.position, "support")


if __name__ == "__main__":
    unittest.main()
