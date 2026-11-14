"""Source history regressions; isolated MongoDB double and HTTP fixtures only."""

import copy
import json
import ssl
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from urllib.error import URLError
from urllib.parse import parse_qs, urlparse

from pymongo.errors import DuplicateKeyError

from imported_data_dto import SourceNotice
from service.proposal_snapshots import ProposalSnapshotService, _fetch_notices


class Collection:
    def __init__(self):
        self.documents = {}
        self.unique = []

    def create_index(self, keys, **options):
        if options.get("unique"):
            self.unique.append([key for key, _ in keys])

    def find_one(self, query, sort=None):
        matches = [doc for doc in self.documents.values()
                   if self.matches(doc, query)]
        if sort:
            for key, direction in reversed(sort):
                matches.sort(key=lambda doc: doc[key], reverse=direction == -1)
        return copy.deepcopy(matches[0]) if matches else None

    @staticmethod
    def matches(doc, query):
        for key, value in query.items():
            if isinstance(value, dict):
                if "$in" in value and doc.get(key) not in value["$in"]:
                    return False
                if "$gt" in value and doc.get(key, 0) <= value["$gt"]:
                    return False
                if "$lte" in value and doc.get(key, 0) > value["$lte"]:
                    return False
            elif doc.get(key) != value:
                return False
        return True

    def find(self, query):
        class Cursor(list):
            def sort(self, key, direction):
                return Cursor(sorted(self, key=lambda doc: doc[key], reverse=direction == -1))
        return Cursor(copy.deepcopy(doc) for doc in self.documents.values() if self.matches(doc, query))

    def insert_one(self, document):
        if document["_id"] in self.documents:
            raise DuplicateKeyError("Duplicate ID")
        for keys in self.unique:
            if any(all(doc[key] == document[key] for key in keys) for doc in self.documents.values()):
                raise DuplicateKeyError("Duplicate sequence")
        self.documents[document["_id"]] = copy.deepcopy(document)

    def update_one(self, query, update, upsert=False):
        found = self.find_one(query)
        if found is None:
            if not upsert:
                return SimpleNamespace(matched_count=0)
            self.insert_one({**query, **update.get("$setOnInsert", {}), **update.get("$set", {})})
            return SimpleNamespace(matched_count=0)
        document = self.documents[found["_id"]]
        document.update(copy.deepcopy(update.get("$set", {})))
        for key, value in update.get("$inc", {}).items():
            document[key] = document.get(key, 0) + value
        return SimpleNamespace(matched_count=1)

    def find_one_and_update(self, query, update, **kwargs):
        found = self.find_one(query)
        if found is None:
            return None
        self.update_one(query, update)
        return self.find_one({"_id": found["_id"]})


class Database:
    def __init__(self):
        self.collections = {}

    def __getitem__(self, name):
        return self.collections.setdefault(name, Collection())


class SnapshotTests(unittest.TestCase):
    def setUp(self):
        self.db = Database()
        self.raw = {
            "noticeId": 8002, "title": "Loading proposal", "noticeDate": 1793941200000,
            "noticeDescription": '<p>Loading from 7–10 AM.</p><p>Keep access.</p>',
            "topics": ["Transportation", "Planning"],
            "contact": {"emailAddress": "old@example.test"}, "uniqueMapUrl": ["old.png"],
        }
        self.source = SourceNotice(
            notice_id=8002, url="https://secure.toronto.ca/nm/api/individual/notice/8002.do",
            title=self.raw["title"], published_at=datetime(2026, 11, 6, 5, tzinfo=timezone.utc),
            description_text="Old source", notice_kind="intention", raw_sha256="original",
        )
        self.original_proposal = {
            "_id": "example", "id": "example", "source_notices": [self.source.model_dump()],
            "versions": [{"id": "published-v1"}], "community_aggregate": {"total_participants": 5},
        }
        self.db["imported_proposals"].insert_one(self.original_proposal)
        self.db["feedback"].insert_one({"_id": "response", "comment": "Keep access"})
        self.service = ProposalSnapshotService(self.db, fetch_notices=lambda _: [copy.deepcopy(self.raw)])

    def capture(self):
        return self.service.refresh_proposal_snapshot("example")

    def test_first_capture_persists_source_evidence_without_changing_live_proposal(self):
        self.assertFalse(self.db["proposal_snapshots"].documents)
        result = self.capture()
        self.assertTrue(result.created)
        self.assertEqual(1, result.snapshot.sequence)
        self.assertIsNone(result.snapshot.previous_snapshot_id)
        self.assertEqual([self.raw], result.snapshot.raw_notices)
        self.assertEqual(self.original_proposal, self.db["imported_proposals"].find_one({"_id": "example"}))
        self.assertEqual("Keep access", self.db["feedback"].find_one({"_id": "response"})["comment"])

    def test_identical_fetch_and_presentation_only_edits_do_not_add_snapshots(self):
        first = self.capture().snapshot
        self.raw["noticeDescription"] = '<p class="new"> Loading\n from <b>7–10 AM.</b> </p>\n<p>Keep access.</p>'
        self.raw["uniqueMapUrl"] = ["new.png"]
        self.raw["topics"].reverse()
        second = self.capture()
        self.assertFalse(second.created)
        self.assertEqual(first.id, second.snapshot.id)
        self.assertEqual(1, len(self.db["proposal_snapshots"].documents))

    def test_revision_and_reversion_both_append_with_history_intact(self):
        first = self.capture().snapshot
        original = self.raw["noticeDescription"]
        self.raw["noticeDescription"] = "<p>Loading from 7–9 AM.</p>"
        second = self.capture().snapshot
        self.raw["noticeDescription"] = original
        third = self.capture().snapshot
        self.assertEqual(first.content_sha256, third.content_sha256)
        self.assertNotEqual(first.id, third.id)
        self.assertEqual(first.id, second.previous_snapshot_id)
        self.assertEqual(second.id, third.previous_snapshot_id)
        self.assertEqual(3, third.sequence)

    def test_diff_is_persisted_repeatable_and_contains_readable_before_after(self):
        first = self.capture().snapshot
        self.raw["noticeDescription"] = "<p>Loading from 7–9 AM.</p>"
        second = self.capture().snapshot
        diff = self.service.compare_proposal_snapshots("example", first.id, second.id)
        self.assertEqual("unclassified", diff.classification)
        self.assertTrue(diff.review_required)
        change = next(c for c in diff.changes if c.path.endswith("/noticeDescription"))
        self.assertIn("7–10 AM", change.before)
        self.assertIn("7–9 AM", change.after)
        self.assertIn("-Loading from 7–10 AM.", change.text_diff)
        again = self.service.compare_proposal_snapshots("example", first.id, second.id)
        self.assertEqual(diff, again)
        self.assertEqual(1, len(self.db["proposal_snapshot_diffs"].documents))

    def test_contact_edit_is_captured_but_not_classified_as_amendment(self):
        first = self.capture().snapshot
        self.raw["contact"]["emailAddress"] = "new@example.test"
        second = self.capture().snapshot
        diff = self.service.compare_proposal_snapshots("example", first.id, second.id)
        self.assertEqual("/notices/8002/contact/emailAddress", diff.changes[0].path)
        self.assertEqual("unclassified", diff.classification)

    def test_link_target_changes_are_not_lost_when_display_text_is_identical(self):
        self.raw["noticeDescription"] = '<a href="/old.pdf">Details</a>'
        first = self.capture().snapshot
        self.raw["noticeDescription"] = '<a href="/new.pdf">Details</a>'
        second = self.capture().snapshot
        diff = self.service.compare_proposal_snapshots("example", first.id, second.id)
        self.assertEqual(["/notices/8002/noticeDescriptionLinks"], [c.path for c in diff.changes])

    def test_added_removed_and_null_values_remain_distinct(self):
        first = self.capture().snapshot
        del self.raw["contact"]
        self.raw["subheading"] = None
        second = self.capture().snapshot
        diff = self.service.compare_proposal_snapshots("example", first.id, second.id)
        self.assertEqual({"removed", "added"}, {c.operation for c in diff.changes})

    def test_identical_snapshots_have_no_changes_or_review_requirement(self):
        first = self.capture().snapshot
        diff = self.service.compare_proposal_snapshots("example", first.id, first.id)
        self.assertEqual([], diff.changes)
        self.assertFalse(diff.review_required)

    def test_foreign_missing_and_reversed_snapshots_are_rejected(self):
        first = self.capture().snapshot
        self.raw["title"] = "Changed"
        second = self.capture().snapshot
        for proposal_id, before, after in [
            ("other", first.id, second.id), ("example", "missing", second.id),
            ("example", second.id, first.id),
        ]:
            with self.subTest(proposal_id=proposal_id, before=before):
                with self.assertRaises(ValueError):
                    self.service.compare_proposal_snapshots(proposal_id, before, after)
        self.assertFalse(self.db["proposal_snapshot_diffs"].documents)

    def test_fetch_failure_and_missing_notice_do_not_create_false_removals(self):
        first = self.capture().snapshot
        with patch.object(self.service, "fetch_notices", side_effect=URLError("offline")):
            with self.assertRaises(URLError):
                self.capture()
        with patch.object(self.service, "fetch_notices", return_value=[]):
            with self.assertRaises(ValueError):
                self.capture()
        self.assertEqual(first.id, self.service.history.latest("example").id)
        self.assertEqual(1, len(self.db["proposal_snapshots"].documents))

    def test_unknown_proposal_and_missing_sources_fail_before_fetch(self):
        with patch.object(self.service, "fetch_notices") as fetch:
            with self.assertRaises(ValueError):
                self.service.refresh_proposal_snapshot("unknown")
            self.db["imported_proposals"].documents["example"]["source_notices"] = []
            with self.assertRaises(ValueError):
                self.capture()
            fetch.assert_not_called()

    def test_malformed_source_record_is_not_saved(self):
        del self.raw["noticeDescription"]
        with self.assertRaises(ValueError):
            self.capture()
        self.assertFalse(self.db["proposal_snapshots"].documents)

    def test_concurrent_identical_capture_returns_the_winning_snapshot(self):
        real_insert = self.service.history.insert

        def competing_insert(snapshot):
            real_insert(snapshot)
            raise DuplicateKeyError("Another worker won this sequence")

        with patch.object(self.service.history, "insert", side_effect=competing_insert):
            result = self.capture()
        self.assertFalse(result.created)
        self.assertEqual(1, len(self.db["proposal_snapshots"].documents))

    def test_live_saved_example_normalizes(self):
        path = Path(__file__).resolve().parents[2] / "sources/imports/toronto-notices-examples.raw.json"
        record = next(r for r in json.loads(path.read_text())["Records"] if r["noticeId"] == 8002)
        with patch.object(self.service, "fetch_notices", return_value=[record]):
            snapshot = self.capture().snapshot
        self.assertIn("46-storey", snapshot.content["notices"]["8002"]["noticeDescription"])

    def test_http_fetch_uses_source_date_and_rejects_incomplete_or_missing_results(self):
        good = {"Result": "OK", "TotalRecordCount": 1, "Records": [self.raw]}
        with patch("service.proposal_snapshots.urlopen") as open_url:
            open_url.return_value.__enter__.return_value.read.return_value = json.dumps(good).encode()
            records = _fetch_notices([self.source.model_copy(update={"published_at": self.source.published_at.replace(tzinfo=None)})])
            self.assertEqual([self.raw], records)
            request = open_url.call_args.args[0]
            tls_context = open_url.call_args.kwargs["context"]
            self.assertTrue(tls_context.check_hostname)
            self.assertEqual(ssl.CERT_REQUIRED, tls_context.verify_mode)
            query = parse_qs(urlparse(request.full_url).query)
            self.assertEqual(["2026-11-06"], query["noticeDateFrom"])
            self.assertEqual(query["noticeDateFrom"], query["noticeDateTo"])
            for invalid in [
                {**good, "TotalRecordCount": 2}, {**good, "Result": "ERROR"},
                {"Result": "OK", "TotalRecordCount": 0, "Records": []},
            ]:
                open_url.return_value.__enter__.return_value.read.return_value = json.dumps(invalid).encode()
                with self.assertRaises(ValueError):
                    _fetch_notices([self.source])

    def test_poll_baseline_and_unchanged_do_not_attempt_comparison(self):
        with patch.object(self.service, "compare_proposal_snapshots") as compare:
            first = self.service.check_proposal_updates("example")
            second = self.service.check_proposal_updates("example", first.snapshot_sequence)
            self.assertTrue(first.snapshot_created)
            self.assertFalse(second.snapshot_created)
            self.assertEqual([], second.diffs)
            compare.assert_not_called()

    def test_poll_returns_all_unseen_changes_even_if_another_client_captured_them(self):
        first = self.capture().snapshot
        self.raw["title"] = "Revision two"
        self.capture()
        self.raw["title"] = "Revision three"
        latest = self.capture().snapshot
        result = self.service.check_proposal_updates("example", first.sequence)
        self.assertFalse(result.snapshot_created)
        self.assertEqual(latest.id, result.snapshot_id)
        self.assertEqual(2, len(result.diffs))
        self.assertEqual("Revision two", result.diffs[0].changes[0].after)
        self.assertEqual("Revision three", result.diffs[1].changes[0].after)
        self.assertEqual(2, len(self.db["proposal_snapshot_diffs"].documents))
        self.assertEqual([], self.service.check_proposal_updates("example", latest.sequence).diffs)

    def test_poll_recovers_when_snapshot_was_saved_but_comparison_failed(self):
        from pymongo.errors import PyMongoError

        self.capture()
        self.raw["title"] = "Changed title"
        with patch.object(self.service.history, "save_diff", side_effect=PyMongoError("temporary failure")):
            with self.assertRaises(PyMongoError):
                self.service.check_proposal_updates("example", 1)
        self.assertEqual(2, self.service.history.latest("example").sequence)
        recovered = self.service.check_proposal_updates("example", 1)
        self.assertFalse(recovered.snapshot_created)
        self.assertEqual("Changed title", recovered.diffs[0].changes[0].after)

    def test_read_poll_recovers_comparison_saved_after_cursor_advanced(self):
        first = self.capture().snapshot
        self.raw["title"] = "Changed title"
        second = self.capture().snapshot

        early = self.service.read_proposal_updates("example", first.sequence)
        self.assertEqual(second.sequence, early.snapshot_sequence)
        self.assertEqual([], early.diffs)

        saved = self.service.compare_proposal_snapshots("example", first.id, second.id)
        with patch.object(self.service, "fetch_notices", side_effect=AssertionError("Poll must remain read-only")):
            recovered = self.service.read_proposal_updates("example", early.snapshot_sequence)
            repeated = self.service.read_proposal_updates("example", recovered.snapshot_sequence)
        self.assertEqual([saved.id], [diff.id for diff in recovered.diffs])
        self.assertEqual([saved.id], [diff.id for diff in repeated.diffs])

    def test_poll_endpoint_transfers_diff_json_and_maps_failures(self):
        from fastapi.testclient import TestClient
        from main import app, get_snapshot_service
        from pymongo.errors import PyMongoError

        app.dependency_overrides[get_snapshot_service] = lambda: self.service
        try:
            client = TestClient(app)
            url = "/api/proposals/example/updates/check"
            baseline = client.post(url, json={"after_sequence": 0})
            self.assertEqual(200, baseline.status_code)
            self.assertEqual([], baseline.json()["diffs"])
            self.assertEqual("pending", baseline.json()["source_status"])
            self.assertEqual(0, baseline.json()["snapshot_sequence"])
            self.service.check_proposal_updates("example")
            self.raw["title"] = "Revised title"
            self.service.check_proposal_updates("example")
            before_documents = copy.deepcopy(self.db["proposal_snapshots"].documents)
            with patch.object(self.service, "fetch_notices", side_effect=AssertionError("Browser must not fetch sources")):
                response = client.get("/api/proposals/example/updates?after_sequence=1")
                self.assertEqual(response.json(), client.post(url, json={"after_sequence": 1}).json())
            self.assertEqual(before_documents, self.db["proposal_snapshots"].documents)
            self.assertEqual(200, response.status_code)
            payload = response.json()
            self.assertEqual(2, payload["snapshot_sequence"])
            self.assertEqual("Revised title", payload["diffs"][0]["changes"][0]["after"])
            self.assertIsInstance(payload["checked_at"], str)
            self.assertNotIn("raw_notices", payload)
            self.assertEqual(422, client.post(url, json={"after_sequence": -1}).status_code)
            self.assertEqual(409, client.post(url, json={"after_sequence": 99}).status_code)
            self.assertEqual(404, client.post("/api/proposals/missing/updates/check", json={}).status_code)
            with patch.object(self.service, "read_proposal_updates", side_effect=PyMongoError("offline")):
                self.assertEqual(503, client.post(url, json={}).status_code)
        finally:
            app.dependency_overrides.pop(get_snapshot_service, None)

    def test_snapshot_read_endpoint_is_scoped_public_and_performs_no_refresh_or_write(self):
        from fastapi.testclient import TestClient
        from main import app, get_snapshot_service
        from pymongo.errors import PyMongoError

        saved = self.capture().snapshot
        documents_before = copy.deepcopy(self.db["proposal_snapshots"].documents)
        app.dependency_overrides[get_snapshot_service] = lambda: self.service
        try:
            client = TestClient(app)
            url = f"/api/proposals/example/snapshots/{saved.id}"
            with patch.object(self.service, "fetch_notices", side_effect=AssertionError("Read must not fetch")):
                response = client.get(url)
            self.assertEqual(200, response.status_code)
            data = response.json()
            self.assertEqual(saved.content, data["content"])
            self.assertEqual(saved.source_urls, data["source_urls"])
            self.assertNotIn("raw_notices", data)
            self.assertNotIn("content_sha256", data)
            self.assertEqual(documents_before, self.db["proposal_snapshots"].documents)
            self.assertEqual(404, client.get(f"/api/proposals/other/snapshots/{saved.id}").status_code)
            self.assertEqual(404, client.get("/api/proposals/example/snapshots/missing").status_code)
            with patch.object(self.service.history, "get", side_effect=PyMongoError("offline")):
                self.assertEqual(503, client.get(url).status_code)
        finally:
            app.dependency_overrides.pop(get_snapshot_service, None)

    def test_demo_seed_adds_two_labelled_edits_without_changing_real_snapshots(self):
        from seed_demo_snapshot_diffs import seed_demo_diffs, DEMO_SENTENCE

        real = self.capture().snapshot
        real_document = copy.deepcopy(self.db["proposal_snapshots"].documents[real.id])
        proposal_documents = copy.deepcopy(self.db["imported_proposals"].documents)
        feedback_documents = copy.deepcopy(self.db["feedback"].documents)
        results = seed_demo_diffs(self.db, write=True)
        self.assertEqual(1, len(results))
        self.assertEqual(real.id, self.service.history.latest("example").id)
        self.assertEqual(real_document, self.db["proposal_snapshots"].documents[real.id])
        self.assertEqual(proposal_documents, self.db["imported_proposals"].documents)
        self.assertEqual(feedback_documents, self.db["feedback"].documents)
        before = self.service.history.get("example", results[0]["before_snapshot_id"])
        self.assertEqual(0, before.sequence)
        self.assertTrue(before.is_demo)
        self.assertEqual([], before.raw_notices)
        self.assertTrue(before.content["notices"]["8002"]["noticeDescription"].startswith(DEMO_SENTENCE))
        self.assertIn("Keep access.", before.content["notices"]["8002"]["noticeDescription"])
        diff = self.service.history.demo_diffs("example")[0]
        self.assertTrue(diff.is_demo)
        self.assertEqual(real.id, diff.after_snapshot_id)
        self.assertEqual({"/notices/8002/title", "/notices/8002/noticeDescription"}, {c.path for c in diff.changes})

    def test_demo_seed_is_repeatable_and_visible_to_an_already_polled_browser(self):
        from seed_demo_snapshot_diffs import seed_demo_diffs

        real = self.capture().snapshot
        planned = seed_demo_diffs(self.db)
        self.assertEqual("planned", planned[0]["status"])
        self.assertEqual(1, len(self.db["proposal_snapshots"].documents))
        seed_demo_diffs(self.db, write=True)
        documents = copy.deepcopy(self.db["proposal_snapshots"].documents)
        diffs = copy.deepcopy(self.db["proposal_snapshot_diffs"].documents)
        self.assertEqual("already_seeded", seed_demo_diffs(self.db, write=True)[0]["status"])
        self.assertEqual(documents, self.db["proposal_snapshots"].documents)
        self.assertEqual(diffs, self.db["proposal_snapshot_diffs"].documents)
        result = self.service.check_proposal_updates("example", real.sequence)
        self.assertFalse(result.snapshot_created)
        self.assertEqual(real.sequence, result.snapshot_sequence)
        self.assertEqual(1, len(result.diffs))
        self.assertTrue(result.diffs[0].is_demo)
        self.assertEqual(real.id, result.diffs[0].after_snapshot_id)

    def test_real_changes_after_demo_seeding_keep_their_real_classification(self):
        from seed_demo_snapshot_diffs import seed_demo_diffs

        real = self.capture().snapshot
        seed_demo_diffs(self.db, write=True)
        self.raw["title"] = "Actual source edit"
        result = self.service.check_proposal_updates("example", real.sequence)
        self.assertEqual(2, result.snapshot_sequence)
        self.assertEqual(2, len(result.diffs))
        self.assertTrue(result.diffs[0].is_demo)
        self.assertFalse(result.diffs[1].is_demo)
        self.assertEqual(real.id, result.diffs[1].before_snapshot_id)

    def test_sequence_zero_is_reserved_for_labelled_demo_snapshots(self):
        from proposal_snapshots_DTO import SnapshotDTO
        from pydantic import ValidationError

        data = self.capture().snapshot.model_dump()
        data["sequence"] = 0
        with self.assertRaises(ValidationError):
            SnapshotDTO.model_validate(data)

    def test_saved_results_are_ordered_by_source_sequence_when_old_comparisons_are_recovered_late(self):
        first = self.capture().snapshot
        self.raw["title"] = "Second"
        second = self.capture().snapshot
        self.raw["title"] = "Third"
        third = self.capture().snapshot
        self.service.compare_proposal_snapshots("example", second.id, third.id)
        self.service.compare_proposal_snapshots("example", first.id, second.id)
        result = self.service.read_proposal_updates("example")
        self.assertEqual([second.id, third.id], [diff.after_snapshot_id for diff in result.diffs])


if __name__ == "__main__":
    unittest.main()
