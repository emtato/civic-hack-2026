import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyFeedbackToAggregate, createEmptyAggregate } from '../src/data/proposalFeedbackDTO.ts'

const submission = (overrides = {}) => ({
  proposal_id: 'test', participant_id: 'demo-person', position: 'support',
  stakeholder_role: 'resident', element_ratings: {}, comment: '',
  submitted_at: '2026-11-13T15:00:00Z', ...overrides,
})

test('a response adds one participant; a general comment is not a condition', () => {
  const original = createEmptyAggregate()
  const updated = applyFeedbackToAggregate(original, submission({ comment: 'I like the proposal.' }))
  assert.equal(updated.total_participants, 1)
  assert.equal(updated.position_distribution.support, 1)
  assert.equal(updated.total_conditions, 0)
  assert.equal(original.total_participants, 0)
})

test('editing replaces position, role and optional element ratings', () => {
  const base = createEmptyAggregate()
  base.proposal_specific = [{ id: 'pickup', title: 'Pickup', prompt: 'Keep pickup access', total_responses: 0, distribution: { oppose: 0, neutral: 0, support: 0, unsure: 0 } }]
  const first = submission({ element_ratings: { pickup: 'support' } })
  const second = submission({ position: 'unsure', stakeholder_role: 'business' })
  const updated = applyFeedbackToAggregate(applyFeedbackToAggregate(base, first), second, first)
  assert.equal(updated.total_participants, 1)
  assert.equal(updated.position_distribution.support, 0)
  assert.equal(updated.position_distribution.unsure, 1)
  assert.equal(updated.stakeholder_distribution.resident, 0)
  assert.equal(updated.stakeholder_distribution.business, 1)
  assert.equal(updated.proposal_specific[0].total_responses, 0)
  assert.equal(updated.proposal_specific[0].distribution.support, 0)
})

test('a requirement preserves its exact meaning without inferring support', () => {
  const updated = applyFeedbackToAggregate(createEmptyAggregate(), submission({
    comment: 'Keep pickup access.', condition: { requirement: 'Evening access', is_conditional_support: false, time_window: 'Until 8 p.m.', location_label: 'Entrance' },
  }))
  const item = updated.condition_clusters[0].items[0]
  assert.equal(updated.total_conditions, 1)
  assert.equal(item.is_conditional_support, false)
  assert.equal(item.time_window, 'Until 8 p.m.')
  assert.equal(item.verbatim_quote, 'Keep pickup access.')
})

test('editing a condition replaces evidence, then removing it restores the count', () => {
  const first = submission({ condition: { requirement: 'Morning access', is_conditional_support: true } })
  const second = submission({ condition: { requirement: 'Evening access', is_conditional_support: false } })
  const once = applyFeedbackToAggregate(createEmptyAggregate(), first)
  const twice = applyFeedbackToAggregate(once, second, first)
  assert.equal(twice.total_conditions, 1)
  assert.equal(twice.condition_clusters[0].items.length, 1)
  assert.equal(twice.condition_clusters[0].items[0].extracted_requirement, 'Evening access')
  const removed = applyFeedbackToAggregate(twice, submission(), second)
  assert.equal(removed.total_participants, 1)
  assert.equal(removed.total_conditions, 0)
  assert.equal(removed.condition_clusters[0].count, 0)
  assert.equal(removed.condition_clusters[0].percentage, 0)
})

test('an unmatched requirement creates an ungrouped cluster instead of changing an unrelated group', () => {
  const base = createEmptyAggregate()
  base.condition_clusters = [{ id: 'loading_windows', label: 'Morning loading', icon: 'bus', count: 2, items: [] }]
  base.total_conditions = 2
  const updated = applyFeedbackToAggregate(base, submission({ condition: { feature_id: 'loading_windows', requirement: 'No overnight loading', is_conditional_support: false } }))
  assert.equal(updated.condition_clusters[0].count, 2)
  assert.equal(updated.condition_clusters[1].is_ungrouped, true)
  assert.equal(updated.condition_clusters[1].count, 1)
  assert.equal(updated.condition_clusters[1].percentage, 33)
})

test('an unrelated edit retains existing requirement evidence and group membership', () => {
  const first = submission({ condition: { requirement: 'More benches', is_conditional_support: false } })
  const aggregate = applyFeedbackToAggregate(createEmptyAggregate(), first)
  const group = aggregate.condition_clusters[0]
  group.id = 'existing-group'
  group.is_suggested = true
  group.is_ungrouped = false
  const updated = applyFeedbackToAggregate(aggregate, { ...first, position: 'oppose' }, first)
  assert.equal(updated.total_conditions, 1)
  assert.equal(updated.condition_clusters[0].id, 'existing-group')
  assert.equal(updated.condition_clusters[0].items[0].id, group.items[0].id)
  assert.equal(updated.position_distribution.oppose, 1)
})

test('confirmed comment requests count immediately and edits replace them without extra participants', () => {
  const first = submission({
    comment: 'Please add benches and shade.',
    confirmed_requests: [
      { requirement: 'Add accessible benches', quote: 'add benches', location_label: 'Entrance' },
      { requirement: 'Add shade', quote: 'shade' },
    ],
  })
  const original = createEmptyAggregate()
  const saved = applyFeedbackToAggregate(original, first)
  assert.equal(original.total_conditions, 0)
  assert.equal(saved.total_conditions, 2)
  assert.equal(saved.total_participants, 1)
  assert.equal(saved.condition_clusters[0].items[0].source, 'comment')
  assert.equal(saved.condition_clusters[0].items[0].is_conditional_support, false)
  const second = { ...first, confirmed_requests: [] }
  const edited = applyFeedbackToAggregate(saved, second, first)
  assert.equal(edited.total_conditions, 0)
  assert.equal(edited.total_participants, 1)
})

test('manual and confirmed requests with the same wording and context count once', () => {
  const saved = applyFeedbackToAggregate(createEmptyAggregate(), submission({
    comment: 'Please add benches.',
    condition: { requirement: 'Add benches', is_conditional_support: true },
    confirmed_requests: [{ requirement: 'Add benches', quote: 'add benches' }],
  }))
  assert.equal(saved.total_conditions, 1)
  assert.equal(saved.condition_clusters[0].items[0].is_conditional_support, true)
})
