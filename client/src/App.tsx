import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'

type UserRole = 'STUDENT' | 'TUTOR'
type AuthUser = { id: string; email: string; role: UserRole; displayName: string }
type AuthMode = 'login' | 'register'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'
const AuthContext = createContext<{
  user: AuthUser | null
  setUser: (user: AuthUser | null) => void
  loading: boolean
} | null>(null)

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    fetch(`${apiBaseUrl}/auth/me`, { credentials: 'include', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return null
        const data = (await response.json()) as { user: AuthUser }
        return data.user
      })
      .then((currentUser) => setUser(currentUser))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [])

  return <AuthContext.Provider value={{ user, setUser, loading }}>{children}</AuthContext.Provider>
}

function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('AuthProvider is missing.')
  return auth
}

function rolePath(role: UserRole) {
  return role === 'STUDENT' ? '/student' : '/tutor'
}

function LoadingPage() {
  return (
    <main className="loading-page" aria-live="polite">
      <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
      <p>Loading your workspace</p>
    </main>
  )
}

function AuthRoute({ mode }: { mode: AuthMode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingPage />
  if (user) return <Navigate to={rolePath(user.role)} replace />
  return <AuthPage mode={mode} />
}

function RoleRoute({ role }: { role: UserRole }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingPage />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to={rolePath(user.role)} replace />
  return <WorkspacePage />
}

function AuthPage({ mode }: { mode: AuthMode }) {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const isRegister = mode === 'register'
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('STUDENT')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (isRegister && displayName.trim().length < 2) {
      setError('Enter your name using at least 2 characters.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    if (isRegister && password.length < 8) {
      setError('Use a password with at least 8 characters.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`${apiBaseUrl}/auth/${mode}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          ...(isRegister ? { displayName: displayName.trim(), role } : {}),
        }),
      })
      const data = (await response.json()) as {
        user?: AuthUser
        error?: string
        details?: Array<{ field: string; message: string }>
      }

      if (!response.ok || !data.user) {
        const detail = data.details?.[0]?.message
        setError(detail ? `${data.error ?? 'Please check your details.'} ${detail}` : data.error ?? 'Unable to continue. Try again.')
        return
      }

      setUser(data.user)
      navigate(rolePath(data.user.role), { replace: true })
    } catch {
      setError('We could not reach the server. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="Acuity Tutors home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>Acuity <b>Tutors</b></span>
        </Link>
        <span className="environment-label">LEARNING WORKSPACE</span>
      </header>

      <main className="auth-layout">
        <section className="auth-intro">
          <p className="eyebrow">A CLEARER PATH TO MASTERY</p>
          <h1>{isRegister ? 'Make room for better practice.' : 'Good to have you back.'}</h1>
          <p className="auth-intro-copy">Focused learning starts with understanding what you know and what to work on next.</p>
          <div className="auth-rule" />
          <p className="auth-footnote">Acuity Tutors<br />Learning, made more intentional.</p>
        </section>

        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="auth-panel-head">
            <div>
              <p className="eyebrow">{isRegister ? 'GET STARTED' : 'SIGN IN'}</p>
              <h2 id="auth-title">{isRegister ? 'Create your account' : 'Welcome back'}</h2>
            </div>
            <span className="auth-mark" aria-hidden="true">A.</span>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {isRegister && (
              <>
                <label className="field-label" htmlFor="displayName">Full name</label>
                <input
                  id="displayName"
                  autoComplete="name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={80}
                  required
                />
                <fieldset className="role-fieldset">
                  <legend className="field-label">I am joining as</legend>
                  <div className="role-options">
                    {(['STUDENT', 'TUTOR'] as const).map((option) => (
                      <button
                        className={`role-option ${role === option ? 'selected' : ''}`}
                        key={option}
                        type="button"
                        aria-pressed={role === option}
                        onClick={() => setRole(option)}
                      >
                        {option === 'STUDENT' ? 'Student' : 'Tutor'}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            <label className="field-label" htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              required
            />

            <label className="field-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={isRegister ? 8 : undefined}
              maxLength={128}
              required
            />

            {error && <p className="form-error" role="alert">{error}</p>}

            <button className="submit-button" type="submit" disabled={submitting} aria-busy={submitting}>
              {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
              {!submitting && <span aria-hidden="true">&#8594;</span>}
            </button>
          </form>

          <p className="auth-switch">
            {isRegister ? 'Already have an account?' : 'New to Acuity Tutors?'}{' '}
            <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link>
          </p>
          <p className="auth-security">Your password is encrypted before it is stored.</p>
        </section>
      </main>
      <footer className="auth-footer"><span>ACUITY TUTORS</span><span>Focused practice starts with a clear picture.</span></footer>
    </div>
  )
}

function WorkspacePage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [message, setMessage] = useState('Loading your workspace…')
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    if (!user) return
    let active = true
    const role = user.role.toLowerCase()

    fetch(`${apiBaseUrl}/${role}/dashboard`, { credentials: 'include' })
      .then(async (response) => {
        const data = (await response.json()) as { message?: string; error?: string }
        if (!response.ok) throw new Error(data.error ?? 'Unable to load your workspace.')
        return data.message ?? 'Your workspace is ready.'
      })
      .then((status) => { if (active) setMessage(status) })
      .catch((requestError: unknown) => {
        if (active) setMessage(requestError instanceof Error ? requestError.message : 'Unable to load your workspace.')
      })

    return () => { active = false }
  }, [user])

  if (!user) return <LoadingPage />

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch(`${apiBaseUrl}/auth/logout`, { method: 'POST', credentials: 'include' })
    } finally {
      setUser(null)
      navigate('/login', { replace: true })
      setLoggingOut(false)
    }
  }

  const isStudent = user.role === 'STUDENT'

  return (
    <div className="workspace-shell">
      <header className="topbar">
        <Link className="brand" to={rolePath(user.role)} aria-label="Acuity Tutors home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>Acuity <b>Tutors</b></span>
        </Link>
        <div className="account-controls">
          <div className="account-identity"><span className="account-name">{user.displayName}</span><span className="account-role">{isStudent ? 'STUDENT' : 'TUTOR'}</span></div>
          <button className="logout-button" type="button" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? 'Signing out…' : 'Log out'}
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <p className="eyebrow">{isStudent ? 'YOUR LEARNING' : 'TUTOR WORKSPACE'}</p>
        <h1>{isStudent ? 'Your practice starts here.' : 'Your roster starts here.'}</h1>
        <p className="dashboard-intro">{message}</p>

        <section className="dashboard-placeholder" aria-labelledby="placeholder-title">
          <span className="placeholder-index">{isStudent ? '01 / STUDENT' : '01 / TUTOR'}</span>
          <div className="placeholder-copy">
            <h2 id="placeholder-title">{isStudent ? 'A focused view of your progress' : 'A clearer view of your students'}</h2>
            <p>{isStudent ? 'Your topic progress and targeted practice will appear here.' : 'Your roster, student progress, and weak topics will appear here.'}</p>
          </div>
          <span className="placeholder-state">WORKSPACE READY</span>
        </section>
      </main>
      <footer className="dashboard-footer"><span>ACUITY TUTORS</span><span>Focused practice starts with a clear picture.</span></footer>
    </div>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingPage />

  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? rolePath(user.role) : '/login'} replace />} />
      <Route path="/login" element={<AuthRoute mode="login" />} />
      <Route path="/register" element={<AuthRoute mode="register" />} />
      <Route path="/student" element={<RoleRoute role="STUDENT" />} />
      <Route path="/tutor" element={<RoleRoute role="TUTOR" />} />
      <Route path="*" element={<Navigate to={user ? rolePath(user.role) : '/login'} replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
