import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'
import { apiBaseUrl, apiFetch, sessionNoticeFromMe, setUnauthorizedHandler } from './lib/api.js'

const AccuracyChart = lazy(() => import('./components/AccuracyChart.js').then((module) => ({ default: module.AccuracyChart })))

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
type TopicProgress = {
  topicId: string
  topicName: string
  subjectName: string
  points: Array<{ attemptedAt: string; accuracy: number; attempts: number; isCorrect: boolean }>
}
type ClassTopicSummary = {
  topicId: string
  topicName: string
  subjectName: string
  averageAccuracy: number
  studentCount: number
  needsPractice: number
  developing: number
  mastered: number
  insufficientData: number
}
type GeneratedPracticeQuestion = {
  id: string
  topicId: string
  question: string
  options: string[]
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  topic: string
}
type PracticeResult = {
  isCorrect: boolean
  correctAnswer: string
  explanation: string
  mastery: { accuracy: number | null; status: MasteryStatus; totalAttempts: number }
}

const registrationPasswordRule = 'Use at least 8 characters, including a letter and a number.'
const AuthContext = createContext<{
  user: AuthUser | null
  setUser: (user: AuthUser | null) => void
  loading: boolean
  sessionNotice: string
} | null>(null)

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionNotice, setSessionNotice] = useState('')

  const setUser = useCallback((nextUser: AuthUser | null) => {
    if (nextUser) setSessionNotice('')
    setUserState(nextUser)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler((message) => {
      setSessionNotice(message)
      setUserState(null)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    fetch(`${apiBaseUrl}/auth/me`, { credentials: 'include', signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { user?: AuthUser } | null
        if (response.ok && data?.user) return data.user
        setSessionNotice(sessionNoticeFromMe(response.status, data))
        return null
      })
      .then((currentUser) => setUserState(currentUser))
      .catch(() => setUserState(null))
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [])

  return <AuthContext.Provider value={{ user, setUser, loading, sessionNotice }}>{children}</AuthContext.Provider>
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
  const { setUser, sessionNotice } = useAuth()
  const navigate = useNavigate()
  const isRegister = mode === 'register'
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordFieldError, setPasswordFieldError] = useState('')
  const [role, setRole] = useState<UserRole>('STUDENT')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPasswordFieldError('')

    if (isRegister && displayName.trim().length < 2) {
      setError('Enter your name using at least 2 characters.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    if (isRegister && (password.length < 8 || !/[a-z]/i.test(password) || !/\d/.test(password))) {
      setPasswordFieldError(registrationPasswordRule)
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
          {sessionNotice && <p className="session-notice" role="status">{sessionNotice}</p>}

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
              onChange={(event) => {
                setPassword(event.target.value)
                setPasswordFieldError('')
              }}
              minLength={isRegister ? 8 : undefined}
              maxLength={128}
              aria-invalid={isRegister && Boolean(passwordFieldError)}
              aria-describedby={isRegister ? passwordFieldError ? 'password-hint password-error' : 'password-hint' : undefined}
              required
            />
            {isRegister && <p className="field-hint" id="password-hint">At least 8 characters, including a letter and a number.</p>}
            {passwordFieldError && <p className="form-error field-error" id="password-error" role="alert">{passwordFieldError}</p>}

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
          <p className="auth-security">Your password is securely hashed before it is stored.</p>
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
  const [generatedQuestion, setGeneratedQuestion] = useState<GeneratedPracticeQuestion | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [practiceResult, setPracticeResult] = useState<PracticeResult | null>(null)
  const [generatingQuestion, setGeneratingQuestion] = useState(false)
  const [submittingAnswer, setSubmittingAnswer] = useState(false)
  const [practiceError, setPracticeError] = useState('')
  const [tutorSummaries, setTutorSummaries] = useState<Record<string, string>>({})
  const [summaryErrors, setSummaryErrors] = useState<Record<string, string>>({})
  const [summaryLoadingId, setSummaryLoadingId] = useState('')
  const [studentProgress, setStudentProgress] = useState<TopicProgress[]>([])
  const [progressLoading, setProgressLoading] = useState(false)
  const [progressError, setProgressError] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedStudentProgress, setSelectedStudentProgress] = useState<TopicProgress[]>([])
  const [studentProgressLoading, setStudentProgressLoading] = useState(false)
  const [studentProgressError, setStudentProgressError] = useState('')

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
          apiFetch(`/${role}/dashboard`),
          apiFetch(`/${role}/mastery`),
        ])
        const dashboardData = (await dashboardResponse.json()) as { message?: string; error?: string }
        const masteryData = (await masteryResponse.json()) as {
          scores?: MasteryScore[]
          students?: RosterStudent[]
          error?: string
        }

        if (!dashboardResponse.ok || !masteryResponse.ok) {
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
  }, [user])

  useEffect(() => {
    if (!user || user.role !== 'STUDENT') return
    let active = true

    apiFetch('/student/progress')
      .then(async (response) => {
        const data = (await response.json()) as { progress?: TopicProgress[]; error?: string }
        if (!response.ok) throw new Error(data.error ?? 'Unable to load progress history.')
        return data.progress ?? []
      })
      .then((progress) => { if (active) setStudentProgress(progress) })
      .catch((error: unknown) => {
        if (active) setProgressError(error instanceof Error ? error.message : 'Unable to load progress history.')
      })
      .finally(() => { if (active) setProgressLoading(false) })

    return () => { active = false }
  }, [user])

  useEffect(() => {
    if (!user || user.role !== 'TUTOR' || !selectedStudentId) return

    let active = true
    apiFetch(`/tutor/students/${selectedStudentId}/progress`)
      .then(async (response) => {
        const data = (await response.json()) as { progress?: TopicProgress[]; error?: string }
        if (!response.ok) throw new Error(data.error ?? 'Unable to load this student’s progress.')
        return data.progress ?? []
      })
      .then((progress) => { if (active) setSelectedStudentProgress(progress) })
      .catch((error: unknown) => {
        if (active) setStudentProgressError(error instanceof Error ? error.message : 'Unable to load this student’s progress.')
      })
      .finally(() => { if (active) setStudentProgressLoading(false) })

    return () => { active = false }
  }, [user, selectedStudentId])

  function handleSelectStudent(studentId: string) {
    if (selectedStudentId === studentId) {
      setSelectedStudentId('')
      setSelectedStudentProgress([])
      setStudentProgressError('')
      setStudentProgressLoading(false)
      return
    }
    setSelectedStudentId(studentId)
    setSelectedStudentProgress([])
    setStudentProgressError('')
    setStudentProgressLoading(true)
  }

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
      const response = await apiFetch('/student/attempts', {
        method: 'POST',
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

  async function handleGenerateQuestion() {
    setGeneratingQuestion(true)
    setPracticeError('')
    setPracticeResult(null)
    setSelectedAnswer('')
    try {
      const response = await apiFetch('/student/practice-questions', { method: 'POST' })
      const data = (await response.json()) as { practiceQuestion?: GeneratedPracticeQuestion; error?: string }
      if (!response.ok || !data.practiceQuestion) throw new Error(data.error ?? 'Unable to make a practice question.')
      setGeneratedQuestion(data.practiceQuestion)
    } catch (requestError) {
      setPracticeError(requestError instanceof Error ? requestError.message : 'Unable to make a practice question.')
    } finally {
      setGeneratingQuestion(false)
    }
  }

  async function handlePracticeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!generatedQuestion || !selectedAnswer) return
    setSubmittingAnswer(true)
    setPracticeError('')
    try {
      const response = await apiFetch(`/student/practice-questions/${generatedQuestion.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: selectedAnswer }),
      })
      const data = (await response.json()) as PracticeResult & { error?: string }
      if (!response.ok || !data.mastery) throw new Error(data.error ?? 'Unable to grade this answer.')
      setPracticeResult(data)
      if (data.mastery.accuracy !== null) {
        setScores((current) => current.map((score) => score.topic.id === generatedQuestion.topicId
          ? { ...score, score: data.mastery.accuracy as number, status: data.mastery.status, attemptCount: data.mastery.totalAttempts }
          : score))
      }
    } catch (requestError) {
      setPracticeError(requestError instanceof Error ? requestError.message : 'Unable to grade this answer.')
    } finally {
      setSubmittingAnswer(false)
    }
  }

  async function handleGenerateSummary(studentId: string) {
    setSummaryLoadingId(studentId)
    setSummaryErrors((current) => ({ ...current, [studentId]: '' }))
    try {
      const response = await apiFetch(`/tutor/students/${studentId}/summary`, { method: 'POST' })
      const data = (await response.json()) as { summary?: string; error?: string }
      if (!response.ok || !data.summary) throw new Error(data.error ?? 'Unable to create a student summary.')
      setTutorSummaries((current) => ({ ...current, [studentId]: data.summary! }))
    } catch (requestError) {
      setSummaryErrors((current) => ({
        ...current,
        [studentId]: requestError instanceof Error ? requestError.message : 'Unable to create a student summary.',
      }))
    } finally {
      setSummaryLoadingId('')
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
  const classTopics = summarizeClassTopics(students)
  const groupedScores = groupScoresBySubject(scores)
  const masteredTopicCount = countStatus(scores, 'MASTERED')
  const needsPracticeCount = countStatus(scores, 'NEEDS_PRACTICE')
  const weakest = weakestScore(scores)

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
            <section className="student-summary-band" aria-label="Mastery summary">
              {scores.length === 0
                ? <p>No quiz attempts yet. Try your first practice question to start building a progress history.</p>
                : <p><strong>{masteredTopicCount} {masteredTopicCount === 1 ? 'topic' : 'topics'} mastered</strong>, {needsPracticeCount} need practice<span className="summary-divider">·</span>{countStatus(scores, 'DEVELOPING')} developing</p>}
            </section>
            <section className="mastery-section" aria-labelledby="mastery-title">
              <div className="mastery-section-heading">
                <div><p className="eyebrow">TOPIC CLASSIFICATION</p><h2 id="mastery-title">Your mastery</h2></div>
                <span className="mastery-count">{scores.length} topics</span>
              </div>
              {groupedScores.length === 0 ? <p className="empty-mastery">Your topic breakdown will appear after your first quiz attempt.</p> : (
                <GroupedMastery scores={scores} groupedScores={groupedScores} />
              )}
            </section>

            <ProgressChart progress={studentProgress} loading={progressLoading} error={progressError} title="Accuracy over time" />

              <section className="ai-practice-panel" aria-labelledby="ai-practice-title">
                <div className="ai-practice-heading">
                  <div><p className="eyebrow">ADAPTIVE PRACTICE</p><h2 id="ai-practice-title">Practice your weakest topic</h2></div>
                  <button className="secondary-action" type="button" onClick={handleGenerateQuestion} disabled={generatingQuestion || scores.length === 0} aria-busy={generatingQuestion}>
                    {generatingQuestion ? 'Creating…' : generatedQuestion ? 'New question' : 'Generate question'}
                  </button>
                </div>
                <p className="ai-practice-intro">Gemini makes a fresh question at a difficulty matched to your current mastery.</p>
                {scores.length === 0 && <p className="practice-empty-note">Log your first quiz attempt before generating targeted practice.</p>}
                {weakest && <div className="weakest-topic-cue"><span>TOP PRIORITY</span><strong>{weakest.topic.subject.name} · {weakest.topic.name}</strong><span className={`mastery-status mastery-status-${weakest.status.toLowerCase().replaceAll('_', '-')}`}>{statusLabel(weakest.status)}</span></div>}
                {practiceError && <p className="data-error" role="alert">{practiceError}</p>}
                {generatedQuestion && (
                  <div className="generated-question">
                    <div className="question-meta"><span>{generatedQuestion.topic}</span><span>{difficultyLabel(generatedQuestion.difficulty)}</span></div>
                    <h3>{generatedQuestion.question}</h3>
                    <form onSubmit={handlePracticeSubmit}>
                      <fieldset className="practice-options" disabled={Boolean(practiceResult) || submittingAnswer}>
                        <legend className="visually-hidden">Choose one answer</legend>
                        {generatedQuestion.options.map((option, index) => (
                          <label className={`practice-option ${selectedAnswer === option ? 'selected' : ''}`} key={`${index}-${option}`}>
                            <input type="radio" name="practice-answer" value={option} checked={selectedAnswer === option} onChange={() => setSelectedAnswer(option)} />
                            <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                            <span>{option}</span>
                          </label>
                        ))}
                      </fieldset>
                      {practiceResult && (
                        <div className={`practice-feedback ${practiceResult.isCorrect ? 'feedback-correct' : 'feedback-incorrect'}`} role="status">
                          <strong>{practiceResult.isCorrect ? 'Correct' : 'Not quite'}</strong>
                          <p>Answer: {practiceResult.correctAnswer}</p>
                          <p>{practiceResult.explanation}</p>
                          <small>Mastery is now {practiceResult.mastery.accuracy?.toFixed(1)}% · {statusLabel(practiceResult.mastery.status)}</small>
                        </div>
                      )}
                      {!practiceResult && <button className="submit-button practice-submit" type="submit" disabled={!selectedAnswer || submittingAnswer} aria-busy={submittingAnswer}>{submittingAnswer ? 'Checking…' : 'Check answer'} {!submittingAnswer && <span aria-hidden="true">&#8594;</span>}</button>}
                    </form>
                  </div>
                )}
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
          <>
            <section className="class-overview" aria-labelledby="class-overview-title">
              <div className="mastery-section-heading">
                <div><p className="eyebrow">CLASS-WIDE SIGNAL</p><h2 id="class-overview-title">Topics needing attention</h2></div>
                <span className="mastery-count">{classTopics.length} topics</span>
              </div>
              {classTopics.length === 0 ? <p className="empty-roster">Class-wide topic patterns will appear when roster attempts are available.</p> : (
                <div className="mastery-table-wrap">
                  <table className="mastery-table class-topic-table">
                    <thead><tr><th scope="col">Topic</th><th scope="col">Avg. accuracy</th><th scope="col">Need practice</th><th scope="col">Developing</th></tr></thead>
                    <tbody>{classTopics.map((topic) => (
                      <tr key={topic.topicId}>
                        <th scope="row"><span>{topic.topicName}</span><small>{topic.subjectName}</small></th>
                        <td>{topic.averageAccuracy.toFixed(1).replace(/\.0$/, '')}%</td>
                        <td><span className="class-count-needs">{topic.needsPractice} / {topic.studentCount}</span></td>
                        <td>{topic.developing}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="roster-section" aria-labelledby="roster-title">
              <div className="mastery-section-heading">
                <div><p className="eyebrow">ROSTER CLASSIFICATION</p><h2 id="roster-title">Student overview</h2></div>
                <span className="mastery-count">{students.length} students</span>
              </div>
              {students.map((student) => {
                const overall = getOverallMastery(student.scores)
                const weakTopics = getWeakTopics(student.scores)
                const isSelected = selectedStudentId === student.id
                const groupedStudentScores = groupScoresBySubject(student.scores)

                return (
                  <article className={`roster-student ${isSelected ? 'roster-student-selected' : ''}`} key={student.id}>
                    <header className="roster-student-heading">
                      <div className="roster-student-identity">
                        <button className="student-select" type="button" aria-expanded={isSelected} onClick={() => handleSelectStudent(student.id)}>{student.displayName}</button>
                        <p>{student.email}</p>
                        <p className="roster-weak-topics"><strong>Focus:</strong> {weakTopics.length ? weakTopics.slice(0, 3).map((score) => score.topic.name).join(', ') : 'No identified weak topics'}</p>
                      </div>
                      <div className="roster-student-metrics">
                        <span className={`mastery-status mastery-status-${overall.status.toLowerCase().replaceAll('_', '-')}`}>Overall: {statusLabel(overall.status)}</span>
                        <span>{overall.accuracy === null ? 'No scored attempts' : `${overall.accuracy.toFixed(1)}% overall`}</span>
                        <span>{countStatus(student.scores, 'NEEDS_PRACTICE')} need practice</span>
                        <span>{countStatus(student.scores, 'DEVELOPING')} developing</span>
                      </div>
                    </header>
                    <div className="tutor-summary-area">
                      <button className="secondary-action" type="button" onClick={() => handleGenerateSummary(student.id)} disabled={summaryLoadingId === student.id} aria-busy={summaryLoadingId === student.id}>
                        {summaryLoadingId === student.id ? 'Writing summary…' : tutorSummaries[student.id] ? 'Refresh summary' : 'Generate summary'}
                      </button>
                      {summaryErrors[student.id] && <p className="form-error" role="alert">{summaryErrors[student.id]}</p>}
                      {tutorSummaries[student.id] && <p className="tutor-summary" role="status">{tutorSummaries[student.id]}</p>}
                    </div>
                    {isSelected && (
                      <section className="student-detail" aria-labelledby={`detail-${student.id}`}>
                        <h3 id={`detail-${student.id}`}>Full topic breakdown</h3>
                        <GroupedMastery scores={student.scores} groupedScores={groupedStudentScores} compact />
                        <ProgressChart progress={selectedStudentProgress} loading={studentProgressLoading} error={studentProgressError} title={`${student.displayName} progress over time`} />
                      </section>
                    )}
                  </article>
                )
              })}
              {students.length === 0 && <p className="empty-roster">No students are linked to your roster yet.</p>}
            </section>
          </>
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

function difficultyLabel(difficulty: GeneratedPracticeQuestion['difficulty']) {
  switch (difficulty) {
    case 'BEGINNER': return 'Easy'
    case 'INTERMEDIATE': return 'Medium'
    case 'ADVANCED': return 'Hard'
  }
}

function countStatus(scores: MasteryScore[], status: MasteryStatus) {
  return scores.filter((score) => score.status === status).length
}

function weakestScore(scores: MasteryScore[]) {
  const priority: Record<MasteryStatus, number> = {
    NEEDS_PRACTICE: 0,
    DEVELOPING: 1,
    NOT_ENOUGH_DATA: 2,
    MASTERED: 3,
  }
  return [...scores].sort((left, right) => priority[left.status] - priority[right.status] || left.score - right.score)[0]
}

function getWeakTopics(scores: MasteryScore[]) {
  return scores
    .filter((score) => score.status === 'NEEDS_PRACTICE' || score.status === 'DEVELOPING')
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === 'NEEDS_PRACTICE' ? -1 : 1
      return left.score - right.score
    })
}

function getOverallMastery(scores: MasteryScore[]) {
  const attempts = scores.reduce((total, score) => total + score.attemptCount, 0)
  if (attempts < 3) return { accuracy: null, status: 'NOT_ENOUGH_DATA' as const }
  const correct = scores.reduce((total, score) => total + score.score * score.attemptCount / 100, 0)
  const accuracy = correct / attempts * 100
  const status = accuracy >= 80 ? 'MASTERED' : accuracy >= 60 ? 'DEVELOPING' : 'NEEDS_PRACTICE'
  return { accuracy, status: status as MasteryStatus }
}

function summarizeClassTopics(students: RosterStudent[]): ClassTopicSummary[] {
  const topicGroups = new Map<string, { summary: ClassTopicSummary; accuracyTotal: number }>()
  for (const student of students) {
    for (const score of student.scores) {
      const group = topicGroups.get(score.topic.id) ?? {
        accuracyTotal: 0,
        summary: {
          topicId: score.topic.id,
          topicName: score.topic.name,
          subjectName: score.topic.subject.name,
          averageAccuracy: 0,
          studentCount: 0,
          needsPractice: 0,
          developing: 0,
          mastered: 0,
          insufficientData: 0,
        },
      }
      group.accuracyTotal += score.score
      group.summary.studentCount += 1
      if (score.status === 'NEEDS_PRACTICE') group.summary.needsPractice += 1
      if (score.status === 'DEVELOPING') group.summary.developing += 1
      if (score.status === 'MASTERED') group.summary.mastered += 1
      if (score.status === 'NOT_ENOUGH_DATA') group.summary.insufficientData += 1
      group.summary.averageAccuracy = group.accuracyTotal / group.summary.studentCount
      topicGroups.set(score.topic.id, group)
    }
  }

  return [...topicGroups.values()].map(({ summary }) => summary).sort((left, right) =>
    right.needsPractice - left.needsPractice || right.developing - left.developing || left.averageAccuracy - right.averageAccuracy,
  )
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

function groupScoresBySubject(scores: MasteryScore[]) {
  const groups = new Map<string, MasteryScore[]>()
  for (const score of scores) {
    const group = groups.get(score.topic.subject.name) ?? []
    group.push(score)
    groups.set(score.topic.subject.name, group)
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))
}

function GroupedMastery({
  scores,
  groupedScores = groupScoresBySubject(scores),
  compact = false,
}: {
  scores: MasteryScore[]
  groupedScores?: Array<[string, MasteryScore[]]>
  compact?: boolean
}) {
  return (
    <div className={`grouped-mastery ${compact ? 'grouped-mastery-compact' : ''}`}>
      {groupedScores.map(([subject, subjectScores]) => (
        <section className="subject-mastery-group" key={subject} aria-label={`${subject} topics`}>
          <h3>{subject}</h3>
          <MasteryTable scores={subjectScores} compact={compact} />
        </section>
      ))}
    </div>
  )
}

function ProgressChart({
  progress,
  loading,
  error,
  title,
}: {
  progress: TopicProgress[]
  loading: boolean
  error: string
  title: string
}) {
  const [requestedTopicId, setRequestedTopicId] = useState('')
  const selectedTopicId = progress.some((topic) => topic.topicId === requestedTopicId)
    ? requestedTopicId
    : progress[0]?.topicId ?? ''

  const selectedTopic = progress.find((topic) => topic.topicId === selectedTopicId)
  const chartPoints = selectedTopic?.points.map((point) => ({
    ...point,
    date: new Date(point.attemptedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  })) ?? []

  return (
    <section className="progress-panel" aria-labelledby={`progress-${title.replaceAll(' ', '-')}`}>
      <header className="progress-panel-heading">
        <div><p className="eyebrow">ATTEMPT HISTORY</p><h2 id={`progress-${title.replaceAll(' ', '-')}`}>{title}</h2></div>
        {progress.length > 0 && (
          <label className="progress-topic-select">
            <span>Topic</span>
            <select value={selectedTopicId} onChange={(event) => setRequestedTopicId(event.target.value)}>
              {progress.map((topic) => <option key={topic.topicId} value={topic.topicId}>{topic.subjectName} · {topic.topicName}</option>)}
            </select>
          </label>
        )}
      </header>
      {loading ? <p className="progress-empty" aria-live="polite">Loading attempt history…</p>
        : error ? <p className="progress-error" role="alert">{error}</p>
          : !selectedTopic || chartPoints.length === 0 ? <p className="progress-empty">No quiz attempts yet. Your accuracy chart will appear after your first answer.</p>
            : (
              <>
                <p className="progress-chart-caption">Running accuracy after each saved attempt.</p>
                <div className="accuracy-chart">
                  <Suspense fallback={<p className="chart-loading">Loading chart…</p>}>
                    <AccuracyChart points={chartPoints} />
                  </Suspense>
                </div>
              </>
            )}
    </section>
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
