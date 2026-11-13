"""FastAPI endpoint integration tests."""

import unittest
from fastapi.testclient import TestClient

try:
    from main import app, get_service
    from persistence.test_persistence import MockMongoDatabase, SEED_FILE
    from service.service import FeedbackService
except ImportError:
    from backend.main import app, get_service
    from backend.persistence.test_persistence import MockMongoDatabase, SEED_FILE
    from backend.service.service import FeedbackService


class ApiIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.mock_db = MockMongoDatabase()
        self.service = FeedbackService(self.mock_db)
        self.service.proposals.seed_if_empty(SEED_FILE)

        app.dependency_overrides[get_service] = lambda: self.service
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_health_check(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"status": "ok"})

    def test_list_proposals(self):
        res = self.client.get("/api/proposals")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data), 3)
        self.assertIn("id", data[0])
        self.assertIn("community_aggregate", data[0])

    def test_get_single_proposal(self):
        res = self.client.get("/api/proposals/kensington")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["id"], "kensington")
        self.assertEqual(data["title"], "A new chapter for Kensington Market")
        self.assertEqual(data["community_aggregate"]["total_participants"], 45)

    def test_get_single_proposal_not_found(self):
        res = self.client.get("/api/proposals/non-existent")
        self.assertEqual(res.status_code, 404)

    def test_blank_requirement_is_rejected_without_counting_a_response(self):
        res = self.client.post("/api/proposals/kensington/feedback", json={
            "proposal_id": "kensington", "participant_id": "blank-requirement",
            "position": "support", "stakeholder_role": "resident",
            "condition": {"requirement": "   "},
        })
        self.assertEqual(res.status_code, 422)
        self.assertEqual(self.service.get_aggregate("kensington").total_participants, 45)

    def test_submit_feedback_and_get_aggregate(self):
        feedback_payload = {
            "proposal_id": "kensington",
            "participant_id": "api-tester-1",
            "position": "support",
            "stakeholder_role": "business",
            "element_ratings": {
                "loading_windows": "support"
            },
            "comment": "Morning loading is essential for our bakery delivery vans.",
            "condition": {
                "feature_id": "loading_windows",
                "requirement": "Dedicated delivery window between 7–9 AM",
                "is_conditional_support": True,
                "time_window": "7–9 AM",
                "location_label": "Augusta Ave"
            },
            "concern_coordinates": [43.6545, -79.4025]
        }

        # 1. Submit feedback
        post_res = self.client.post("/api/proposals/kensington/feedback", json=feedback_payload)
        self.assertEqual(post_res.status_code, 201)
        res_data = post_res.json()
        self.assertEqual(res_data["status"], "success")
        self.assertEqual(res_data["community_aggregate"]["total_participants"], 46)

        # 2. Get aggregate
        agg_res = self.client.get("/api/proposals/kensington/aggregate")
        self.assertEqual(agg_res.status_code, 200)
        agg_data = agg_res.json()
        self.assertEqual(agg_data["total_participants"], 46)
        self.assertEqual(agg_data["stakeholder_distribution"]["business"], 13)

        # 3. Retrieve participant's feedback
        user_res = self.client.get("/api/proposals/kensington/feedback/api-tester-1")
        self.assertEqual(user_res.status_code, 200)
        user_feedback = user_res.json()
        self.assertEqual(user_feedback["participant_id"], "api-tester-1")
        self.assertEqual(user_feedback["stakeholder_role"], "business")

        # 4. List all feedback for proposal
        list_res = self.client.get("/api/proposals/kensington/feedback")
        self.assertEqual(list_res.status_code, 200)
        feedbacks = list_res.json()
        self.assertEqual(len(feedbacks), 1)


if __name__ == "__main__":
    unittest.main()
