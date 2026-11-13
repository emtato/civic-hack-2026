import type { ProposalFeedbackSubmissionDTO } from './proposalFeedbackDTO'
import { ORDERED_POSITIONS, ORDERED_STAKEHOLDERS } from './proposalFeedbackDTO'

let sessionId: string | undefined

/** An unverified demo identity, shared by this browser's proposal responses. */
export function getParticipantId(): string {
  if (sessionId) return sessionId
  try {
    const stored = localStorage.getItem('proviso-participant') ?? localStorage.getItem('civic-participant')
    if (stored) return (sessionId = stored)
  } catch { /* Keep an identity for this visit if storage is blocked. */ }
  sessionId = crypto.randomUUID()
  try { localStorage.setItem('proviso-participant', sessionId) } catch { /* Visit only. */ }
  return sessionId
}

export function readDemoFeedback(proposalId: string): ProposalFeedbackSubmissionDTO | null {
  try {
    const value = JSON.parse(localStorage.getItem(`proviso-demo-feedback:${proposalId}`) ?? localStorage.getItem(`civic-demo-feedback:${proposalId}`) ?? 'null')
    if (value?.proposal_id === proposalId && value.participant_id === getParticipantId()
      && ORDERED_POSITIONS.includes(value.position) && ORDERED_STAKEHOLDERS.includes(value.stakeholder_role)
      && value.element_ratings && typeof value.comment === 'string'
      && (!value.condition || (typeof value.condition.requirement === 'string'
        && typeof value.condition.is_conditional_support === 'boolean'))) return value
  } catch { /* Ignore invalid or unavailable browser storage. */ }
  return null
}

export function saveDemoFeedback(submission: ProposalFeedbackSubmissionDTO): boolean {
  try {
    localStorage.setItem(`proviso-demo-feedback:${submission.proposal_id}`, JSON.stringify(submission))
    return true
  } catch {
    return false
  }
}
