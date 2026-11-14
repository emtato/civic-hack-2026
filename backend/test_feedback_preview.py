"""Resident review must happen before persistence or request counting."""

import copy
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from auth import get_current_user, get_user_repository
from main import app, get_service
from proposals_DTO import Proposal
from persistence.persistence import UserRepository
from service.condition_grouping import CommentExtraction, ExtractedRequest, GroupingUnavailable
from service.service import FeedbackService
from service.test_automatic_grouping import Database
from users_DTO import UserPublicDTO


class FeedbackPreviewTests(unittest.TestCase):
    def setUp(self):
        self.db = Database()
        self.service = FeedbackService(self.db)
        self.service.save_proposal(Proposal(
            id="park", title="Park", neighbourhood="Toronto", topic="Planning",
            status="Proposed", summary="", source="",
        ))
        app.dependency_overrides[get_service] = lambda: self.service
        app.dependency_overrides[get_user_repository] = lambda: UserRepository(self.db)
        app.dependency_overrides[get_current_user] = lambda: UserPublicDTO(username="alice")
        self.client = TestClient(app)
        self.url = "/api/proposals/park/feedback"
        self.draft = {"comment": "Please add benches and shade."}

    def tearDown(self):
        app.dependency_overrides.clear()

    def documents(self):
        return copy.deepcopy({name: collection.documents for name, collection in self.db.collections.items()})

    def preview(self):
        with patch("service.feedback_analysis.extract_requests", return_value=[CommentExtraction(
            number=0, requests=[
                ExtractedRequest(requirement="Add benches", quote="add benches"),
                ExtractedRequest(requirement="Add shade", quote="shade"),
            ],
        )]):
            response = self.client.post(self.url + "/preview", json=self.draft)
        self.assertEqual(200, response.status_code)
        return response.json()

    def submit(self, requests, **overrides):
        return self.client.post(self.url, json={
            "proposal_id": "park", "participant_id": "ignored", "position": "support",
            "stakeholder_role": "resident", **self.draft,
            "confirmed_requests": requests, **overrides,
        })

    def test_preview_and_abandonment_write_nothing(self):
        before = self.documents()
        self.assertEqual(2, len(self.preview()))
        self.assertEqual(before, self.documents())
        self.assertIsNone(self.service.feedback.get_by_participant("park", "alice"))

    def test_only_edited_confirmed_requests_count_and_background_never_reextracts(self):
        requests = self.preview()
        requests = [{**requests[0], "requirement": "Add accessible benches", "location_label": "Entrance"}]
        response = self.submit(requests)
        self.assertEqual(201, response.status_code)
        aggregate = response.json()["community_aggregate"]
        self.assertEqual(1, aggregate["total_participants"])
        self.assertEqual(1, aggregate["total_conditions"])
        item = aggregate["condition_clusters"][0]["items"][0]
        self.assertEqual("Add accessible benches", item["extracted_requirement"])
        self.assertEqual("Entrance", item["location_label"])
        self.assertEqual("add benches", item["verbatim_quote"])
        self.assertFalse(item["is_conditional_support"])
        with patch("service.feedback_analysis.extract_requests", side_effect=AssertionError("Already confirmed")):
            grouped = self.service.group_conditions("park")
        self.assertEqual(1, grouped.total_conditions)
        saved = self.service.feedback.get_by_participant("park", "alice")
        self.assertEqual("Add accessible benches", saved.confirmed_requests[0].requirement)
        self.assertEqual(self.draft["comment"], saved.comment)

    def test_edit_removes_old_requests_without_adding_a_participant(self):
        self.assertEqual(201, self.submit(self.preview()).status_code)
        response = self.submit([])
        self.assertEqual(201, response.status_code)
        aggregate = response.json()["community_aggregate"]
        self.assertEqual(1, aggregate["total_participants"])
        self.assertEqual(0, aggregate["total_conditions"])
        with patch("service.feedback_analysis.extract_requests", side_effect=AssertionError("Opted out")):
            self.assertEqual(0, self.service.group_conditions("park").total_conditions)

    def test_manual_requirement_and_matching_comment_request_count_once(self):
        response = self.submit([{"requirement": "Add benches", "quote": "add benches"}], condition={
            "requirement": "Add benches", "is_conditional_support": True,
        })
        self.assertEqual(201, response.status_code)
        self.assertEqual(1, response.json()["community_aggregate"]["total_conditions"])
        with patch("service.feedback_analysis.extract_requests", side_effect=AssertionError("Already confirmed")):
            self.assertEqual(1, self.service.group_conditions("park").total_conditions)

    def test_fabricated_quotes_are_rejected_before_persistence(self):
        before = self.documents()
        self.assertEqual(422, self.submit([{"requirement": "Add benches", "quote": "Made-up evidence"}]).status_code)
        self.assertEqual(before, self.documents())

    def test_preview_failure_leaves_draft_unsaved_and_allows_explicit_opt_out(self):
        before = self.documents()
        with patch("service.feedback_analysis.extract_requests", side_effect=GroupingUnavailable("Try later")):
            response = self.client.post(self.url + "/preview", json=self.draft)
        self.assertEqual(503, response.status_code)
        self.assertEqual(before, self.documents())
        self.assertEqual(201, self.submit([]).status_code)
        with patch("service.feedback_analysis.extract_requests", side_effect=AssertionError("Opted out")):
            self.assertEqual(0, self.service.group_conditions("park").total_conditions)

    def test_old_http_clients_cannot_trigger_unconfirmed_extraction(self):
        response = self.submit(None)
        self.assertEqual(201, response.status_code)
        self.assertEqual([], response.json()["feedback"]["confirmed_requests"])
        with patch("service.feedback_analysis.extract_requests", side_effect=AssertionError("Unconfirmed")):
            self.assertEqual(0, self.service.group_conditions("park").total_conditions)

    def test_blank_comment_does_not_call_ai_and_unknown_proposal_is_rejected(self):
        with patch("service.feedback_analysis.extract_requests", side_effect=AssertionError("Unexpected call")):
            response = self.client.post(self.url + "/preview", json={"comment": ""})
            self.assertEqual(200, response.status_code)
            self.assertEqual([], response.json())
            self.assertEqual(404, self.client.post("/api/proposals/missing/feedback/preview", json=self.draft).status_code)

    def test_preview_requires_authentication(self):
        app.dependency_overrides.pop(get_current_user)
        self.assertEqual(401, self.client.post(self.url + "/preview", json=self.draft).status_code)


if __name__ == "__main__":
    unittest.main()
