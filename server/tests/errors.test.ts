import assert from 'node:assert/strict'
import test from 'node:test'
import express from 'express'
import { Prisma } from '@prisma/client'
import {
  apiErrorHandler,
  databaseUnavailableMessage,
  invalidJsonMessage,
  isDatabaseUnavailableError,
  unexpectedErrorMessage,
} from '../src/middleware/errors.js'

async function callApp(failure: unknown, init: RequestInit = {}) {
  const app = express()
  app.use(express.json({ limit: '1mb' }))
  app.post('/route', (_request, _response, next) => { next(failure) })
  app.use(apiErrorHandler)
  const server = app.listen(0)
  try {
    const { port } = server.address() as { port: number }
    const response = await fetch(`http://127.0.0.1:${port}/route`, { method: 'POST', ...init })
    const text = await response.text()
    return { status: response.status, text, body: JSON.parse(text) as { error: string } }
  } finally {
    server.close()
  }
}

// Silence the expected server-side logging during these tests.
const originalConsoleError = console.error
test.before(() => { console.error = () => {} })
test.after(() => { console.error = originalConsoleError })

test('BUG-04: malformed JSON body returns 400 with a clear message', async () => {
  const result = await callApp(null, { headers: { 'Content-Type': 'application/json' }, body: '{"topicId": "abc",' })
  assert.equal(result.status, 400)
  assert.equal(result.body.error, invalidJsonMessage)
})

test('BUG-04: database connection failure returns 503 without stack or internal details', async () => {
  const failure = new Prisma.PrismaClientInitializationError(
    "Can't reach database server at `localhost:5432`",
    '6.19.0',
    'P1001',
  )
  const result = await callApp(failure)
  assert.equal(result.status, 503)
  assert.equal(result.body.error, databaseUnavailableMessage)
  assert.doesNotMatch(result.text, /localhost|5432|P1001|stack|at /i)
})

test('BUG-04: Prisma connection-level and pool-timeout codes are database-unavailable errors', () => {
  for (const code of ['P1001', 'P1017', 'P2024']) {
    const error = new Prisma.PrismaClientKnownRequestError('db failure', { code, clientVersion: '6.19.0' })
    assert.equal(isDatabaseUnavailableError(error), true, code)
  }
  const uniqueViolation = new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6.19.0' })
  assert.equal(isDatabaseUnavailableError(uniqueViolation), false)
})

test('unexpected errors still return a generic 500 without the error message', async () => {
  const result = await callApp(new Error('secret internal detail'))
  assert.equal(result.status, 500)
  assert.equal(result.body.error, unexpectedErrorMessage)
  assert.doesNotMatch(result.text, /secret internal detail/)
})
