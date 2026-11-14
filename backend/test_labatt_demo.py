import copy
import unittest
from collections import Counter
from unittest.mock import patch

from fastapi.testclient import TestClient
from pymongo.errors import AutoReconnect, DuplicateKeyError

from main import app
from persistence.test_persistence import MockMongoCollection, MockMongoDatabase
from service.labatt_demo import COLLECTION, PROPOSAL_ID, build_journey, bundled_seed

SEED = bundled_seed()
EARLIER, CURRENT = SEED.earlier, SEED.current
PREVIOUS = build_journey(SEED, {}).previous_response


class DemoCollection(MockMongoCollection):
    def replace_one(self, query, replacement, upsert=False):
        if upsert and query["_id"] in self.documents and not self.find_one(query):
            raise DuplicateKeyError("duplicate _id")
        return super().replace_one(query, replacement, upsert=upsert)


class LabattDemoTests(unittest.TestCase):
    def setUp(self):
        self.db = MockMongoDatabase()
        self.db.collections[COLLECTION] = DemoCollection()
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        database = patch.object(app.state, "database", self.db, create=True)
        database.start()
        self.addCleanup(database.stop)

    def request(self, method="GET", path="", token="a" * 64, **kwargs):
        return self.client.request(method, "/api/demos/labatt" + path, headers={
            "X-Proviso-Demo-Session": token,
            "Authorization": "Bearer ignored-by-demo",
        }, **kwargs)

    def save(self, journey, **update):
        response = {**journey["previous_response"], "version_id": CURRENT.id, **update}
        return self.request("PUT", "/response", json={"revision": journey["revision"], "response": response})

    def test_rounds_comments_groups_and_totals_are_scoped(self):
        response = self.request()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["Cache-Control"], "private, no-store")
        journey = response.json()
        earlier, current = journey["versions"]
        self.assertEqual(journey["current_version_id"], CURRENT.id)
        self.assertNotEqual(earlier["summary"], current["summary"])
        self.assertNotEqual(earlier["aggregate"]["proposal_specific"], current["aggregate"]["proposal_specific"])
        self.assertEqual(journey["participant_action"], "not reviewed")
        self.assertIsNone(journey["current_response"])
        self.assertEqual(journey["previous_response"]["position"], "oppose")
        self.assertEqual(journey["requirement_assessment"]["status"], "potentially addressed")
        self.assertEqual(journey["review_totals"], {"unreviewed": 4, "reconfirmed": 3, "revised": 17})
        self.assertEqual(journey["matched_positions"]["participants"], 20)
        self.assertEqual(journey["current_only"], 4)
        self.assertEqual(journey["distinct_participants"], 28)
        self.assertEqual(journey["grouping_origin"], "prepared")
        position_order = ["strongly_oppose", "oppose", "neutral", "support", "strongly_support", "unsure"]
        for position_round, supporting in (("earlier", 4), ("current", 13)):
            counts = journey["matched_positions"][position_round]
            self.assertEqual(counts["support"] + counts["strongly_support"], supporting)
        for version, positions, rating_counts in (
            (earlier, (4, 10, 4, 3, 1, 2), (16, 15, 17, 20)),
            (current, (1, 3, 3, 10, 5, 2), (16, 15, 19, 21)),
        ):
            rows = SEED.responses[version["id"]]
            saved = {row.submission.participant_id: row.submission for row in rows}
            aggregate = version["aggregate"]
            self.assertEqual(aggregate["total_participants"], 24)
            self.assertEqual(len(saved), 24)
            self.assertEqual(aggregate["position_distribution"], dict(zip(position_order, positions)))
            self.assertEqual(aggregate["position_distribution"], Counter(row.position for row in saved.values()))
            for feature, expected_count in zip(aggregate["proposal_specific"], rating_counts):
                ratings = Counter(row.element_ratings[feature["id"]] for row in saved.values()
                                  if feature["id"] in row.element_ratings)
                self.assertEqual(feature["total_responses"], expected_count)
                self.assertEqual(feature["distribution"], ratings)
            self.assertEqual(len(version["comments"]), 22)
            self.assertTrue(all(row["version_id"] == version["id"] for row in version["comments"]))
            for group in aggregate["condition_clusters"]:
                self.assertFalse(group["is_suggested"])
                self.assertEqual(group["count"], len(group["items"]))
                for item in group["items"]:
                    submission = saved[item["participant_id"]]
                    self.assertTrue(item["id"].startswith(version["id"]))
                    self.assertEqual(item["verbatim_quote"], submission.comment)
                    self.assertEqual(item["extracted_requirement"], submission.condition.requirement)
                    self.assertEqual(item["is_conditional_support"], submission.condition.is_conditional_support)
        self.assertEqual(earlier["comments"][0]["score"], 4)
        self.assertTrue(all(row["version_id"] == CURRENT.id for row in current["comments"]))
        self.assertNotIn(PREVIOUS.participant_id, [row["participant_id"] for row in current["comments"]])
        self.assertNotIn(journey["previous_response"]["comment"], [row["comment"] for row in current["comments"]])
        self.assertEqual(journey["review_totals"]["unreviewed"],
                         len(SEED.responses[EARLIER.id]) - journey["matched_positions"]["participants"])

    def test_keep_edit_reload_and_reset_only_the_active_session(self):
        self.db["imported_proposals"].replace_one({"_id": PROPOSAL_ID}, {"_id": PROPOSAL_ID, "summary": "reference"}, upsert=True)
        self.db["feedback"].replace_one({"_id": "reference"}, {"_id": "reference", "proposal_id": PROPOSAL_ID}, upsert=True)
        source_data = copy.deepcopy(self.db["imported_proposals"].documents)
        reference_feedback = copy.deepcopy(self.db["feedback"].documents)
        initial = self.request().json()
        baseline = initial["versions"][1]["aggregate"]
        reviews = initial["review_totals"]
        saved = self.save(initial, participant_id="not-the-demo-resident", upvotes=9, score=9)
        self.assertEqual(saved.status_code, 200)
        kept = saved.json()
        self.assertEqual(kept["participant_action"], "reconfirmed")
        self.assertEqual(kept["review_totals"], {
            "unreviewed": reviews["unreviewed"] - 1, "reconfirmed": reviews["reconfirmed"] + 1,
            "revised": reviews["revised"],
        })
        self.assertEqual(kept["current_response"]["position"], "oppose")
        self.assertEqual(kept["current_response"]["participant_id"], PREVIOUS.participant_id)
        self.assertEqual(kept["current_response"]["score"], 0)
        self.assertEqual(kept["versions"][1]["aggregate"]["total_participants"], baseline["total_participants"] + 1)
        self.assertEqual(self.request().json(), kept)
        self.assertEqual(self.save(initial).status_code, 409)

        revised = self.save(kept, position="support", element_ratings={"accessible_pickup": "support"},
                            comment="Edited comment", condition={"requirement": "Post pickup hours."}).json()
        self.assertEqual(revised["participant_action"], "revised")
        revised_totals = revised["versions"][1]["aggregate"]
        self.assertEqual(revised_totals["total_participants"], baseline["total_participants"] + 1)
        self.assertEqual(revised_totals["position_distribution"]["support"], baseline["position_distribution"]["support"] + 1)
        self.assertEqual(revised_totals["proposal_specific"][0]["distribution"]["support"],
                         baseline["proposal_specific"][0]["distribution"].get("support", 0) + 1)
        self.assertEqual(revised["versions"][1]["comments"][-1]["comment"], "Edited comment")
        self.assertEqual(revised["versions"][1]["aggregate"]["condition_clusters"][0]["items"][-1]["extracted_requirement"], "Post pickup hours.")
        self.assertEqual(revised["previous_response"], initial["previous_response"])
        self.assertEqual(revised["versions"][0], initial["versions"][0])

        other_token = "b" * 64
        other = self.request(token=other_token).json()
        self.assertIsNone(other["current_response"])
        self.assertEqual(other["versions"][1], initial["versions"][1])
        other_saved = self.request("PUT", "/response", token=other_token, json={
            "revision": other["revision"], "response": {**other["previous_response"], "version_id": CURRENT.id},
        }).json()
        reset = self.request("POST", "/reset", json={"revision": revised["revision"]}).json()
        self.assertIsNone(reset["current_response"])
        self.assertEqual(reset["versions"], initial["versions"])
        self.assertEqual(self.save(revised).status_code, 409)
        self.assertEqual(self.request(token=other_token).json(), other_saved)
        self.assertEqual(self.db["imported_proposals"].documents, source_data)
        self.assertEqual(self.db["feedback"].documents, reference_feedback)

    def test_rejects_wrong_proposal_round_features_and_storage_failure(self):
        initial = self.request().json()
        self.assertEqual(self.save(initial, version_id=EARLIER.id).status_code, 422)
        self.assertEqual(self.save(initial, proposal_id="another-proposal").status_code, 422)
        self.assertEqual(self.save(initial, element_ratings={"unknown": "support"}).status_code, 422)
        self.assertEqual(self.save(initial, condition={"requirement": "  "}).status_code, 422)
        self.assertEqual(self.request(token="not-a-demo-token").status_code, 422)
        with patch.object(self.db[COLLECTION], "replace_one", side_effect=AutoReconnect):
            self.assertEqual(self.save(initial).status_code, 503)
        self.assertEqual(self.request().json(), initial)
        self.assertEqual(self.save(initial).status_code, 200)

    def test_requirement_assessment_cites_matching_feature_without_changing_position(self):
        journey = self.request().json()
        assessment = journey["requirement_assessment"]
        self.assertEqual(assessment["feature_id"], PREVIOUS.condition.feature_id)
        self.assertEqual(assessment["version_id"], CURRENT.id)
        self.assertIn(assessment["passage"], CURRENT.arrangements)
        self.assertEqual(journey["previous_response"]["position"], "oppose")
        assessments = journey["versions"][0]["requirement_assessments"]
        self.assertEqual(assessments[f"{EARLIER.id}-labatt-demo-p05"]["status"], "unresolved")
        self.assertTrue(any(item["status"] == "uncertain" for item in assessments.values()))
        for item in assessments.values():
            change = next(change for change in CURRENT.changes if change.feature_id == item["feature_id"])
            self.assertEqual(item["passage"], change.after)
        earlier_groups = {group["id"]: group for group in journey["versions"][0]["aggregate"]["condition_clusters"]}
        self.assertNotIn("labatt-demo-p04", {item["participant_id"] for item in earlier_groups["later-deliveries"]["items"]})
        current_groups = {group["id"]: group for group in journey["versions"][1]["aggregate"]["condition_clusters"]}
        self.assertIn("labatt-demo-p05", {item["participant_id"] for item in current_groups["building-scale"]["items"]})
        self.assertEqual(journey["versions"][1]["requirement_assessments"], {})


if __name__ == "__main__":
    unittest.main()
