"""Domain regression checks; no network or production database required."""

import copy
import json
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

from importer import NoticeText, build_proposals, load_feed, write_proposals

NOW = datetime(2026, 11, 13, tzinfo=timezone.utc)
ROOT = Path(__file__).resolve().parent


class MemoryCollection:
    def __init__(self):
        self.documents = {}

    def create_index(self, *args):
        pass

    def find_one(self, query, projection=None):
        return copy.deepcopy(self.documents.get(query["_id"]))

    def update_one(self, query, update, upsert=False):
        key = query["_id"]
        inserted = key not in self.documents
        doc = self.documents.setdefault(key, {"_id": key})
        if inserted:
            doc.update(copy.deepcopy(update.get("$setOnInsert", {})))
        for field, value in update.get("$set", {}).items():
            if "." in field:
                parent, child = field.split(".", 1)
                doc.setdefault(parent, {})[child] = copy.deepcopy(value)
            else:
                doc[field] = copy.deepcopy(value)
        for field, value in update.get("$addToSet", {}).items():
            if "." in field:
                parent, child = field.split(".", 1)
                values = doc.setdefault(parent, {}).setdefault(child, [])
            else:
                values = doc.setdefault(field, [])
            for item in value.get("$each", []) if isinstance(value, dict) and "$each" in value else [value]:
                if item not in values:
                    values.append(item)
        return SimpleNamespace(upserted_id=key if inserted else None, modified_count=0 if inserted else 1)


class ImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = load_feed(ROOT.parent / "sources/imports/toronto-notices-examples.raw.json")
        cls.selection = json.loads((ROOT / "data/example-selection.json").read_text())["selection"]

    def build(self, raw=None):
        return build_proposals(raw or self.raw, self.selection, NOW)

    def test_real_batch_has_four_distinct_ids_per_category(self):
        proposals, _ = self.build()
        self.assertEqual(24, len({p.id for p in proposals}))
        for category in {s["category"] for s in self.selection}:
            self.assertEqual(4, sum(p.category == category for p in proposals))

    def test_missing_event_data_does_not_become_closed_or_no_meetings(self):
        proposals, _ = self.build()
        for p in proposals:
            self.assertIsNone(p.dates)
            self.assertEqual("unknown", p.status)
            self.assertEqual("unknown", p.participation.status)
            self.assertIsNone(p.map_point)
            self.assertIsNone(p.financial_details)

    def test_coordinate_order_and_missing_locations(self):
        proposals, _ = self.build()
        for p in proposals:
            for a in p.addresses:
                if a.point:
                    lon, lat = a.point.coordinates
                    self.assertLess(lon, 0)
                    self.assertGreater(lat, 0)
                    self.assertFalse(a.verified)
        self.assertTrue(any(not p.addresses for p in proposals))

    def test_title_equality_does_not_merge_distinct_matters(self):
        raw = copy.deepcopy(self.raw)
        raw[0]["title"] = raw[1]["title"]
        self.assertEqual(24, len(self.build(raw)[0]))

    def test_explicit_proposal_key_groups_multiple_notices(self):
        selection = copy.deepcopy(self.selection)
        selection[1]["proposal_key"] = selection[0]["proposal_key"]
        proposals, _ = build_proposals(self.raw, selection, NOW)
        self.assertEqual(23, len(proposals))
        grouped = next(p for p in proposals if p.id == selection[0]["proposal_key"])
        self.assertEqual(2, len(grouped.source_notices))

    def test_missing_selected_record_fails_batch(self):
        with self.assertRaises(ValueError):
            self.build(self.raw[1:])

    def test_html_script_is_dropped_and_table_cells_remain_separate(self):
        parser = NoticeText()
        parser.feed('<p>A &amp; B</p><script>bad()</script><table><tr><td>fee</td><td>42</td></tr></table>')
        self.assertIn("A & B", parser.text())
        self.assertIn("fee 42", parser.text())
        self.assertNotIn("bad", parser.text())

    def test_repeat_import_preserves_editorial_and_feedback(self):
        proposals, raw = self.build()
        db = SimpleNamespace(proposals=MemoryCollection(), source_notices=MemoryCollection(), responses={"keep": 1})
        write_proposals(db, proposals, raw, NOW)
        first = db.proposals.documents[proposals[0].id]
        first["summary"] = "Reviewed summary"
        first["versions"] = [{"id": "reviewed-v1"}]
        first["review"]["state"] = "reviewed"
        result = write_proposals(db, proposals, raw, NOW)
        self.assertEqual(24, result["matched_existing"])
        self.assertEqual(24, len(db.proposals.documents))
        self.assertEqual(24, len(db.source_notices.documents))
        self.assertEqual("Reviewed summary", first["summary"])
        self.assertEqual([{"id": "reviewed-v1"}], first["versions"])
        self.assertEqual("reviewed", first["review"]["state"])
        changed = copy.deepcopy(self.raw)
        changed[0]["noticeDescription"] += "<p>Source changed.</p>"
        revised, new_raw = self.build(changed)
        write_proposals(db, revised, new_raw, NOW)
        self.assertEqual("needs_review", first["review"]["state"])
        self.assertEqual("Reviewed summary", first["summary"])
        self.assertEqual(25, len(db.source_notices.documents))
        self.assertEqual({"keep": 1}, db.responses)


if __name__ == "__main__":
    unittest.main()
