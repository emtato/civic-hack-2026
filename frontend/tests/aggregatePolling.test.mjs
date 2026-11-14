import assert from 'node:assert/strict'
import { test } from 'node:test'
import { startAggregatePolling } from '../src/data/aggregatePolling.ts'

const flush = () => new Promise(resolve => setImmediate(resolve))
function setup(fetch) {
  let tick
  let revision = 0
  let busy = false
  const applied = []
  let cancelled = false
  const stop = startAggregatePolling({
    fetch, apply: value => applied.push(value),
    revision: () => revision, busy: () => busy,
    schedule: callback => { tick = callback; return 1 },
    cancel: handle => { assert.equal(handle, 1); cancelled = true },
  })
  return { tick: () => tick(), applied, stop, setBusy: value => { busy = value },
    mutate: () => { revision++ }, cancelled: () => cancelled }
}

test('polling displays saved background group updates without overlapping reads', async () => {
  let resolve
  let calls = 0
  const state = setup(() => { calls++; return new Promise(done => { resolve = done }) })
  state.tick()
  state.tick()
  assert.equal(calls, 1)
  const aggregate = { grouping_status: 'ready', total_conditions: 3 }
  resolve(aggregate)
  await flush()
  assert.deepEqual(state.applied, [aggregate])
  state.stop()
  assert.equal(state.cancelled(), true)
})

test('polls that overlap a submission cannot replace the save result with stale groups', async () => {
  let resolve
  const state = setup(() => new Promise(done => { resolve = done }))
  state.tick()
  state.mutate()
  resolve({ total_conditions: 1 })
  await flush()
  assert.equal(state.applied.length, 0)
  state.setBusy(true)
  state.tick()
  state.stop()
})

test('stopping suppresses late results and temporary errors preserve existing data', async () => {
  const failed = setup(async () => { throw new Error('offline') })
  failed.tick()
  await flush()
  assert.deepEqual(failed.applied, [])
  failed.stop()
  let resolve
  const state = setup(() => new Promise(done => { resolve = done }))
  state.tick()
  state.stop()
  resolve({ total_conditions: 5 })
  await flush()
  assert.deepEqual(state.applied, [])
})
