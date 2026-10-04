import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, sessionExpiredMessage, sessionNoticeFromMe, setUnauthorizedHandler } from '../src/lib/api'

function mockFetch(status: number, body: unknown = {}) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  setUnauthorizedHandler(null)
  vi.unstubAllGlobals()
})

describe('BUG-02: apiFetch forces logout on expired protected requests', () => {
  it('calls the unauthorized handler with the session-expired message on any 401', async () => {
    for (const code of ['SESSION_EXPIRED', 'AUTH_REQUIRED']) {
      mockFetch(401, { error: 'x', code })
      const handler = vi.fn()
      setUnauthorizedHandler(handler)
      const response = await apiFetch('/student/progress')
      expect(response.status).toBe(401)
      expect(handler).toHaveBeenCalledWith(sessionExpiredMessage)
    }
  })

  it('does not end the session on success or non-auth errors, and sends cookies', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    const fetchMock = mockFetch(200, { ok: true })
    await apiFetch('/student/mastery')
    mockFetch(503, { error: 'db down' })
    await apiFetch('/student/mastery')
    expect(handler).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith('/api/student/mastery', expect.objectContaining({ credentials: 'include' }))
  })
})

describe('BUG-01: /auth/me session notice', () => {
  it('shows the expired message only for SESSION_EXPIRED', () => {
    expect(sessionNoticeFromMe(401, { code: 'SESSION_EXPIRED' })).toBe(sessionExpiredMessage)
    expect(sessionNoticeFromMe(401, { code: 'AUTH_REQUIRED' })).toBe('')
    expect(sessionNoticeFromMe(401, null)).toBe('')
    expect(sessionNoticeFromMe(200, { code: 'SESSION_EXPIRED' })).toBe('')
  })
})
