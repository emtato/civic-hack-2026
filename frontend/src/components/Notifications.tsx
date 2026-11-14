import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { fetchNotifications, type NotificationInbox, type ProposalNotification } from '../api/notificationsApi'
import type { AuthUser } from '../data/auth'
import { PROPOSAL_UPDATE_INTERVAL_MS } from '../data/proposalUpdatePolling'
import { useProposalUpdates } from '../data/ProposalUpdatesContext'
import { Icon } from './Icon'
import './Notifications.css'

function timestamp(value: string) {
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

export function Notifications({ user, proposals, onSelect }: {
  user: AuthUser | null
  proposals: { id: string; title: string }[]
  onSelect: (notification: ProposalNotification) => void
}) {
  const [open, setOpen] = useState(false)
  const [inbox, setInbox] = useState<NotificationInbox | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [acknowledging, setAcknowledging] = useState(false)
  const markingSeen = useRef(false)
  const root = useRef<HTMLDivElement>(null)
  const bell = useRef<HTMLButtonElement>(null)
  const controller = useRef<AbortController | null>(null)
  const requestId = useRef(0)
  const panelId = useId()
  const updates = useProposalUpdates()
  const demoNotifications: ProposalNotification[] = proposals.slice(0, 3).map(proposal => {
    const diff = updates[proposal.id]?.diffs.find(item => item.is_demo)
    return {
      id: `demo:${proposal.id}`, proposal_id: proposal.id, proposal_title: proposal.title,
      diff_id: diff?.id ?? '', created_at: diff?.compared_at ?? '', read_at: null,
    }
  })

  const refresh = useCallback(async (markSeen = false) => {
    if (!user || !controller.current) return
    if (markingSeen.current) return
    if (markSeen) { markingSeen.current = true; setAcknowledging(true) }
    const id = ++requestId.current
    const signal = controller.current.signal
    setLoading(true)
    try {
      const result = await fetchNotifications(signal, markSeen)
      if (!signal.aborted && id === requestId.current) {
        setInbox(result)
        setError('')
      }
    } catch (reason) {
      if (!signal.aborted && id === requestId.current) {
        setError(reason instanceof Error ? reason.message : 'Notifications couldn’t load.')
      }
    } finally {
      if (markSeen) {
        markingSeen.current = false
        if (!signal.aborted) setAcknowledging(false)
      }
      if (!signal.aborted && id === requestId.current) setLoading(false)
    }
  }, [user?.username])

  useEffect(() => {
    const active = new AbortController()
    controller.current = active
    if (user) void refresh()
    const timer = user ? setInterval(() => { void refresh() }, PROPOSAL_UPDATE_INTERVAL_MS) : null
    return () => { active.abort(); if (timer !== null) clearInterval(timer) }
  }, [refresh, user?.username])

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); bell.current?.focus() }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const hasNew = !acknowledging && (inbox?.unread_count ?? 0) > 0
  return <div className="notifications" ref={root}>
    <button ref={bell} type="button" className={`notification-bell${open ? ' is-open' : ''}`}
      aria-label={hasNew ? 'Notifications, new updates' : 'Notifications'}
      aria-expanded={open} aria-controls={panelId} onClick={() => {
        setOpen(!open)
        if (!open) void refresh(true)
      }}>
      <Icon name="bell" />
      {hasNew && <span className="notification-dot" aria-hidden="true" />}
    </button>
    {open && <section id={panelId} className="notification-panel" aria-label="Notifications">
      <div className="notification-heading"><h2>Notifications</h2>
        <button className="icon-button" aria-label="Close notifications" onClick={() => { setOpen(false); bell.current?.focus() }}><Icon name="close" /></button>
      </div>
      {!!demoNotifications.length && <ul className="notification-list" aria-label="Demo notifications">
        {demoNotifications.map(item => <li key={item.id}>
          <button className="notification-item" onClick={() => { onSelect(item); setOpen(false) }}>
            <span className="notification-item-icon"><Icon name="layers" /></span>
            <span><strong>{item.proposal_title}</strong><span>Demo: Proposal details changed. Review it.</span></span>
          </button>
        </li>)}
      </ul>}
      {!user ? <p className="notification-message">Sign in to see updates to proposals you follow or have participated in.</p> : <>
        {error && <div className="notification-message" role="alert"><p>{error}</p>
          <button className="text-button" onClick={() => { void refresh(true) }}>Try again</button></div>}
        {loading && !inbox && <p className="notification-message" role="status">Loading notifications…</p>}
        {inbox && !inbox.items.length && !demoNotifications.length && !loading && !error && <p className="notification-message">You’re all caught up. Updates to proposals you follow or have participated in will appear here.</p>}
        {!!inbox?.items.length && <>
          <p className="notification-caption">Updates to proposals you follow or have participated in</p>
          <ul className="notification-list">{inbox.items.map(item => <li key={item.id}>
            <button className="notification-item" onClick={() => { onSelect(item); setOpen(false) }}>
              <span className="notification-item-icon"><Icon name="layers" /></span>
              <span><strong>{item.proposal_title}</strong><span>A source update is available</span>
                <time dateTime={item.created_at}>{timestamp(item.created_at)}</time></span>
              {!item.read_at && <span className="notification-dot" aria-label="New" />}
            </button>
          </li>)}</ul>
          <p className="notification-caption">Opening notifications marks them as seen. Your history stays here.</p>
        </>}
      </>}
    </section>}
  </div>
}
