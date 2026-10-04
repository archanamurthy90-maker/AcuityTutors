// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { sessionExpiredMessage } from '../src/lib/api'

const ava = { id: 'u1', email: 'ava@acuity.local', role: 'STUDENT', displayName: 'Ava Chen' }

function stubApi(routes: Record<string, [number, unknown]>) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input).replace(/^\/api/, '')
    const [status, body] = routes[path] ?? [404, { error: 'not found' }]
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }))
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

describe('expired sessions return to sign-in with a clear message', () => {
  it('BUG-01: /auth/me SESSION_EXPIRED shows the notice on the login page', async () => {
    stubApi({ '/auth/me': [401, { error: sessionExpiredMessage, code: 'SESSION_EXPIRED' }] })
    render(<App />)
    expect(await screen.findByText(sessionExpiredMessage)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeTruthy()
  })

  it('BUG-02: a 401 from a background progress request logs the user out even when the dashboard loaded', async () => {
    const expired: [number, unknown] = [401, { error: sessionExpiredMessage, code: 'SESSION_EXPIRED' }]
    stubApi({
      '/auth/me': [200, { user: ava }],
      '/student/dashboard': [200, { message: 'Your student workspace is ready.' }],
      '/student/mastery': [200, { scores: [] }],
      '/student/progress': expired,
    })
    window.history.replaceState(null, '', '/student')
    render(<App />)
    expect(await screen.findByText(sessionExpiredMessage)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeTruthy()
    expect(window.location.pathname).toBe('/login')
  })

  it('a normal signed-out visit shows no session notice', async () => {
    stubApi({ '/auth/me': [401, { error: 'Please sign in to continue.', code: 'AUTH_REQUIRED' }] })
    render(<App />)
    await screen.findByRole('heading', { name: 'Welcome back' })
    expect(screen.queryByText(sessionExpiredMessage)).toBeNull()
  })

  it('BUG-06: the sign-in page describes password storage as hashing, not encryption', async () => {
    stubApi({ '/auth/me': [401, { error: 'Please sign in to continue.', code: 'AUTH_REQUIRED' }] })
    render(<App />)
    expect(await screen.findByText('Your password is securely hashed before it is stored.')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/encrypt/i)
  })
})
