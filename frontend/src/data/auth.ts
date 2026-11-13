/**
 * Client-side authentication state and API calls.
 *
 * Design notes:
 * - Reading proposals and community feedback needs no account. An account is
 *   only required to *submit* feedback, matching the backend's public-read /
 *   authenticated-write split.
 * - The JWT is stored in localStorage so a login survives a refresh. This is a
 *   pragmatic hackathon choice; a production build would prefer an httpOnly
 *   cookie to reduce XSS exposure. Noted as a known limitation.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const TOKEN_KEY = 'proviso-auth-token'
const USER_KEY = 'proviso-auth-username'

export interface AuthUser {
  username: string
}

export interface AuthSession {
  token: string
  username: string
}

/** Return the stored bearer token, or null if the user is not logged in. */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

/** Return the current user from local storage without contacting the server. */
export function getStoredUser(): AuthUser | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const username = localStorage.getItem(USER_KEY)
    if (token && username) return { username }
  } catch {
    /* storage unavailable */
  }
  return null
}

function persistSession(session: AuthSession): void {
  try {
    localStorage.setItem(TOKEN_KEY, session.token)
    localStorage.setItem(USER_KEY, session.username)
  } catch {
    /* Session will last only for this visit if storage is blocked. */
  }
}

/** Clear the stored session (log out). */
export function logout(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    /* ignore */
  }
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json()
    if (body && typeof body.detail === 'string') return body.detail
  } catch {
    /* non-JSON error body */
  }
  return fallback
}

/** Create an account and store the returned session. */
export async function register(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(await readError(res, 'Could not create the account. Please try again.'))
  const data = await res.json()
  persistSession({ token: data.access_token, username: data.username })
  return { username: data.username }
}

/** Log in and store the returned session. */
export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(await readError(res, 'Invalid username or password.'))
  const data = await res.json()
  persistSession({ token: data.access_token, username: data.username })
  return { username: data.username }
}

/**
 * Verify the stored token against the server and return the current user.
 * Returns null (and clears the session) if the token is missing or expired.
 */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const token = getToken()
  if (!token) return null
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 401) {
      logout()
      return null
    }
    if (!res.ok) return getStoredUser()
    const data = await res.json()
    return { username: data.username }
  } catch {
    // Network issue: trust the locally stored session for this visit.
    return getStoredUser()
  }
}
