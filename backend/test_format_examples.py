import copy
import json
import unittest
from pathlib import Path

from format_examples import enrich
from imported_data_dto import Proposal

HERE = Path(__file__).resolve().parent


class FormattingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.originals = [Proposal.model_validate(p) for p in json.loads((HERE / 'data/proposals.preview.json').read_text())['proposals']]
        cls.curated = json.loads((HERE / 'data/proposal-enrichment.json').read_text())

    def test_batch_keeps_ids_and_all_feature_evidence_is_literal(self):
        formatted = [enrich(p, self.curated[p.id]) for p in self.originals]
        self.assertEqual({p.id for p in self.originals}, {p.id for p in formatted})
        for p in formatted:
            self.assertTrue(p.summary)
            self.assertGreaterEqual(len(p.features), 2)
            for feature in p.features:
                self.assertIn(feature.evidence[0].quote, p.source_notices[0].description_text)

    def test_unknown_rates_and_current_participation_stay_unknown(self):
        p = next(p for p in self.originals if p.id == 'toronto-ravine-permit-fees')
        result = enrich(p, self.curated[p.id])
        self.assertIsNone(result.financial_details.proposed_amount)
        self.assertEqual('unknown', result.participation.status)
        self.assertEqual(p.source_notices[0].published_at, result.status_as_of)

    def test_existing_editorial_work_and_source_history_survive(self):
        p = self.originals[0].model_copy(deep=True)
        p.summary = 'Manual reviewed summary'
        result = enrich(p, self.curated[p.id])
        self.assertEqual(p.summary, result.summary)
        self.assertEqual(p.source_notices, result.source_notices)
        again = enrich(result, self.curated[p.id])
        self.assertEqual(result, again)

    def test_changed_source_hash_aborts(self):
        p = self.originals[0].model_copy(deep=True)
        p.source_notices[0].raw_sha256 = 'changed'
        with self.assertRaises(ValueError):
            enrich(p, self.curated[p.id])

    def test_citywide_examples_have_no_fabricated_coordinates(self):
        for p in self.originals:
            result = enrich(p, self.curated[p.id])
            if not p.addresses:
                self.assertEqual('citywide', result.geographic_scope)
                self.assertIsNone(result.map_point)
            elif result.map_point:
                self.assertIn(result.map_point, [a.point for a in p.addresses])


if __name__ == '__main__':
    unittest.main()
