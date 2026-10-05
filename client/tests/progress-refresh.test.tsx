// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'

const topicId = 'cjld2cjxh0000qzrmn831top3'
const question = { id: 'cjld2cjxh0000qzrmn831qst1', topicId, question: 'Which organelle releases energy for the cell?', options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Cell wall'], difficulty: 'BEGINNER', topic: 'Life Science' }
const scores = [{ id: 's1', score: 100, status: 'NOT_ENOUGH_DATA', attemptCount: 1, topic: { id: topicId, name: 'Life Science', subject: { name: 'Science' } } }]

// The fake server's attempt history grows with every saved attempt, like the real API.
function stubApi() {
  const results = [true]
  const calls: string[] = []
  const progress = () => [{
    topicId,
    topicName: 'Life Science',
    subjectName: 'Science',
    points: results.map((isCorrect, index) => ({
      attemptedAt: `2026-10-0${index + 1}T10:00:00Z`,
      attempts: index + 1,
      isCorrect,
      accuracy: (results.slice(0, index + 1).filter(Boolean).length / (index + 1)) * 100,
    })),
  }]
  const mastery = () => ({ accuracy: (results.filter(Boolean).length / results.length) * 100, status: 'NOT_ENOUGH_DATA', totalAttempts: results.length })

  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(input).replace(/^\/api/, '')}`
    calls.push(key)
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    switch (key) {
      case 'GET /auth/me': return json(200, { user: { id: 'u1', email: 'ava@acuity.local', role: 'STUDENT', displayName: 'Ava Chen' } })
      case 'GET /student/dashboard': return json(200, { message: 'ready' })
      case 'GET /student/mastery': return json(200, { scores })
      case 'GET /student/progress': return json(200, { progress: progress() })
      case 'POST /student/attempts': {
        results.push(JSON.parse(String(init?.body)).isCorrect)
        return json(201, { attempt: { id: `a${results.length}` }, mastery: mastery() })
      }
      case 'POST /student/practice-questions': return json(201, { practiceQuestion: question })
      case `POST /student/practice-questions/${question.id}/answer`: {
        results.push(false)
        return json(201, { isCorrect: false, correctAnswer: 'Mitochondria', explanation: 'Mitochondria release energy.', mastery: mastery() })
      }
      default: return json(404, { error: 'not found' })
    }
  }))
  return calls
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

describe('BUG-08: the progress chart refreshes after new attempts without a page reload', () => {
  it('updates after logging attempts and after answering a practice question', async () => {
    const calls = stubApi()
    window.history.replaceState(null, '', '/student')
    render(<App />)
    await screen.findByText('Science · Life Science: 100% accuracy after 1 attempt, unchanged from 100% after the first attempt.', {}, { timeout: 5000 })

    fireEvent.click(screen.getByRole('button', { name: 'Incorrect' }))
    fireEvent.click(screen.getByRole('button', { name: /Save attempt/ }))
    await screen.findByText('Science · Life Science: 50% accuracy after 2 attempts, down 50% from 100% after the first attempt.', {}, { timeout: 5000 })

    fireEvent.click(screen.getByRole('button', { name: 'Generate question' }))
    await screen.findByRole('heading', { name: question.question })
    fireEvent.click(screen.getByRole('radio', { name: /Nucleus/ }))
    fireEvent.click(screen.getByRole('button', { name: /Check answer/ }))
    await screen.findByText('Science · Life Science: 33.3% accuracy after 3 attempts, down 66.7% from 100% after the first attempt.', {}, { timeout: 5000 })

    // The refresh re-reads stored history only; it never asks Gemini for anything.
    expect(calls.filter((call) => call === 'POST /student/practice-questions')).toHaveLength(1)
    expect(calls.filter((call) => call === 'GET /student/progress')).toHaveLength(3)
  })
})
