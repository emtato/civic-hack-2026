/**
 * Client API for proposals and community feedback persistence.
 * Connects to the FastAPI backend with seamless local fallback when offline.
 */

import {
  Proposal,
  ProposalCommunityAggregateDTO,
  ProposalFeedbackSubmissionDTO,
  applyFeedbackToAggregate,
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
 * Falls back to local in-memory aggregate update if backend is offline.
 */
export async function submitProposalFeedback(
  submission: ProposalFeedbackSubmissionDTO,
  currentAggregate?: ProposalCommunityAggregateDTO
): Promise<{
  feedback: ProposalFeedbackSubmissionDTO
  community_aggregate: ProposalCommunityAggregateDTO
}> {
  try {
    const res = await fetch(`${API_BASE}/api/proposals/${submission.proposal_id}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(submission),
    })

    if (res.ok) {
      const data = await res.json()
      return {
        feedback: data.feedback,
        community_aggregate: data.community_aggregate,
      }
    }
  } catch (err) {
    console.warn('Backend submission failed, applying feedback locally:', err)
  }

  // Fallback to local computation
  const proposal = defaultProposals.find(p => p.id === submission.proposal_id)
  const baseAggregate =
    currentAggregate || proposal?.community_aggregate || {
      total_participants: 0,
      total_conditions: 0,
      last_updated: new Date().toISOString(),
      position_distribution: {
        strongly_oppose: 0,
        oppose: 0,
        neutral: 0,
        support: 0,
        strongly_support: 0,
        unsure: 0,
      },
      stakeholder_distribution: {
        resident: 0,
        business: 0,
        commuter: 0,
        visitor: 0,
        citywide: 0,
      },
      proposal_specific: [],
      condition_clusters: [],
    }

  const updatedAggregate = applyFeedbackToAggregate(baseAggregate, submission)
  return {
    feedback: submission,
    community_aggregate: updatedAggregate,
  }
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
  participantId: string
): Promise<ProposalFeedbackSubmissionDTO | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/proposals/${proposalId}/feedback/${participantId}`,
      {
        headers: { Accept: 'application/json' },
      }
    )
    if (res.ok) {
      return (await res.json()) as ProposalFeedbackSubmissionDTO
    }
  } catch (err) {
    console.warn(`Could not fetch participant feedback for ${participantId}:`, err)
  }
  return null
}

/**
 * Fetch the community feedback aggregate for a proposal.
 */
export async function fetchProposalAggregate(
  proposalId: string
): Promise<ProposalCommunityAggregateDTO | null> {
  try {
    const res = await fetch(`${API_BASE}/api/proposals/${proposalId}/aggregate`, {
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      return (await res.json()) as ProposalCommunityAggregateDTO
    }
  } catch (err) {
    console.warn(`Could not fetch aggregate for proposal ${proposalId}:`, err)
  }
  const prop = defaultProposals.find(p => p.id === proposalId)
  return prop?.community_aggregate || null
}
