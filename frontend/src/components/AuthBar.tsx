import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { login, register, type AuthUser } from '../data/auth'

interface Props {
  currentUser: AuthUser | null
  onAuthenticated: (user: AuthUser) => void
  onLogout: () => void
}

type Mode = 'login' | 'register'

/**
 * Header control for authentication. When logged out it opens a small
 * login / register popover; when logged in it shows the username and a
 * log-out button. Reading the site never requires any of this — only
 * submitting feedback and following proposals do.
 */
export function AuthBar({ currentUser, onAuthenticated, onLogout }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) requestAnimationFrame(() => firstFieldRef.current?.focus())
  }, [open, mode])

  // Close the popover on outside click or Escape.
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function resetForm() {
    setUsername('')
    setPassword('')
    setError('')
    setBusy(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const user = mode === 'login'
        ? await login(username.trim(), password)
        : await register(username.trim(), password)
      onAuthenticated(user)
      setOpen(false)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  if (currentUser) {
    return (
      <div className="auth-bar">
        <span className="auth-user" title={`Signed in as ${currentUser.username}`}>
          <Icon name="user" />
          <span className="auth-username">{currentUser.username}</span>
        </span>
        <button className="auth-link" onClick={onLogout}>Log out</button>
      </div>
    )
  }

  return (
    <div className="auth-bar" ref={popoverRef}>
      <button
        className="auth-button"
        data-tooltip="Sign in or create an account to submit feedback, keep followed proposals, and receive updates. You can browse and try the full demo without signing in."
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => { setOpen(o => !o); setMode('login'); resetForm() }}
      >
        <Icon name="user" /> Log in
      </button>

      {open && (
        <div className="auth-popover" role="dialog" aria-label="Log in or create an account">
          <div className="auth-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={mode === 'login'}
              data-tooltip="Sign in with an existing username and password."
              className={mode === 'login' ? 'active' : ''}
              onClick={() => { setMode('login'); setError('') }}
            >Log in</button>
            <button
              role="tab"
              aria-selected={mode === 'register'}
              data-tooltip="Choose a username and password to create an account for submitting feedback and following proposals."
              className={mode === 'register' ? 'active' : ''}
              onClick={() => { setMode('register'); setError('') }}
            >Create account</button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              <span>Username</span>
              <input
                ref={firstFieldRef}
                type="text"
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                minLength={3}
                maxLength={50}
                required
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={mode === 'register' ? 6 : 1}
                maxLength={200}
                required
              />
            </label>

            {error && <p className="auth-error" role="alert">{error}</p>}

            <button type="submit" className="auth-submit" disabled={busy}>
              {busy ? 'Working…' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
            <p className="auth-note">Sign in to submit feedback, follow proposals and receive updates. Browsing stays open to everyone.</p>
          </form>
        </div>
      )}
    </div>
  )
}
