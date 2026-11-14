import { labattDemoSession } from '../data/labattDemo'
import type { DemoJourney } from '../data/labattDemo'
import type { ConfirmedCommentRequestDTO, ProposalFeedbackSubmissionDTO } from '../data/proposalFeedbackDTO'
import { parseFeedbackPreview } from './proposalsApi'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export class DemoSessionConflict extends Error {}

async function requestDemo(path: string, init: RequestInit, signal?: AbortSignal): Promise<DemoJourney> {
  const timeout = AbortSignal.timeout(15000)
  const response = await fetch(`${API_BASE}/api/demos/labatt${path}`, {
    ...init,
    cache: 'no-store',
    signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Proviso-Demo-Session': labattDemoSession(),
    },
  })
  if (response.status === 409) throw new DemoSessionConflict()
  if (!response.ok) throw new Error('The demo request failed.')
  return response.json()
}

export function fetchLabattDemo(signal?: AbortSignal): Promise<DemoJourney> {
  return requestDemo('', {}, signal)
}

export async function previewLabattDemoRequests(
  draft: Pick<ProposalFeedbackSubmissionDTO, 'comment' | 'condition'>,
  signal: AbortSignal,
): Promise<ConfirmedCommentRequestDTO[]> {
  const response = await fetch(`${API_BASE}/api/demos/labatt/feedback/preview`, {
    method: 'POST', cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Proviso-Demo-Session': labattDemoSession(),
    },
    body: JSON.stringify(draft),
    signal: AbortSignal.any([signal, AbortSignal.timeout(65000)]),
  })
  if (!response.ok) throw new Error('Request suggestions are unavailable. Retry, or continue with your comment and manual requirement only.')
  return parseFeedbackPreview(await response.json(), draft.comment)
}

export function saveLabattDemo(revision: string | null, response: ProposalFeedbackSubmissionDTO): Promise<DemoJourney> {
  return requestDemo('/response', { method: 'PUT', body: JSON.stringify({ revision, response }) })
}

export function resetLabattDemo(revision: string | null): Promise<DemoJourney> {
  return requestDemo('/reset', { method: 'POST', body: JSON.stringify({ revision }) })
}
