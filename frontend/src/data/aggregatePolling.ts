import type { ProposalCommunityAggregateDTO } from './proposalFeedbackDTO'

/** Serialize reads and discard any read that overlapped a local mutation. */
export function startAggregatePolling(options: {
  fetch: () => Promise<ProposalCommunityAggregateDTO | null>
  apply: (aggregate: ProposalCommunityAggregateDTO) => void
  revision: () => number
  busy: () => boolean
  schedule?: (callback: () => void, delay: number) => unknown
  cancel?: (handle: unknown) => void
}) {
  let active = true
  let reading = false
  const tick = async () => {
    if (!active || reading || options.busy()) return
    reading = true
    const revision = options.revision()
    try {
      const aggregate = await options.fetch()
      if (active && aggregate && !options.busy() && revision === options.revision()) options.apply(aggregate)
    } catch {
      // Preserve the last successful server snapshot during a transient outage.
    } finally {
      reading = false
    }
  }
  const schedule = options.schedule ?? ((callback, delay) => setInterval(callback, delay))
  const cancel = options.cancel ?? (handle => clearInterval(handle as ReturnType<typeof setInterval>))
  const handle = schedule(() => { void tick() }, 5000)
  return () => { active = false; cancel(handle) }
}
