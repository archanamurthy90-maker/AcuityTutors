import { Component, type ErrorInfo, type ReactNode } from 'react'

type ErrorBoundaryState = { hasError: boolean }

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Acuity Tutors UI error:', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="error-fallback" role="alert" aria-labelledby="error-fallback-title">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
        <h1 id="error-fallback-title">Something went wrong.</h1>
        <p>This page hit an unexpected problem. Your saved work is safe. Reload the page to try again.</p>
        <div className="error-fallback-actions">
          <button type="button" className="primary-button" onClick={() => window.location.reload()}>Reload page</button>
          <a href="/">Go to home</a>
        </div>
      </main>
    )
  }
}
