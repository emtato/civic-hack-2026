/**
 * Client API for proposals and community feedback persistence.
 * Read-only catalogue calls can use sample proposals. Writes must succeed on the server.
 */

import {
  Proposal,
  ProposalCommunityAggregateDTO,
  ProposalFeedbackSubmissionDTO,
  proposals as defaultProposals,
} from '../data/proposals'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

/**
 * Fetch all proposals from MongoDB backend (or fallback to static set).
 */
export async function fetchProposals(): Promise<Proposal[]> {
  try {
    const res = await fetch(`${API_BASE}/api/proposals`, {
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const data: Proposal[] = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        return data
      }
    }
  } catch (err) {
    console.warn('Backend API unavailable, using local proposals:', err)
  }
  return defaultProposals
}

/**
 * Fetch a single proposal by ID from MongoDB backend (or fallback to static set).
 */
export async function fetchProposal(id: string): Promise<Proposal | null> {
  try {
    const res = await fetch(`${API_BASE}/api/proposals/${id}`, {
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      return (await res.json()) as Proposal
    }
  } catch (err) {
    console.warn(`Backend API unavailable for proposal ${id}, using local fallback:`, err)
  }
  return defaultProposals.find(p => p.id === id) || null
}

/**
 * Submit citizen feedback to MongoDB persistence layer.
 * Updates feedback storage and retrieves the updated attached aggregate.
 * Failed writes are surfaced to the caller; they never become local successes.
 */
export async function submitProposalFeedback(
  submission: ProposalFeedbackSubmissionDTO,
): Promise<{
  feedback: ProposalFeedbackSubmissionDTO
  community_aggregate: ProposalCommunityAggregateDTO
}> {
  const res = await fetch(`${API_BASE}/api/proposals/${encodeURIComponent(submission.proposal_id)}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(submission),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error('Your response could not be saved. Your answers are still here; please try again.')
  return res.json()
}

/**
 * Fetch all stored feedback submissions for a proposal.
 */
export async function fetchProposalFeedback(
  proposalId: string
): Promise<ProposalFeedbackSubmissionDTO[]> {
  try {
    const res = await fetch(`${API_BASE}/api/proposals/${proposalId}/feedback`, {
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      return (await res.json()) as ProposalFeedbackSubmissionDTO[]
    }
  } catch (err) {
    console.warn(`Could not fetch feedback for proposal ${proposalId}:`, err)
  }
  return []
}

/**
 * Fetch a specific participant's feedback submission.
 */
export async function fetchParticipantFeedback(
  proposalId: string,
  participantId: string,
): Promise<ProposalFeedbackSubmissionDTO | null> {
  const res = await fetch(
    `${API_BASE}/api/proposals/${encodeURIComponent(proposalId)}/feedback/${encodeURIComponent(participantId)}`,
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) },
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Could not load your saved response.')
  return res.json()
}

/** Read the live aggregate. The UI explicitly labels any sample-data fallback. */
export async function fetchProposalAggregate(
  proposalId: string,
): Promise<ProposalCommunityAggregateDTO | null> {
  const res = await fetch(`${API_BASE}/api/proposals/${encodeURIComponent(proposalId)}/aggregate`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error('Live community feedback is unavailable.')
  return res.json()
}
