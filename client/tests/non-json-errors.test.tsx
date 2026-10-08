// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { friendlyStatusMessage, readApiJson } from '../src/lib/api'

const scores = [{ id: 's1', score: 40, status: 'NEEDS_PRACTICE', attemptCount: 5, topic: { id: 'cjld2cjxh0000qzrmn831top3', name: 'Life Science', subject: { name: 'Science' } } }]
const timeoutMessage = 'The server took too long to respond. Please try again in a moment.'

// Cloud Run's own timeout reply is plain text, not JSON.
const upstreamTimeout = () => new Response('upstream request timeout', { status: 504, headers: { 'Content-Type': 'text/plain' } })

function stubApi(routes: Record<string, () => Response>) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(input).replace(/^\/api/, '')}`
    return routes[key]?.() ?? new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
  }))
}
const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

describe('BUG-09: non-JSON error responses show a friendly message', () => {
  it('readApiJson parses JSON and turns plain-text bodies into a friendly error', async () => {
    expect(await readApiJson(new Response('{"error":"Nope"}', { status: 400 }))).toEqual({ error: 'Nope' })
    expect(await readApiJson(upstreamTimeout())).toEqual({ error: timeoutMessage })
    expect(await readApiJson(new Response('<html>Bad Gateway</html>', { status: 502 }))).toEqual({ error: friendlyStatusMessage(502) })
    expect(await readApiJson(new Response(null, { status: 204 }))).toEqual({})
  })

  it('Generate question: a plain-text 504 shows the friendly message, not "Unexpected token"', async () => {
    stubApi({
      'GET /auth/me': json({ user: { id: 'u1', email: 'ava@acuity.local', role: 'STUDENT', displayName: 'Ava Chen' } }),
      'GET /student/dashboard': json({ message: 'ready' }),
      'GET /student/mastery': json({ scores }),
      'GET /student/progress': json({ progress: [] }),
      'POST /student/practice-questions': upstreamTimeout,
    })
    window.history.replaceState(null, '', '/student')
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Generate question' }))
    expect(await screen.findByText(timeoutMessage)).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/Unexpected token|is not valid JSON/)
  })

  it('Generate summary: a plain-text 504 shows the friendly message, not "Unexpected token"', async () => {
    stubApi({
      'GET /auth/me': json({ user: { id: 'u2', email: 'tutor@acuity.local', role: 'TUTOR', displayName: 'Jordan Ellis' } }),
      'GET /tutor/dashboard': json({ message: 'ready' }),
      'GET /tutor/mastery': json({ students: [{ id: 'cjld2cjxh0000qzrmn831ava1', displayName: 'Ava Chen', email: 'ava@acuity.local', scores }], totalScores: 1 }),
      'GET /tutor/question-reports': json({ reports: [] }),
      'POST /tutor/students/cjld2cjxh0000qzrmn831ava1/summary': upstreamTimeout,
    })
    window.history.replaceState(null, '', '/tutor')
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Generate summary' }))
    expect(await screen.findByText(timeoutMessage)).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/Unexpected token|is not valid JSON/)
  })

  it('shows "This can take up to 30 seconds" while a question is being generated', async () => {
    let release: (response: Response) => void = () => {}
    stubApi({
      'GET /auth/me': json({ user: { id: 'u1', email: 'ava@acuity.local', role: 'STUDENT', displayName: 'Ava Chen' } }),
      'GET /student/dashboard': json({ message: 'ready' }),
      'GET /student/mastery': json({ scores }),
      'GET /student/progress': json({ progress: [] }),
    })
    const stubbed = vi.mocked(fetch)
    const original = stubbed.getMockImplementation()!
    stubbed.mockImplementation(async (input, init) => (init?.method === 'POST' ? new Promise<Response>((resolve) => { release = resolve }) : original(input, init)))
    window.history.replaceState(null, '', '/student')
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Generate question' }))
    expect(await screen.findByText('This can take up to 30 seconds.')).toBeTruthy()
    release(upstreamTimeout())
    await screen.findByText(timeoutMessage)
    expect(screen.queryByText('This can take up to 30 seconds.')).toBeNull()
  })
})
