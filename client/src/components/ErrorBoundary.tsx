import { Component, createRef, type ErrorInfo, type ReactNode } from 'react'

type ErrorBoundaryState = { hasError: boolean }

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }
  private headingRef = createRef<HTMLHeadingElement>()

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Acuity Tutors UI error:', error, info.componentStack)
  }

  // The crashed content (and whatever had focus) is gone, so move focus to the fallback heading.
  // A crash on first render mounts the boundary straight into its error state.
  componentDidMount() {
    if (this.state.hasError) this.headingRef.current?.focus()
  }

  componentDidUpdate(_props: unknown, previous: ErrorBoundaryState) {
    if (this.state.hasError && !previous.hasError) this.headingRef.current?.focus()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="error-fallback" aria-labelledby="error-fallback-title">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
        <h1 id="error-fallback-title" ref={this.headingRef} tabIndex={-1}>Something went wrong.</h1>
        <p>This page hit an unexpected problem. Your saved work is safe. Reload the page to try again.</p>
        <div className="error-fallback-actions">
          <button type="button" className="primary-button" onClick={() => window.location.reload()}>Reload page</button>
          <a href="/">Go to home</a>
        </div>
      </main>
    )
  }
}
