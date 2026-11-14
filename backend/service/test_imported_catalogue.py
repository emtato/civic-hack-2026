"""Real imported examples must work through conversion, routes and feedback."""

import copy
import json
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from main import app, get_service
from persistence.test_persistence import MockMongoDatabase
from proposals_DTO import Proposal, ProposalFeedbackSubmissionDTO
from service.service import FeedbackService, to_display_proposal


class ImportedCatalogueTests(unittest.TestCase):
    def setUp(self):
        self.db = MockMongoDatabase()
        self.service = FeedbackService(self.db)
        rows = json.loads((Path(__file__).resolve().parents[1] / "data/proposals.formatted.json").read_text())["proposals"]
        self.rows = rows
        for row in rows:
            self.service.proposals.save(row)
        # The legacy collection must never leak into the imported catalogue.
        self.db.proposals.replace_one({"_id": "legacy"}, {"_id": "legacy", "title": "Old fixture"}, upsert=True)
        app.dependency_overrides[get_service] = lambda: self.service
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_api_returns_all_24_with_no_legacy_fixtures(self):
        response = self.client.get("/api/proposals")
        self.assertEqual(200, response.status_code)
        rows = response.json()
        self.assertEqual(24, len(rows))
        self.assertEqual(6, len({r["topic"] for r in rows}))
        self.assertNotIn("legacy", {r["id"] for r in rows})
        self.assertEqual(16, sum(r["coordinates"] is not None for r in rows))
        self.assertTrue(all(r["shape"] == [] for r in rows))
        for row in rows:
            self.assertEqual(0, row["community_aggregate"]["total_participants"])
            self.assertTrue(row["community_aggregate"]["proposal_specific"])
            self.assertIn("archived notice", row["status"])
            Proposal.model_validate(row)

    def test_coordinate_order_citywide_and_source_are_converted_without_writes(self):
        original = next(row for row in self.rows if row["map_point"])
        stored_before = copy.deepcopy(self.db.imported_proposals.documents)
        response = self.client.get(f'/api/proposals/{original["id"]}')
        self.assertEqual(200, response.status_code)
        display = response.json()
        self.assertEqual(list(reversed(original["map_point"]["coordinates"])), display["coordinates"])
        self.assertEqual(original["source_notices"][-1]["url"], display["source"])
        citywide = next(row for row in self.rows if row["geographic_scope"] == "citywide")
        converted = self.service.get_proposal(citywide["id"])
        self.assertIsNone(converted.coordinates)
        self.assertEqual("Toronto-wide", converted.neighbourhood)
        self.assertEqual(stored_before, self.db.imported_proposals.documents)

    def test_shared_feature_sentences_appear_once_without_removing_feedback_elements(self):
        original = next(row for row in self.rows if row["id"] == "toronto-labatt-river-towers")
        stored_before = copy.deepcopy(self.db.imported_proposals.documents)
        changes = [f["proposed_change"] or f["description"] or f["label"] for f in original["features"]]
        self.assertGreater(len(changes), len(set(changes)))

        response = self.client.get(f'/api/proposals/{original["id"]}')
        self.assertEqual(200, response.status_code)
        display = response.json()
        self.assertEqual(list(dict.fromkeys(changes)), display["changes"])
        self.assertEqual(
            [f["id"] for f in original["features"]],
            [element["id"] for element in display["community_aggregate"]["proposal_specific"]],
        )
        catalogue = self.client.get("/api/proposals").json()
        self.assertTrue(all(len(row["changes"]) == len(set(row["changes"])) for row in catalogue))
        self.assertEqual(stored_before, self.db.imported_proposals.documents)

    def test_display_overrides_and_saved_dtos_preserve_only_first_occurrence(self):
        original = copy.deepcopy(self.rows[0])
        changes = ["First change", "Second change", "First change", "Third change", "Second change"]
        original["display_overrides"] = {"changes": changes}
        before = copy.deepcopy(original)
        display = to_display_proposal(original)
        self.assertEqual(["First change", "Second change", "Third change"], display.changes)
        self.assertEqual(before, original)

        saved_dto = display.model_dump()
        saved_dto["changes"] = changes
        self.assertEqual(display.changes, to_display_proposal(saved_dto).changes)
        self.assertEqual(changes, saved_dto["changes"])

    def test_feedback_updates_imported_aggregate_and_preserves_rich_record(self):
        pid = self.rows[0]["id"]
        original = copy.deepcopy(self.db.imported_proposals.documents[pid])
        element = self.service.get_proposal(pid).community_aggregate.proposal_specific[0].id
        submission = ProposalFeedbackSubmissionDTO(
            proposal_id=pid, participant_id="catalogue-test", position="support",
            stakeholder_role="resident", element_ratings={element: "support"},
        )
        self.service.submit_feedback(submission)
        submission.position = "oppose"
        _, aggregate = self.service.submit_feedback(submission)
        self.assertEqual(1, aggregate.total_participants)
        self.assertEqual(0, aggregate.position_distribution["support"])
        self.assertEqual(1, aggregate.position_distribution["oppose"])
        self.assertEqual(1, aggregate.proposal_specific[0].total_responses)
        stored = self.db.imported_proposals.documents[pid]
        self.assertEqual(original, {k: v for k, v in stored.items() if k != "community_aggregate"})
        self.assertEqual(1, self.client.get(f"/api/proposals/{pid}/aggregate").json()["total_participants"])

    def test_display_edits_do_not_replace_source_or_imported_status(self):
        pid = self.rows[0]["id"]
        original = copy.deepcopy(self.db.imported_proposals.documents[pid])
        proposal = self.service.get_proposal(pid)
        proposal.title = "Edited display title"
        self.service.save_proposal(proposal)
        self.assertEqual("Edited display title", self.service.get_proposal(pid).title)
        saved = self.db.imported_proposals.documents[pid]
        self.assertEqual(original["source_notices"], saved["source_notices"])
        self.assertEqual(original["status"], saved["status"])
        self.assertEqual(original["features"], saved["features"])

    def test_seed_defaults_to_formatted_imports_not_old_three(self):
        service = FeedbackService(MockMongoDatabase())
        self.assertEqual(24, service.seed_initial_proposals())
        self.assertEqual(24, len(service.get_proposals()))
        self.assertEqual(0, service.seed_initial_proposals())


if __name__ == "__main__":
    unittest.main()
