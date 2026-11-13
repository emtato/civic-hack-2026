import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasMapCoordinates, parseProposalCatalogue } from '../src/api/catalogue.ts'

test('an empty API catalogue stays empty instead of displaying fixtures', () => {
  assert.deepEqual(parseProposalCatalogue([]), [])
})

test('new categories, statuses and citywide proposals remain visible without a pin', () => {
  const [proposal] = parseProposalCatalogue([{
    id: 'fees', title: 'Ravine permit fees', topic: 'Financial', status: 'Historical', coordinates: null,
  }])
  assert.equal(proposal.topic, 'Financial')
  assert.equal(proposal.status, 'Historical')
  assert.equal(hasMapCoordinates(proposal), false)
  assert.deepEqual(proposal.shape, [])
})

test('valid coordinates survive and invalid or missing coordinates do not become pins', () => {
  const proposals = parseProposalCatalogue([
    { id: 'good', title: 'A', coordinates: [43.65, -79.4] },
    { id: 'bad', title: 'B', coordinates: [999, -79.4] },
    { id: 'missing', title: 'C' },
    { id: 'strings', title: 'D', coordinates: ['43.65', '-79.4'] },
  ])
  assert.deepEqual(proposals.filter(hasMapCoordinates).map(p => p.id), ['good'])
})

test('malformed catalogues and duplicate identifiers fail rather than mixing data sources', () => {
  for (const value of [{ proposals: [] }, [null], [{ title: 'Missing ID' }], [{ id: 'same', title: 'A' }, { id: 'same', title: 'B' }]]) {
    assert.throws(() => parseProposalCatalogue(value))
  }
})

test('invalid shapes and executable source links are not passed to map/link rendering', () => {
  const [proposal] = parseProposalCatalogue([{ id: 'test', title: '<b>Source text</b>', source: 'javascript:alert(1)', shape: [[999, 1]], changes: ['Known change', null] }])
  assert.equal(proposal.source, '')
  assert.deepEqual(proposal.shape, [])
  assert.deepEqual(proposal.changes, ['Known change'])
  assert.equal(proposal.title, '<b>Source text</b>')
})
