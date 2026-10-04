// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

describe('SEC3: public registration is student-only', () => {
  it('has no Tutor option and never sends a role', async () => {
    const requests: Array<{ path: string; body: unknown }> = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input).replace(/^\/api/, '')
      requests.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined })
      if (path === '/auth/me') return new Response(JSON.stringify({ code: 'AUTH_REQUIRED' }), { status: 401 })
      return new Response(JSON.stringify({ error: 'stop here' }), { status: 400 })
    }))
    window.history.replaceState(null, '', '/register')
    render(<App />)

    await screen.findByRole('heading', { name: 'Create your account' })
    expect(screen.queryByRole('button', { name: 'Tutor' })).toBeNull()
    expect(screen.getByText(/This creates a student account/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'New Student' } })
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'new@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Student2026' } })
    fireEvent.click(screen.getByRole('button', { name: /Create account/ }))

    await screen.findByText('stop here')
    const registration = requests.find((request) => request.path === '/auth/register')
    expect(registration?.body).toEqual({ email: 'new@example.com', password: 'Student2026', displayName: 'New Student' })
  })
})
