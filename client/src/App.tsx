import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'

type UserRole = 'STUDENT' | 'TUTOR'
type AuthUser = { id: string; email: string; role: UserRole; displayName: string }
type AuthMode = 'login' | 'register'
type MasteryStatus = 'MASTERED' | 'DEVELOPING' | 'NEEDS_PRACTICE' | 'NOT_ENOUGH_DATA'
type MasteryScore = {
  id: string
  score: number
  status: MasteryStatus
  attemptCount: number
  topic: { id: string; name: string; subject: { name: string } }
}
type RosterStudent = { id: string; displayName: string; email: string; scores: MasteryScore[] }

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
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState('')
  const [scores, setScores] = useState<MasteryScore[]>([])
  const [students, setStudents] = useState<RosterStudent[]>([])
  const [selectedTopicId, setSelectedTopicId] = useState('')
  const [attemptIsCorrect, setAttemptIsCorrect] = useState(true)
  const [savingAttempt, setSavingAttempt] = useState(false)
  const [attemptMessage, setAttemptMessage] = useState('')
  const [attemptError, setAttemptError] = useState('')

  useEffect(() => {
    if (!user) return
    let active = true
    const currentRole = user.role
    const role = currentRole.toLowerCase()

    async function loadWorkspace() {
      setDataLoading(true)
      setDataError('')
      try {
        const [dashboardResponse, masteryResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/${role}/dashboard`, { credentials: 'include' }),
          fetch(`${apiBaseUrl}/${role}/mastery`, { credentials: 'include' }),
        ])
        const dashboardData = (await dashboardResponse.json()) as { message?: string; error?: string }
        const masteryData = (await masteryResponse.json()) as {
          scores?: MasteryScore[]
          students?: RosterStudent[]
          error?: string
        }

        if (!dashboardResponse.ok || !masteryResponse.ok) {
          if (dashboardResponse.status === 401 || masteryResponse.status === 401) setUser(null)
          throw new Error(masteryData.error ?? dashboardData.error ?? 'Unable to load your workspace.')
        }

        if (!active) return
        setMessage(dashboardData.message ?? 'Your workspace is ready.')
        if (currentRole === 'STUDENT') setScores(masteryData.scores ?? [])
        else setStudents(masteryData.students ?? [])
      } catch (requestError) {
        if (active) setDataError(requestError instanceof Error ? requestError.message : 'Unable to load your workspace.')
      } finally {
        if (active) setDataLoading(false)
      }
    }

    void loadWorkspace()

    return () => { active = false }
  }, [user, setUser])

  async function handleAttemptSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAttemptMessage('')
    setAttemptError('')
    if (!selectedTopicId && scores.length === 0) {
      setAttemptError('There are no topic scores available yet.')
      return
    }

    const topicId = selectedTopicId || scores[0].topic.id
    setSavingAttempt(true)
    try {
      const response = await fetch(`${apiBaseUrl}/student/attempts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, isCorrect: attemptIsCorrect }),
      })
      const data = (await response.json()) as {
        error?: string
        mastery?: { accuracy: number | null; status: MasteryStatus; totalAttempts: number }
      }
      if (!response.ok || !data.mastery) throw new Error(data.error ?? 'Unable to save this attempt.')

      if (data.mastery.accuracy !== null) {
        setScores((current) => current.map((score) => score.topic.id === topicId
          ? { ...score, score: data.mastery!.accuracy!, status: data.mastery!.status, attemptCount: data.mastery!.totalAttempts }
          : score))
      }
      setAttemptMessage(`Saved. ${statusLabel(data.mastery.status)} after ${data.mastery.totalAttempts} attempts.`)
    } catch (requestError) {
      setAttemptError(requestError instanceof Error ? requestError.message : 'Unable to save this attempt.')
    } finally {
      setSavingAttempt(false)
    }
  }

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
        {dataError && <p className="data-error" role="alert">{dataError}</p>}
        {dataLoading ? <p className="mastery-loading" aria-live="polite">Loading mastery data…</p> : isStudent ? (
          <>
            <section className="mastery-section" aria-labelledby="mastery-title">
              <div className="mastery-section-heading">
                <div><p className="eyebrow">TOPIC CLASSIFICATION</p><h2 id="mastery-title">Your mastery</h2></div>
                <span className="mastery-count">{scores.length} topics</span>
              </div>
              <MasteryTable scores={scores} />
            </section>

            <section className="attempt-panel" aria-labelledby="attempt-title">
              <div><p className="eyebrow">RECORD A QUIZ RESULT</p><h2 id="attempt-title">Log an attempt</h2></div>
              <form className="attempt-form" onSubmit={handleAttemptSubmit}>
                <label className="field-label" htmlFor="attempt-topic">Topic</label>
                <select id="attempt-topic" value={selectedTopicId || scores[0]?.topic.id || ''} onChange={(event) => setSelectedTopicId(event.target.value)} disabled={scores.length === 0}>
                  {scores.map((score) => <option key={score.topic.id} value={score.topic.id}>{score.topic.subject.name} · {score.topic.name}</option>)}
                </select>
                <fieldset className="attempt-result-fieldset">
                  <legend className="field-label">Result</legend>
                  <div className="attempt-result-options">
                    <button className={`attempt-result ${attemptIsCorrect ? 'selected' : ''}`} type="button" aria-pressed={attemptIsCorrect} onClick={() => setAttemptIsCorrect(true)}>Correct</button>
                    <button className={`attempt-result ${!attemptIsCorrect ? 'selected' : ''}`} type="button" aria-pressed={!attemptIsCorrect} onClick={() => setAttemptIsCorrect(false)}>Incorrect</button>
                  </div>
                </fieldset>
                {attemptError && <p className="form-error" role="alert">{attemptError}</p>}
                {attemptMessage && <p className="attempt-success" role="status">{attemptMessage}</p>}
                <button className="submit-button attempt-submit" type="submit" disabled={savingAttempt || scores.length === 0} aria-busy={savingAttempt}>
                  {savingAttempt ? 'Saving…' : 'Save attempt'} {!savingAttempt && <span aria-hidden="true">&#8594;</span>}
                </button>
              </form>
            </section>
          </>
        ) : (
          <section className="roster-section" aria-labelledby="roster-title">
            <div className="mastery-section-heading">
              <div><p className="eyebrow">ROSTER CLASSIFICATION</p><h2 id="roster-title">Student mastery</h2></div>
              <span className="mastery-count">{students.length} students · {students.reduce((count, student) => count + student.scores.length, 0)} topics</span>
            </div>
            {students.map((student) => (
              <article className="roster-student" key={student.id}>
                <header className="roster-student-heading">
                  <div><h3>{student.displayName}</h3><p>{student.email}</p></div>
                  <div className="roster-status-counts">
                    <span>{countStatus(student.scores, 'MASTERED')} mastered</span>
                    <span>{countStatus(student.scores, 'DEVELOPING')} developing</span>
                    <span>{countStatus(student.scores, 'NEEDS_PRACTICE')} need practice</span>
                    <span>{countStatus(student.scores, 'NOT_ENOUGH_DATA')} insufficient data</span>
                  </div>
                </header>
                <MasteryTable scores={student.scores} compact />
              </article>
            ))}
            {students.length === 0 && <p className="empty-roster">No students are linked to your roster yet.</p>}
          </section>
        )}
      </main>
      <footer className="dashboard-footer"><span>ACUITY TUTORS</span><span>Focused practice starts with a clear picture.</span></footer>
    </div>
  )
}

function statusLabel(status: MasteryStatus) {
  switch (status) {
    case 'MASTERED': return 'Mastered'
    case 'DEVELOPING': return 'Developing'
    case 'NEEDS_PRACTICE': return 'Needs Practice'
    case 'NOT_ENOUGH_DATA': return 'Not enough data'
  }
}

function countStatus(scores: MasteryScore[], status: MasteryStatus) {
  return scores.filter((score) => score.status === status).length
}

function MasteryTable({ scores, compact = false }: { scores: MasteryScore[]; compact?: boolean }) {
  if (scores.length === 0) return <p className="empty-mastery">No mastery scores yet.</p>

  return (
    <div className={`mastery-table-wrap ${compact ? 'compact' : ''}`}>
      <table className="mastery-table">
        <thead><tr><th scope="col">Topic</th><th scope="col">Accuracy</th><th scope="col">Attempts</th><th scope="col">Classification</th></tr></thead>
        <tbody>{scores.map((score) => (
          <tr key={score.id}>
            <th scope="row"><span>{score.topic.name}</span><small>{score.topic.subject.name}</small></th>
            <td>{score.score.toFixed(1).replace(/\.0$/, '')}%</td>
            <td>{score.attemptCount}</td>
            <td><span className={`mastery-status mastery-status-${score.status.toLowerCase().replaceAll('_', '-')}`}>{statusLabel(score.status)}</span></td>
          </tr>
        ))}</tbody>
      </table>
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
