// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '../src/components/ErrorBoundary'

function Crash(): never {
  throw new Error('render failure')
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('BUG-03: React error boundary', () => {
  it('shows a friendly fallback instead of a blank screen when a child crashes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Crash /></ErrorBoundary>)
    expect(screen.getByRole('heading', { name: 'Something went wrong.' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeTruthy()
    expect(screen.queryByText('render failure')).toBeNull()
  })

  it('renders children normally when nothing fails', () => {
    render(<ErrorBoundary><p>Dashboard ready</p></ErrorBoundary>)
    expect(screen.getByText('Dashboard ready')).toBeTruthy()
  })
})
