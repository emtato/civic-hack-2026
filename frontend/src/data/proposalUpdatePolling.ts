import type { ProposalUpdateCheck, ProposalUpdates, ProposalUpdateState } from './proposalUpdates.ts'

// UI refresh cadence only. Official sources are checked hourly by the backend.
export const PROPOSAL_UPDATE_INTERVAL_MS = 60 * 1000

interface PollingOptions {
  proposalIds: string[]
  initialState?: ProposalUpdates
  check: (proposalId: string, afterSequence: number, signal: AbortSignal) => Promise<ProposalUpdateCheck>
  onUpdate: (proposalId: string, state: ProposalUpdateState) => void
  // Injectable timers let tests advance polling without real waiting.
  schedule?: (callback: () => void, delay: number) => unknown
  cancel?: (timer: unknown) => void
}

/** Read saved results immediately and once a minute; never refresh source data. */
export function startProposalUpdatePolling(options: PollingOptions): () => void {
  const controller = new AbortController()
  const ids = [...new Set(options.proposalIds)]
  const states: ProposalUpdates = { ...options.initialState }
  let running = false

  const publish = (id: string, state: ProposalUpdateState) => {
    if (controller.signal.aborted) return
    states[id] = state
    options.onUpdate(id, state)
  }

  const poll = async () => {
    if (running || controller.signal.aborted) return
    running = true
    try {
      for (const id of ids) {
        if (controller.signal.aborted) break
        const previous = states[id] ?? {
          status: 'ready', snapshot_id: null, snapshot_sequence: 0,
          checked_at: null, diffs: [], error: null,
        }
        publish(id, { ...previous, status: 'checking', error: null })
        try {
          const result = await options.check(id, previous.snapshot_sequence, controller.signal)
          if (controller.signal.aborted) break
          if (result.proposal_id !== id || !Number.isInteger(result.snapshot_sequence)
              || result.snapshot_sequence < previous.snapshot_sequence
              || (result.snapshot_sequence === 0 ? result.snapshot_id !== null
                : typeof result.snapshot_id !== 'string' || !result.snapshot_id)
              || (result.checked_at !== null && typeof result.checked_at !== 'string') || !Array.isArray(result.diffs)
              || result.diffs.some(diff => diff.proposal_id !== id || !diff.id || !Array.isArray(diff.changes))) {
            throw new Error('The proposal update response was invalid. Previous updates were retained.')
          }
          const diffs = new Map(previous.diffs.map(diff => [diff.id, diff]))
          for (const diff of result.diffs) diffs.set(diff.id, diff)
          publish(id, {
            status: result.source_status ?? 'ready', snapshot_id: result.snapshot_id, snapshot_sequence: result.snapshot_sequence,
            checked_at: result.checked_at, diffs: [...diffs.values()], error: result.source_error ?? null,
          })
        } catch (error) {
          if (controller.signal.aborted) break
          publish(id, {
            ...previous, status: 'error',
            error: error instanceof Error ? error.message : 'Proposal updates could not be checked.',
          })
        }
      }
    } finally {
      running = false
    }
  }

  const schedule = options.schedule ?? ((callback, delay) => setInterval(callback, delay))
  const cancel = options.cancel ?? (timer => clearInterval(timer as ReturnType<typeof setInterval>))
  const timer = ids.length ? schedule(() => { void poll() }, PROPOSAL_UPDATE_INTERVAL_MS) : null
  if (ids.length) void poll()
  return () => {
    controller.abort()
    if (timer !== null) cancel(timer)
  }
}
