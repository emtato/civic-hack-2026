import assert from 'node:assert/strict'
import { test } from 'node:test'
import { highlightTextChanges, comparisonFields, comparisonFieldLabel, formatComparisonValue } from '../src/data/proposalComparison.ts'

const joined = segments => segments.map(segment => segment.text).join('')
const changed = segments => segments.filter(segment => segment.changed).map(segment => segment.text).join('')

test('inline differences highlight replaced words and preserve both original texts exactly', () => {
  const before = 'Loading is allowed from 7–10 AM.\nKeep evening pickup.'
  const after = 'Loading is allowed from 7–9 AM.\nKeep evening pickup.'
  const result = highlightTextChanges(before, after)
  assert.equal(joined(result.before), before)
  assert.equal(joined(result.after), after)
  assert.equal(changed(result.before), '7–10')
  assert.equal(changed(result.after), '7–9')
})

test('insertions, deletions, negation and repeated words retain meaning and whitespace', () => {
  for (const [before, after] of [
    ['', 'Added text'], ['Removed text', ''], ['I do not support it.', 'I do support it.'],
    ['access access near the entrance', 'access near the other entrance'],
    ['evening\n  pickup', 'morning\n pickup'], ['Accès près de l’entrée.', 'Accès à l’entrée.'],
  ]) {
    const result = highlightTextChanges(before, after)
    assert.equal(joined(result.before), before)
    assert.equal(joined(result.after), after)
  }
  assert.match(changed(highlightTextChanges('I do not support it.', 'I do support it.').before), /not/)
})

test('unchanged text has no highlights and large replacements keep the complete source', () => {
  assert.equal(changed(highlightTextChanges('Same source.', 'Same source.').before), '')
  const before = 'Shared start ' + 'old '.repeat(1000) + 'shared end'
  const after = 'Shared start ' + 'new '.repeat(1000) + 'shared end'
  const result = highlightTextChanges(before, after)
  assert.equal(joined(result.before), before)
  assert.equal(joined(result.after), after)
  assert.equal(result.before[0].changed, false)
  assert.equal(result.before.at(-1).changed, false)
})

test('full comparison retains unchanged fields and distinguishes removal, addition and unknown', () => {
  const before = { content: { notices: { 8: { title: 'Same title', contact: { emailAddress: 'old@example.test' }, amount: null } } } }
  const after = { content: { notices: { 8: { title: 'Same title', amount: 0, newField: false } } } }
  const changes = [
    { path: '/notices/8/contact', operation: 'removed', before: { emailAddress: 'old@example.test' }, after: null },
    { path: '/notices/8/amount', operation: 'changed', before: null, after: 0 },
    { path: '/notices/8/newField', operation: 'added', before: null, after: false },
  ]
  assert.equal(comparisonFields(changes).length, 3)
  const fields = comparisonFields(changes, before, after, true)
  assert.equal(fields.find(field => field.path.endsWith('/title')).operation, 'unchanged')
  assert.equal(fields.find(field => field.path.endsWith('/emailAddress')).operation, 'removed')
  assert.equal(fields.find(field => field.path.endsWith('/newField')).operation, 'added')
  assert.equal(fields.find(field => field.path.endsWith('/amount')).operation, 'changed')
  assert.equal(formatComparisonValue(null), 'Not specified')
  assert.equal(formatComparisonValue(false), 'No')
  assert.equal(formatComparisonValue(0), '0')
})

test('source labels and structured values are readable and JSON pointer escapes decode correctly', () => {
  assert.equal(comparisonFieldLabel('/notices/8/contact/emailAddress'), 'Notice 8 · Contact · Email address')
  assert.equal(comparisonFieldLabel('/notices/8/a~1b~0c'), 'Notice 8 · A/b~c')
  assert.equal(formatComparisonValue([{ emailAddress: 'a@example.test' }]), 'Email address: a@example.test')
  assert.equal(formatComparisonValue([]), 'None listed')
})
