import assert from 'node:assert/strict'
import { test } from 'node:test'
import { startProposalUpdatePolling, PROPOSAL_UPDATE_INTERVAL_MS } from '../src/data/proposalUpdatePolling.ts'

const settle = () => new Promise(resolve => setImmediate(resolve))
const response = (id, sequence = 1, diffs = []) => ({
  proposal_id: id, snapshot_id: `snapshot-${sequence}`, snapshot_sequence: sequence,
  checked_at: '2026-11-13T18:00:00Z', snapshot_created: false, diffs,
})
const diff = id => ({
  id, proposal_id: 'a', before_snapshot_id: 'snapshot-1', after_snapshot_id: 'snapshot-2',
  compared_at: '2026-11-13T18:00:00Z', classification: 'unclassified', review_required: true,
  changes: [{ path: '/notices/1/title', operation: 'changed', before: 'Old', after: 'New', text_diff: '-Old\n+New' }],
})

function harness(check, proposalIds = ['a', 'b']) {
  const states = {}
  let tick
  let cancelled = false
  const stop = startProposalUpdatePolling({
    proposalIds, check,
    onUpdate: (id, state) => { states[id] = state },
    schedule: (callback, delay) => {
      assert.equal(delay, PROPOSAL_UPDATE_INTERVAL_MS)
      tick = callback
      return 12
    },
    cancel: timer => { assert.equal(timer, 12); cancelled = true },
  })
  return { states, stop, tick: () => tick?.(), cancelled: () => cancelled }
}

test('polls every catalogue ID immediately and then hourly with per-proposal cursors', async () => {
  const calls = []
  const h = harness(async (id, sequence) => { calls.push([id, sequence]); return response(id) }, ['a', 'b', 'a'])
  await settle()
  assert.equal(PROPOSAL_UPDATE_INTERVAL_MS, 3_600_000)
  assert.deepEqual(calls, [['a', 0], ['b', 0]])
  h.tick()
  await settle()
  assert.deepEqual(calls.slice(2), [['a', 1], ['b', 1]])
  assert.equal(h.states.a.status, 'ready')
  h.stop()
  assert.equal(h.cancelled(), true)
})

test('retains full diff data across unchanged polls and deduplicates repeated diffs', async () => {
  let result = response('a', 2, [diff('change-1')])
  const h = harness(async () => result, ['a'])
  await settle()
  result = response('a', 2)
  h.tick()
  await settle()
  assert.equal(h.states.a.diffs.length, 1)
  result = response('a', 3, [diff('change-1'), diff('change-2')])
  h.tick()
  await settle()
  assert.deepEqual(h.states.a.diffs.map(item => item.id), ['change-1', 'change-2'])
  assert.equal(h.states.a.diffs[0].changes[0].after, 'New')
  h.stop()
})

test('one failed proposal retains its cursor/data and does not block other proposals', async () => {
  let fail = false
  const calls = []
  const h = harness(async (id, sequence) => {
    calls.push([id, sequence])
    if (fail && id === 'a') throw new Error('Source offline')
    return response(id, 2, id === 'a' ? [diff('change-1')] : [])
  })
  await settle()
  fail = true
  h.tick()
  await settle()
  assert.equal(h.states.a.status, 'error')
  assert.equal(h.states.a.error, 'Source offline')
  assert.equal(h.states.a.snapshot_sequence, 2)
  assert.equal(h.states.a.diffs.length, 1)
  assert.equal(h.states.b.status, 'ready')
  fail = false
  h.tick()
  await settle()
  assert.deepEqual(calls.slice(-2), [['a', 2], ['b', 2]])
  assert.equal(h.states.a.error, null)
  h.stop()
})

test('slow requests never overlap and stopping aborts and suppresses late responses', async () => {
  let resolve
  let signal
  let calls = 0
  const h = harness((_id, _sequence, requestSignal) => {
    calls += 1
    signal = requestSignal
    return new Promise(done => { resolve = done })
  })
  h.tick()
  h.tick()
  assert.equal(calls, 1)
  h.stop()
  assert.equal(signal.aborted, true)
  resolve(response('a'))
  await settle()
  assert.equal(calls, 1)
  assert.equal(h.states.a.status, 'checking')
  assert.equal(h.states.b, undefined)
})

test('an invalid response cannot advance another proposal cursor', async () => {
  const h = harness(async () => response('wrong-id'), ['a'])
  await settle()
  assert.equal(h.states.a.status, 'error')
  assert.equal(h.states.a.snapshot_sequence, 0)
  h.stop()
})

test('an empty catalogue starts no requests or timer', async () => {
  let calls = 0
  const h = harness(async () => { calls += 1 }, [])
  await settle()
  assert.equal(calls, 0)
  h.stop()
  assert.equal(h.cancelled(), false)
})
