import { useEffect, useRef, useState, type FormEvent } from 'react'
import { apiFetch, readApiJson } from '../lib/api.js'

const reasonMaxLength = 300

export function AiLabel({ children = 'AI-generated — may contain mistakes.' }: { children?: string }) {
  return <p className="ai-label"><span className="ai-label-badge">AI</span>{children}</p>
}

export function MasteryExplainer() {
  return (
    <section className="mastery-explainer" aria-labelledby="mastery-explainer-title">
      <h3 id="mastery-explainer-title">How your mastery is calculated</h3>
      <p>For each topic, accuracy is <strong>correct answers ÷ total attempts</strong>, using every answer you have saved. It is a fixed rule, not an AI judgement.</p>
      <ul>
        <li><strong>Mastered</strong>: 80% or higher</li>
        <li><strong>Developing</strong>: 60–79%</li>
        <li><strong>Needs Practice</strong>: below 60%</li>
        <li><strong>Not enough data</strong>: fewer than 3 attempts</li>
      </ul>
    </section>
  )
}

// Lets a student flag a bad AI question. Rendered with key={questionId} so it resets per question.
export function ReportQuestion({ questionId }: { questionId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [reported, setReported] = useState(false)
  const reasonRef = useRef<HTMLTextAreaElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const confirmationRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (open) reasonRef.current?.focus()
  }, [open])
  useEffect(() => {
    if (reported) confirmationRef.current?.focus()
  }, [reported])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (reason.length > reasonMaxLength) {
      setError(`Keep the reason to ${reasonMaxLength} characters or fewer.`)
      return
    }
    setSending(true)
    setError('')
    try {
      const response = await apiFetch(`/student/practice-questions/${questionId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reason.trim() ? { reason: reason.trim() } : {}),
      })
      const data = (await readApiJson(response)) as { error?: string; details?: Array<{ message: string }> }
      if (response.status === 409) {
        setReported(true)
        return
      }
      if (!response.ok) throw new Error(data.details?.[0]?.message ?? data.error ?? 'Unable to send the report.')
      setReported(true)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to send the report.')
    } finally {
      setSending(false)
    }
  }

  if (reported) {
    return <p className="report-confirmation" role="status" ref={confirmationRef} tabIndex={-1}>Thanks — this question has been reported. Your tutor will review it.</p>
  }

  if (!open) {
    return (
      <button className="report-toggle" type="button" ref={toggleRef} onClick={() => setOpen(true)}>
        Report this question
      </button>
    )
  }

  return (
    <form className="report-form" onSubmit={handleSubmit} aria-labelledby="report-form-title">
      <p className="report-form-title" id="report-form-title">Report this question</p>
      <label className="field-label" htmlFor={`report-reason-${questionId}`}>What looks wrong? (optional)</label>
      <textarea
        id={`report-reason-${questionId}`}
        ref={reasonRef}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={reasonMaxLength}
        rows={3}
        aria-describedby={`report-reason-count-${questionId}${error ? ` report-error-${questionId}` : ''}`}
        aria-invalid={Boolean(error)}
        placeholder="For example: the marked answer is wrong, or the question is confusing."
      />
      <p className="field-hint" id={`report-reason-count-${questionId}`}>{reason.length}/{reasonMaxLength} characters. Don't include personal information.</p>
      {error && <p className="form-error" id={`report-error-${questionId}`} role="alert">{error}</p>}
      <div className="report-actions">
        <button className="secondary-action" type="submit" disabled={sending} aria-busy={sending}>{sending ? 'Sending…' : 'Send report'}</button>
        <button className="report-cancel" type="button" onClick={() => { setOpen(false); setError(''); requestAnimationFrame(() => toggleRef.current?.focus()) }}>Cancel</button>
      </div>
    </form>
  )
}

type QuestionReport = {
  id: string
  reason: string | null
  createdAt: string
  student: { id: string; displayName: string }
  practiceQuestion: {
    prompt: string
    choices: unknown
    correctAnswer: string
    explanation: string
    difficulty: string
    topic: { name: string; subject: { name: string } }
  }
}

// Tutor review list: only reports from the tutor's own roster (enforced by the API).
export function ReportedQuestions() {
  const [reports, setReports] = useState<QuestionReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiFetch('/tutor/question-reports')
      .then(async (response) => {
        const data = (await readApiJson(response)) as { reports?: QuestionReport[]; error?: string }
        if (!response.ok) throw new Error(data.error ?? 'Unable to load reported questions.')
        if (active) setReports(data.reports ?? [])
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load reported questions.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return (
    <section className="reported-questions" aria-labelledby="reported-questions-title">
      <div className="mastery-section-heading">
        <div><p className="eyebrow">HUMAN REVIEW</p><h2 id="reported-questions-title">Reported AI questions</h2></div>
        <span className="mastery-count">{loading ? 'Loading…' : `${reports.length} ${reports.length === 1 ? 'report' : 'reports'}`}</span>
      </div>
      <p className="reported-intro">Students in your roster flagged these AI-generated questions. Check the question and answer key, and follow up with the student if needed.</p>
      {error && <p className="data-error" role="alert">{error}</p>}
      {!loading && !error && reports.length === 0 && <p className="empty-roster">No questions have been reported by your students.</p>}
      {reports.map((report) => {
        const choices = Array.isArray(report.practiceQuestion.choices) ? report.practiceQuestion.choices.filter((choice): choice is string => typeof choice === 'string') : []
        return (
          <article className="reported-question" key={report.id} aria-labelledby={`report-${report.id}`}>
            <h3 id={`report-${report.id}`}>{report.student.displayName} · {report.practiceQuestion.topic.subject.name} · {report.practiceQuestion.topic.name}</h3>
            <p className="reported-meta">Reported {new Date(report.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            <p className="reported-reason"><strong>Reason:</strong> {report.reason ?? 'No reason given.'}</p>
            <AiLabel>AI-generated question and answer key — may contain mistakes.</AiLabel>
            <p className="reported-prompt">{report.practiceQuestion.prompt}</p>
            <ol className="reported-choices" type="A">
              {choices.map((choice) => (
                <li key={choice}>{choice}{choice.toLocaleLowerCase() === report.practiceQuestion.correctAnswer.toLocaleLowerCase() && <strong> (marked correct)</strong>}</li>
              ))}
            </ol>
            <p className="reported-explanation"><strong>AI explanation:</strong> {report.practiceQuestion.explanation}</p>
          </article>
        )
      })}
    </section>
  )
}
