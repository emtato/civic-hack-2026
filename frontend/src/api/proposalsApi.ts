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
import type { ProposalUpdateCheck, ProposalSnapshot } from '../data/proposalUpdates'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

/** Retrieve a complete saved source for the side-by-side comparison. No refresh. */
export async function fetchProposalSnapshot(
  proposalId: string, snapshotId: string, signal?: AbortSignal,
): Promise<ProposalSnapshot> {
  const timeout = AbortSignal.timeout(20000)
  const res = await fetch(
    `${API_BASE}/api/proposals/${encodeURIComponent(proposalId)}/snapshots/${encodeURIComponent(snapshotId)}`,
    { headers: { Accept: 'application/json' }, signal: signal ? AbortSignal.any([signal, timeout]) : timeout },
  )
  if (!res.ok) throw new Error('Saved versions could not be loaded. You can still read the changed fields below.')
  const snapshot: ProposalSnapshot = await res.json()
  if (snapshot.id !== snapshotId || snapshot.proposal_id !== proposalId
      || !snapshot.content || typeof snapshot.content !== 'object' || Array.isArray(snapshot.content)
      || !Array.isArray(snapshot.source_urls) || !snapshot.source_urls.every(url => typeof url === 'string')
      || typeof snapshot.captured_at !== 'string' || !Number.isInteger(snapshot.sequence)) {
    throw new Error('The saved version response was invalid.')
  }
  return snapshot
}

/** Refresh official sources and retrieve every diff since this browser's cursor. */
export async function checkProposalUpdates(
  proposalId: string,
  afterSequence: number,
  signal?: AbortSignal,
): Promise<ProposalUpdateCheck> {
  const timeout = AbortSignal.timeout(120000)
  const res = await fetch(`${API_BASE}/api/proposals/${encodeURIComponent(proposalId)}/updates/check`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ after_sequence: afterSequence }),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  })
  if (!res.ok) throw new Error('Proposal updates could not be checked. They will be retried next hour.')
  return res.json()
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
  const res = await fetch(`${API_BASE}/api/proposals/${encodeURIComponent(proposalId)}/feedback`, {
    headers: { Accept: 'application/json' },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  })
  if (!res.ok) throw new Error('Comments could not be loaded.')
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
