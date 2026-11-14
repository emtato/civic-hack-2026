import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { checkProposalUpdates } from '../api/proposalsApi'
import { startProposalUpdatePolling } from './proposalUpdatePolling'
import type { ProposalUpdates } from './proposalUpdates'

const ProposalUpdatesContext = createContext<ProposalUpdates>({})

/** Shared polling state consumed by the overview and Updates comparison viewer. */
export function ProposalUpdatesProvider({ proposals, children }: {
  proposals: { id: string }[]
  children: ReactNode
}) {
  const [updates, setUpdates] = useState<ProposalUpdates>({})
  const retained = useRef<ProposalUpdates>({})
  const idsKey = JSON.stringify([...new Set(proposals.map(proposal => proposal.id))].sort())

  useEffect(() => startProposalUpdatePolling({
    proposalIds: JSON.parse(idsKey) as string[],
    initialState: retained.current,
    check: checkProposalUpdates,
    onUpdate: (id, state) => {
      retained.current = { ...retained.current, [id]: state }
      setUpdates(retained.current)
    },
  }), [idsKey])

  return <ProposalUpdatesContext.Provider value={updates}>{children}</ProposalUpdatesContext.Provider>
}

export function useProposalUpdates(): ProposalUpdates {
  return useContext(ProposalUpdatesContext)
}
