/**
 * Client API for proposals and community feedback persistence.
 * Catalogue and feedback calls use the server; catalogue failures stay visible.
 */

import type {
  Proposal,
  ProposalCommunityAggregateDTO,
  ProposalFeedbackSubmissionDTO,
} from '../data/proposals'
import { getToken } from '../data/auth'
import { parseProposalCatalogue } from './catalogue'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export async function updateConditionGroups(
  proposalId: string,
  rejectedConditionId?: string,
): Promise<ProposalCommunityAggregateDTO> {
  const token = getToken()
  if (!token) throw new Error('Sign in to update condition groups.')
  const action = rejectedConditionId ? `/${encodeURIComponent(rejectedConditionId)}/reject` : ''
  const response = await fetch(
    `${API_BASE}/api/proposals/${encodeURIComponent(proposalId)}/condition-groups${action}`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(25000) },
  )
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(typeof body?.detail === 'string' ? body.detail : 'Could not update condition groups.')
  }
  return response.json()
}

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
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}/api/proposals/${encodeURIComponent(submission.proposal_id)}/feedback`, {
    method: 'POST',
    headers,
    body: JSON.stringify(submission),
    signal: AbortSignal.timeout(15000),
  })
  if (res.status === 401) {
    throw new Error('Please log in to submit feedback. Your answers are still here.')
  }
  if (!res.ok) throw new Error('Your response could not be saved. Your answers are still here; please try again.')
  return res.json()
}

/**
 * Fetch all stored feedback submissions for a proposal.
 */
export async function fetchProposalFeedback(
  proposalId: string,
  signal?: AbortSignal,
): Promise<ProposalFeedbackSubmissionDTO[]> {
  const timeout = AbortSignal.timeout(8000)
  // Reads are public, but sending the token (when present) lets the server
  // mark which comments the current viewer has already voted on.
  const token = getToken()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API_BASE}/api/proposals/${encodeURIComponent(proposalId)}/feedback`, {
    headers,
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  })
  if (!res.ok) throw new Error('Comments could not be loaded.')
  return res.json()
}

/**
 * Up/down-vote another participant's comment, or clear the vote (value 0).
 * Requires a signed-in user. Returns the updated comment with fresh tallies.
 */
export async function voteOnComment(
  proposalId: string,
  commentOwner: string,
  value: -1 | 0 | 1,
): Promise<ProposalFeedbackSubmissionDTO> {
  const token = getToken()
  if (!token) throw new Error('Sign in to vote on comments.')
  const res = await fetch(
    `${API_BASE}/api/proposals/${encodeURIComponent(proposalId)}/comments/${encodeURIComponent(commentOwner)}/vote`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ value }),
      signal: AbortSignal.timeout(10000),
    },
  )
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(typeof body?.detail === 'string' ? body.detail : 'Your vote could not be saved.')
  }
  return res.json()
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
