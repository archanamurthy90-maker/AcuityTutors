// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'

const topic = (name: string, subject: string) => ({ name, subject: { name: subject } })
const scores = [
  { id: 's1', score: 40, status: 'NEEDS_PRACTICE', attemptCount: 5, topic: { id: 'cjld2cjxh0000qzrmn831top3', ...topic('Life Science', 'Science') } },
]
const ava = { id: 'u1', email: 'ava@acuity.local', role: 'STUDENT', displayName: 'Ava Chen' }
const tutor = { id: 'u2', email: 'tutor@acuity.local', role: 'TUTOR', displayName: 'Jordan Ellis' }
const question = { id: 'cjld2cjxh0000qzrmn831qst1', topicId: 'cjld2cjxh0000qzrmn831top3', question: 'Which organelle releases energy for the cell?', options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Cell wall'], difficulty: 'BEGINNER', topic: 'Life Science' }
const reportPath = `POST /student/practice-questions/${question.id}/report`

type Route = [number, unknown]
const requests: Array<{ key: string; body: unknown }> = []
function stubApi(routes: Record<string, Route>) {
  requests.length = 0
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(input).replace(/^\/api/, '')}`
    requests.push({ key, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    const [status, body] = routes[key] ?? [404, { error: 'not found' }]
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }))
}
const studentRoutes = (extra: Record<string, Route> = {}): Record<string, Route> => ({
  'GET /auth/me': [200, { user: ava }],
  'GET /student/dashboard': [200, { message: 'ready' }],
  'GET /student/mastery': [200, { scores }],
  'GET /student/progress': [200, { progress: [] }],
  'POST /student/practice-questions': [201, { practiceQuestion: question }],
  [`POST /student/practice-questions/${question.id}/answer`]: [201, { isCorrect: false, correctAnswer: 'Mitochondria', explanation: 'Mitochondria release energy from food.', mastery: { accuracy: 33.3, status: 'NEEDS_PRACTICE', totalAttempts: 6 } }],
  ...extra,
})

async function openStudentWithQuestion(extra?: Record<string, Route>) {
  stubApi(studentRoutes(extra))
  window.history.replaceState(null, '', '/student')
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Generate question' }))
  await screen.findByRole('heading', { name: question.question })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

describe('RAI-01: AI content is labelled', () => {
  it('labels the generated question and its explanation', async () => {
    await openStudentWithQuestion()
    expect(screen.getByText('AI-generated question — may contain mistakes.')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: /Nucleus/ }))
    fireEvent.click(screen.getByRole('button', { name: /Check answer/ }))
    await screen.findByText('Mitochondria release energy from food.')
    expect(screen.getByText(/AI-generated explanation — may contain mistakes\. Your score is calculated by the app, not the AI\./)).toBeTruthy()
  })

  it('labels tutor summaries as AI suggestions and leaves the decision to the tutor (RAI-04)', async () => {
    stubApi({
      'GET /auth/me': [200, { user: tutor }],
      'GET /tutor/dashboard': [200, { message: 'ready' }],
      'GET /tutor/mastery': [200, { students: [{ id: 'cjld2cjxh0000qzrmn831ava1', displayName: 'Ava Chen', email: 'ava@acuity.local', scores }], totalScores: 1 }],
      'GET /tutor/question-reports': [200, { reports: [] }],
      'POST /tutor/students/cjld2cjxh0000qzrmn831ava1/summary': [200, { student: 'Ava Chen', summary: 'Consider starting with Life Science.' }],
    })
    window.history.replaceState(null, '', '/tutor')
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Generate summary' }))
    const summary = (await screen.findByText('Consider starting with Life Science.')).closest('.tutor-summary') as HTMLElement
    expect(within(summary).getByText('Suggested next steps')).toBeTruthy()
    expect(within(summary).getByText(/AI-generated suggestions — may contain mistakes\. You make the final decision/)).toBeTruthy()
  })
})

describe('RAI-02: mastery explanation', () => {
  it('explains the deterministic rule and thresholds on the student dashboard', async () => {
    stubApi(studentRoutes())
    window.history.replaceState(null, '', '/student')
    render(<App />)
    const explainer = (await screen.findByRole('heading', { name: 'How your mastery is calculated' })).closest('section') as HTMLElement
    expect(explainer.textContent).toContain('correct answers ÷ total attempts')
    expect(explainer.textContent).toContain('not an AI judgement')
    for (const rule of ['Mastered: 80% or higher', 'Developing: 60–79%', 'Needs Practice: below 60%', 'Not enough data: fewer than 3 attempts']) {
      expect(explainer.textContent).toContain(rule)
    }
  })
})

describe('RAI-03: report this question', () => {
  it('sends an optional trimmed reason, then confirms and moves focus to the confirmation', async () => {
    await openStudentWithQuestion({ [reportPath]: [201, { report: { id: 'r1' } }] })
    fireEvent.click(screen.getByRole('button', { name: 'Report this question' }))
    const reason = screen.getByLabelText('What looks wrong? (optional)')
    await waitFor(() => expect(document.activeElement).toBe(reason))
    expect(reason.getAttribute('maxlength')).toBe('300')
    fireEvent.change(reason, { target: { value: '  The marked answer is wrong.  ' } })
    expect(screen.getByText(/31\/300 characters/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }))
    const confirmation = await screen.findByText(/this question has been reported/)
    await waitFor(() => expect(document.activeElement).toBe(confirmation))
    expect(requests.find((request) => request.key === reportPath)?.body).toEqual({ reason: 'The marked answer is wrong.' })
    expect(screen.queryByRole('button', { name: 'Report this question' })).toBeNull()
  })

  it('sends an empty body when no reason is given', async () => {
    await openStudentWithQuestion({ [reportPath]: [201, { report: { id: 'r1' } }] })
    fireEvent.click(screen.getByRole('button', { name: 'Report this question' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }))
    await screen.findByText(/this question has been reported/)
    expect(requests.find((request) => request.key === reportPath)?.body).toEqual({})
  })

  it('shows a server validation error in an alert linked to the field', async () => {
    await openStudentWithQuestion({ [reportPath]: [400, { error: 'Check the report and try again.', details: [{ field: 'reason', message: 'Keep the reason to 300 characters or fewer.' }] }] })
    fireEvent.click(screen.getByRole('button', { name: 'Report this question' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Keep the reason to 300 characters or fewer.')
    expect(screen.getByLabelText('What looks wrong? (optional)').getAttribute('aria-describedby')).toContain(alert.id)
  })

  it('treats an already-reported question (409) as reported', async () => {
    await openStudentWithQuestion({ [reportPath]: [409, { error: 'You have already reported this question.' }] })
    fireEvent.click(screen.getByRole('button', { name: 'Report this question' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }))
    expect(await screen.findByText(/this question has been reported/)).toBeTruthy()
  })
})

describe('RAI-03: tutor review of reported questions', () => {
  function openTutor(reports: unknown[]) {
    stubApi({
      'GET /auth/me': [200, { user: tutor }],
      'GET /tutor/dashboard': [200, { message: 'ready' }],
      'GET /tutor/mastery': [200, { students: [], totalScores: 0 }],
      'GET /tutor/question-reports': [200, { reports }],
    })
    window.history.replaceState(null, '', '/tutor')
    render(<App />)
  }

  it('lists roster reports with reason, answer key, explanation, and an AI label', async () => {
    openTutor([{ id: 'r1', reason: 'The marked answer is wrong.', createdAt: '2026-10-04T12:00:00Z', student: { id: 's', displayName: 'Ava Chen' }, practiceQuestion: { prompt: question.question, choices: question.options, correctAnswer: 'Nucleus', explanation: 'The nucleus stores DNA.', difficulty: 'BEGINNER', topic: { name: 'Life Science', subject: { name: 'Science' } } } }])
    const report = (await screen.findByRole('heading', { name: 'Ava Chen · Science · Life Science' })).closest('article') as HTMLElement
    expect(within(report).getByText(/The marked answer is wrong\./)).toBeTruthy()
    expect(within(report).getByText('(marked correct)').parentElement?.textContent).toBe('Nucleus (marked correct)')
    expect(within(report).getByText(/AI-generated question and answer key — may contain mistakes\./)).toBeTruthy()
    expect(screen.getByText('1 report')).toBeTruthy()
  })

  it('shows an empty state when nothing is reported', async () => {
    openTutor([])
    expect(await screen.findByText('No questions have been reported by your students.')).toBeTruthy()
  })
})
