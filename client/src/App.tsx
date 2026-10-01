import { useEffect, useState } from 'react'
import './App.css'

type HealthResponse = {
  status: string
  databaseConfigured: boolean
  databaseConnected: boolean
  geminiConfigured: boolean
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [connection, setConnection] = useState<'checking' | 'online' | 'offline'>('checking')

  useEffect(() => {
    let active = true

    fetch(`${apiBaseUrl}/health`)
      .then(async (response) => {
        if (!response.ok) throw new Error('API request failed')
        return (await response.json()) as HealthResponse
      })
      .then((data) => {
        if (!active) return
        setHealth(data)
        setConnection('online')
      })
      .catch(() => {
        if (active) setConnection('offline')
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="workspace">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Acuity Tutors home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>Acuity <b>Tutors</b></span>
        </a>
        <nav aria-label="Main navigation">
          <a className="nav-link active" href="#overview">Overview</a>
        </nav>
        <span className="environment-label">LOCAL WORKSPACE</span>
      </header>

      <main id="overview">
        <div className="page-heading">
          <div>
            <p className="eyebrow">ACUITY TUTORS / DEVELOPMENT</p>
            <h1>Workspace setup</h1>
            <p className="intro">The application foundation is in place. Check service configuration below.</p>
          </div>
          <div className={`connection connection-${connection}`} aria-live="polite">
            <span className="connection-dot" />
            {connection === 'checking' ? 'Checking API' : connection === 'online' ? 'API connected' : 'API unavailable'}
          </div>
        </div>

        <section className="status-section" aria-labelledby="services-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">FOUNDATION</p>
              <h2 id="services-title">Service status</h2>
            </div>
            <span className="section-note">Local development</span>
          </div>

          <div className="service-grid">
            <article className="service-row api-row">
              <span className="service-index">01</span>
              <div className="service-info">
                <h3>Express API</h3>
                <p>{connection === 'online' ? `Status: ${health?.status ?? 'online'}` : connection === 'checking' ? 'Waiting for the server response' : 'Start the API server to connect'}</p>
              </div>
              <span className={`service-state state-${connection}`}>{connection === 'online' ? 'Online' : connection === 'checking' ? 'Checking' : 'Offline'}</span>
            </article>

            <article className="service-row">
              <span className="service-index">02</span>
              <div className="service-info">
                <h3>PostgreSQL</h3>
                <p>Persistent student and progress data</p>
              </div>
              <span className={`service-state ${health?.databaseConnected ? 'state-ready' : health?.databaseConfigured ? 'state-offline' : 'state-pending'}`}>
                {health?.databaseConnected ? 'Connected' : health?.databaseConfigured ? 'Configured, not connected' : 'Needs configuration'}
              </span>
            </article>

            <article className="service-row">
              <span className="service-index">03</span>
              <div className="service-info">
                <h3>Gemini API</h3>
                <p>Server-side question generation</p>
              </div>
              <span className={`service-state ${health?.geminiConfigured ? 'state-ready' : 'state-pending'}`}>
                {health?.geminiConfigured ? 'Configured' : 'Needs configuration'}
              </span>
            </article>
          </div>
        </section>

        <section className="next-section" aria-labelledby="next-title">
          <div className="next-number">NEXT</div>
          <div>
            <h2 id="next-title">Build the learning workspace</h2>
            <p>Authentication, roster management, attempt history, and mastery scoring are the next product layer.</p>
          </div>
          <span className="next-arrow" aria-hidden="true">&#8599;</span>
        </section>

        <footer>
          <span>ACUITY TUTORS</span>
          <span>Focused practice starts with a clear picture.</span>
        </footer>
      </main>
    </div>
  )
}

export default App
