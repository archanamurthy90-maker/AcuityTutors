import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import express from 'express'
import jwt from 'jsonwebtoken'
import { Prisma, type PrismaClient } from '@prisma/client'
import { cookieMiddleware, sessionCookieName } from '../src/auth.js'
import { alreadyAnsweredMessage, createGeminiRouter } from '../src/routes/gemini.js'

const questionId = 'cjld2cjxh0000qzrmn831i7rn'
const secret = 'test-secret-that-is-at-least-32-characters-long'

function fakePrisma(options: { existingAttempt: boolean; transactionError?: unknown }) {
  let transactions = 0
  const prisma = {
    student: { findUnique: async () => ({ id: 'student-1' }) },
    practiceQuestion: {
      findFirst: async () => ({
        id: questionId,
        topicId: 'topic-1',
        prompt: 'What is 2 + 2?',
        choices: ['3', '4', '5', '6'],
        correctAnswer: '4',
        explanation: 'Two plus two is four.',
        difficulty: 'BEGINNER',
        attempt: options.existingAttempt ? { id: 'attempt-1' } : null,
      }),
    },
    $transaction: async () => {
      transactions += 1
      throw options.transactionError ?? new Error('transaction should not run')
    },
  }
  return { prisma: prisma as unknown as PrismaClient, transactionCount: () => transactions }
}

async function answer(prisma: PrismaClient) {
  process.env.JWT_SECRET = secret
  const token = jwt.sign({ email: 'ava@acuity.local', role: 'STUDENT' }, secret, {
    subject: 'user-1', expiresIn: 3600, issuer: 'acuity-tutors', audience: 'acuity-tutors-web', algorithm: 'HS256',
  })
  const app = express()
  app.use(express.json())
  app.use(cookieMiddleware)
  app.use('/api', createGeminiRouter(prisma))
  const server = app.listen(0)
  try {
    const { port } = server.address() as { port: number }
    const response = await fetch(`http://127.0.0.1:${port}/api/student/practice-questions/${questionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `${sessionCookieName}=${token}` },
      body: JSON.stringify({ answer: '4' }),
    })
    return { status: response.status, body: await response.json() as { error?: string; correctAnswer?: string } }
  } finally {
    server.close()
  }
}

test('BUG-05: answering an already-answered practice question returns 409 without recording an attempt', async () => {
  const { prisma, transactionCount } = fakePrisma({ existingAttempt: true })
  const result = await answer(prisma)
  assert.equal(result.status, 409)
  assert.equal(result.body.error, alreadyAnsweredMessage)
  assert.equal(result.body.correctAnswer, undefined)
  assert.equal(transactionCount(), 0)
})

test('BUG-05: a concurrent second answer rejected by the unique constraint returns 409', async () => {
  const uniqueViolation = new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`practiceQuestionId`)', {
    code: 'P2002',
    clientVersion: '6.19.0',
    meta: { target: ['practiceQuestionId'] },
  })
  const { prisma, transactionCount } = fakePrisma({ existingAttempt: false, transactionError: uniqueViolation })
  const result = await answer(prisma)
  assert.equal(result.status, 409)
  assert.equal(result.body.error, alreadyAnsweredMessage)
  assert.equal(transactionCount(), 1)
})

test('BUG-05: the schema enforces one attempt per practice question at the database level', () => {
  const schema = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8')
  assert.match(schema, /practiceQuestionId\s+String\?\s+@unique/)
})
