/**
 * Client API for proposals and community feedback persistence.
 * Catalogue and feedback calls use the server; catalogue failures stay visible.
 */

import type {
  Proposal,
  ProposalCommunityAggregateDTO,
  ProposalFeedbackSubmissionDTO,
} from '../data/proposals'
import { parseProposalCatalogue } from './catalogue'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

/**
 * Fetch the published proposal catalogue. An empty array is a valid result.
 */
export async function fetchProposals(signal?: AbortSignal): Promise<Proposal[]> {
  const timeout = AbortSignal.timeout(20000)
  const res = await fetch(`${API_BASE}/api/proposals`, {
    headers: { Accept: 'application/json' },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  })
  if (!res.ok) throw new Error('Proposals could not be loaded. Please try again.')
  return parseProposalCatalogue(await res.json())
}

/**
 * Fetch one published proposal. Missing records return null.
 */
export async function fetchProposal(id: string): Promise<Proposal | null> {
  const res = await fetch(`${API_BASE}/api/proposals/${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000),
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error('This proposal could not be loaded.')
  return parseProposalCatalogue([await res.json()])[0]
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
