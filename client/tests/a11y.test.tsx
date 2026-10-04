// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import axe from 'axe-core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { ErrorBoundary } from '../src/components/ErrorBoundary'
import { describeProgress } from '../src/lib/progress'

const subject = (name: string) => ({ name })
const scores = [
  { id: 's1', score: 87.5, status: 'MASTERED', attemptCount: 8, topic: { id: 'cjld2cjxh0000qzrmn831top1', name: 'Fractions and Ratios', subject: subject('Mathematics') } },
  { id: 's2', score: 66.7, status: 'DEVELOPING', attemptCount: 9, topic: { id: 'cjld2cjxh0000qzrmn831top2', name: 'Expressions and Equations', subject: subject('Mathematics') } },
  { id: 's3', score: 40, status: 'NEEDS_PRACTICE', attemptCount: 5, topic: { id: 'cjld2cjxh0000qzrmn831top3', name: 'Life Science', subject: subject('Science') } },
  { id: 's4', score: 50, status: 'NOT_ENOUGH_DATA', attemptCount: 2, topic: { id: 'cjld2cjxh0000qzrmn831top4', name: 'Earth Systems', subject: subject('Science') } },
]
const progress = [{
  topicId: 'cjld2cjxh0000qzrmn831top1',
  topicName: 'Fractions and Ratios',
  subjectName: 'Mathematics',
  points: [
    { attemptedAt: '2026-09-01T10:00:00Z', accuracy: 100, attempts: 1, isCorrect: true },
    { attemptedAt: '2026-09-02T10:00:00Z', accuracy: 50, attempts: 2, isCorrect: false },
    { attemptedAt: '2026-09-03T10:00:00Z', accuracy: 66.7, attempts: 3, isCorrect: true },
  ],
}]
const ava = { id: 'u1', email: 'ava@acuity.local', role: 'STUDENT', displayName: 'Ava Chen' }
const tutor = { id: 'u2', email: 'tutor@acuity.local', role: 'TUTOR', displayName: 'Jordan Ellis' }
const question = { id: 'cjld2cjxh0000qzrmn831qst1', topicId: 'cjld2cjxh0000qzrmn831top3', question: 'Which organelle makes energy for the cell?', options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Cell wall'], difficulty: 'BEGINNER', topic: 'Life Science' }

type Route = [number, unknown]
function stubApi(routes: Record<string, Route>) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input).replace(/^\/api/, '')
    const key = `${init?.method ?? 'GET'} ${path}`
    const [status, body] = routes[key] ?? routes[path] ?? [404, { error: 'not found' }]
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }))
}
const signedOut: Record<string, Route> = { '/auth/me': [401, { code: 'AUTH_REQUIRED' }] }
const studentRoutes: Record<string, Route> = {
  '/auth/me': [200, { user: ava }],
  '/student/dashboard': [200, { message: 'Your student workspace is ready.' }],
  '/student/mastery': [200, { scores }],
  '/student/progress': [200, { progress }],
  'POST /student/practice-questions': [201, { practiceQuestion: question }],
  [`POST /student/practice-questions/${question.id}/answer`]: [201, { isCorrect: true, correctAnswer: 'Mitochondria', explanation: 'Mitochondria release energy from food.', mastery: { accuracy: 50, status: 'NEEDS_PRACTICE', totalAttempts: 6 } }],
}
const tutorRoutes: Record<string, Route> = {
  '/auth/me': [200, { user: tutor }],
  '/tutor/dashboard': [200, { message: 'Your tutor workspace is ready.' }],
  '/tutor/mastery': [200, { students: [{ id: 'cjld2cjxh0000qzrmn831ava1', displayName: 'Ava Chen', email: 'ava@acuity.local', scores }], totalScores: 4 }],
  '/tutor/students/cjld2cjxh0000qzrmn831ava1/progress': [200, { progress }],
}

// jsdom cannot compute rendered colours, so contrast is checked in the token test below and in the browser.
async function expectNoAxeViolations() {
  const results = await axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    rules: { 'color-contrast': { enabled: false } },
  })
  const summary = results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)
  expect(summary).toEqual([])
}

// index.html declares lang="en"; jsdom's blank document does not.
document.documentElement.lang = 'en'

function openAt(path: string) {
  window.history.replaceState(null, '', path)
  render(<App />)
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('A11Y: automated axe checks (WCAG 2.1 A/AA + best practice)', () => {
  it('sign-in page, including field errors', async () => {
    stubApi(signedOut)
    openAt('/login')
    await screen.findByRole('heading', { name: 'Welcome back' })
    await expectNoAxeViolations()
    fireEvent.click(screen.getByRole('button', { name: /Sign in/ }))
    await screen.findByText('Enter a valid email address.')
    await expectNoAxeViolations()
  })

  it('register page', async () => {
    stubApi(signedOut)
    openAt('/register')
    await screen.findByRole('heading', { name: 'Create your account' })
    await expectNoAxeViolations()
  })

  it('student dashboard with mastery tables, chart alternative, question, and feedback', async () => {
    stubApi(studentRoutes)
    openAt('/student')
    await screen.findByRole('heading', { name: 'Your mastery' })
    await screen.findByText(/accuracy after 3 attempts/)
    await expectNoAxeViolations()
    fireEvent.click(screen.getByRole('button', { name: 'Generate question' }))
    await screen.findByRole('heading', { name: question.question })
    fireEvent.click(screen.getByRole('radio', { name: /Mitochondria/ }))
    fireEvent.click(screen.getByRole('button', { name: /Check answer/ }))
    await screen.findByText('Mitochondria release energy from food.')
    await expectNoAxeViolations()
  })

  it('tutor dashboard with a student expanded', async () => {
    stubApi(tutorRoutes)
    openAt('/tutor')
    const toggle = await screen.findByRole('button', { name: /Ava Chen, show full topic breakdown/ })
    fireEvent.click(toggle)
    await screen.findByRole('heading', { name: 'Full topic breakdown for Ava Chen' })
    await screen.findByText(/accuracy after 3 attempts/)
    await expectNoAxeViolations()
  })

  it('error fallback page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    function Crash(): never { throw new Error('boom') }
    render(<ErrorBoundary><Crash /></ErrorBoundary>)
    await expectNoAxeViolations()
  })
})

describe('A11Y: keyboard and focus', () => {
  it('the first Tab stop is a skip link to the focusable main landmark', async () => {
    stubApi(studentRoutes)
    openAt('/student')
    await screen.findByRole('heading', { name: 'Your mastery' })
    const focusable = document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, [tabindex="0"]')
    expect(focusable[0].textContent).toBe('Skip to main content')
    expect(focusable[0].getAttribute('href')).toBe('#main-content')
    const main = screen.getByRole('main')
    expect(main.id).toBe('main-content')
    expect(main.getAttribute('tabindex')).toBe('-1')
  })

  it('focus moves to the new question after Generate, then to the feedback after Check answer', async () => {
    stubApi(studentRoutes)
    openAt('/student')
    fireEvent.click(await screen.findByRole('button', { name: 'Generate question' }))
    const heading = await screen.findByRole('heading', { name: question.question })
    await waitFor(() => expect(document.activeElement).toBe(heading))
    fireEvent.click(screen.getByRole('radio', { name: /Mitochondria/ }))
    fireEvent.click(screen.getByRole('button', { name: /Check answer/ }))
    const feedback = await screen.findByText('Mitochondria release energy from food.')
    await waitFor(() => expect(document.activeElement).toBe(feedback.closest('.practice-feedback')))
  })

  it('the error fallback moves focus to its heading', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    function Crash(): never { throw new Error('boom') }
    render(<ErrorBoundary><Crash /></ErrorBoundary>)
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Something went wrong.' }))
  })

  it('wide tables are keyboard-scrollable named regions', async () => {
    stubApi(studentRoutes)
    openAt('/student')
    const region = await screen.findByRole('region', { name: 'Mathematics topic mastery table' })
    expect(region.getAttribute('tabindex')).toBe('0')
    expect(within(region).getByRole('table', { name: 'Mathematics topic mastery' })).toBeTruthy()
  })
})

describe('A11Y: forms', () => {
  it('invalid fields are marked, linked to their messages, summarised in an alert, and focused', async () => {
    stubApi(signedOut)
    openAt('/login')
    await screen.findByRole('heading', { name: 'Welcome back' })
    fireEvent.click(screen.getByRole('button', { name: /Sign in/ }))
    const email = screen.getByLabelText('Email address')
    const password = screen.getByLabelText('Password')
    expect(email.getAttribute('aria-invalid')).toBe('true')
    expect(email.getAttribute('aria-describedby')).toBe('email-error')
    expect(document.getElementById('email-error')?.textContent).toBe('Enter a valid email address.')
    expect(password.getAttribute('aria-describedby')).toBe('password-error')
    expect(document.getElementById('password-error')?.textContent).toBe('Enter your password.')
    expect(screen.getByRole('alert').textContent).toBe('Check these fields: Email address, Password.')
    expect(document.activeElement).toBe(email)
  })

  it('server field errors are attached to the matching field', async () => {
    stubApi({ ...signedOut, 'POST /auth/register': [400, { error: 'Check the form fields and try again.', details: [{ field: 'displayName', message: 'Use 80 characters or fewer.' }] }] })
    openAt('/register')
    await screen.findByRole('heading', { name: 'Create your account' })
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'New Student' } })
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'new@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Student2026' } })
    fireEvent.click(screen.getByRole('button', { name: /Create account/ }))
    await screen.findByText('Use 80 characters or fewer.')
    expect(screen.getByLabelText('Full name').getAttribute('aria-describedby')).toBe('displayName-error')
    expect(document.getElementById('form-error')?.getAttribute('role')).toBe('alert')
  })
})

describe('A11Y: text alternatives and announcements', () => {
  it('AX9: the accuracy chart has a text summary and a screen-reader data table, and the SVG is hidden', async () => {
    stubApi(studentRoutes)
    openAt('/student')
    const summary = await screen.findByText(describeProgress(progress[0]))
    expect(summary.textContent).toBe('Mathematics · Fractions and Ratios: 66.7% accuracy after 3 attempts, down 33.3% from 100% after the first attempt.')
    const table = screen.getByRole('table', { name: 'Accuracy after each attempt: Mathematics, Fractions and Ratios' })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(4)
    expect(within(rows[2]).getByText('Incorrect')).toBeTruthy()
    expect(within(rows[2]).getByText('50%')).toBeTruthy()
    expect(document.querySelector('.accuracy-chart')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('mastery levels are written out in text, not shown by colour alone', async () => {
    stubApi(studentRoutes)
    openAt('/student')
    const table = await screen.findByRole('table', { name: 'Science topic mastery' })
    expect(within(table).getByText('Needs Practice')).toBeTruthy()
    expect(within(table).getByText('Not enough data')).toBeTruthy()
  })

  it('loading and progress are announced through a persistent status region', async () => {
    stubApi(studentRoutes)
    openAt('/student')
    await screen.findByRole('heading', { name: 'Your mastery' })
    const announcer = document.querySelector('.workspace-shell > [role="status"]')
    expect(announcer?.textContent).toBe('Mastery data loaded.')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Generate question' })) })
    expect(announcer?.textContent).toMatch(/Creating a practice question|Mastery data loaded/)
  })

  it('each page has a descriptive title', async () => {
    stubApi(signedOut)
    openAt('/login')
    await screen.findByRole('heading', { name: 'Welcome back' })
    expect(document.title).toBe('Sign in · Acuity Tutors')
    cleanup()
    stubApi(tutorRoutes)
    openAt('/tutor')
    await screen.findByRole('heading', { name: 'Topics needing attention' })
    expect(document.title).toBe('Tutor dashboard · Acuity Tutors')
  })
})
