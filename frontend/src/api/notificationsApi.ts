import { getToken } from '../data/auth'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export interface ProposalNotification {
  id: string
  proposal_id: string
  proposal_title: string
  diff_id: string
  created_at: string
  read_at: string | null
}

export interface NotificationInbox {
  items: ProposalNotification[]
  unread_count: number
}

export async function fetchNotifications(signal: AbortSignal, markSeen = false): Promise<NotificationInbox> {
  const token = getToken()
  if (!token) throw new Error('Sign in to see your notifications.')
  const res = await fetch(`${API_BASE}/api/notifications${markSeen ? '/read' : ''}`, {
    method: markSeen ? 'POST' : 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  })
  if (!res.ok) throw new Error(res.status === 401
    ? 'Sign in again to see your notifications.'
    : 'Notifications couldn’t load. Please try again.')
  return res.json()
}

export async function fetchFollowing(signal: AbortSignal): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/following`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${getToken()}` },
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  })
  if (!res.ok) throw new Error('Following couldn’t load. Please try again.')
  return res.json()
}

export async function setProposalFollow(proposalId: string, following: boolean): Promise<void> {
  const res = await fetch(`${API_BASE}/api/proposals/${encodeURIComponent(proposalId)}/follow`, {
    method: following ? 'PUT' : 'DELETE',
    headers: { Accept: 'application/json', Authorization: `Bearer ${getToken()}` },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(res.status === 401 ? 'Please sign in to follow proposals.' : 'Following couldn’t be updated. Please try again.')
}
