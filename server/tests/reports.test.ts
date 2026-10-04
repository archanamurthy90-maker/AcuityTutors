import assert from 'node:assert/strict'
import test from 'node:test'
import jwt from 'jsonwebtoken'
import { Prisma, type PrismaClient } from '@prisma/client'
import { createApp } from '../src/app.js'
import { sessionCookieName } from '../src/auth.js'
import { alreadyReportedMessage } from '../src/routes/reports.js'

const secret = 'test-secret-that-is-at-least-32-characters-long'
process.env.JWT_SECRET = secret

const ids = {
  avaUser: 'user-ava',
  avaStudent: 'cjld2cjxh0000qzrmn831ava1',
  noahStudent: 'cjld2cjxh0000qzrmn831noah',
  tutorUser: 'user-tutor',
  tutor: 'tutor-1',
  avaQuestion: 'cjld2cjxh0000qzrmn831qava',
  noahQuestion: 'cjld2cjxh0000qzrmn831qnoa',
}
const questionOwners: Record<string, string> = { [ids.avaQuestion]: ids.avaStudent, [ids.noahQuestion]: ids.noahStudent }

type Call = { model: string; method: string; args: unknown }

function fakePrisma(options: { existingReport?: boolean; createError?: unknown } = {}) {
  const calls: Call[] = []
  const handlers: Record<string, Record<string, (args: never) => unknown>> = {
    student: { findUnique: (args: { where: { userId: string } }) => (args.where.userId === ids.avaUser ? { id: ids.avaStudent } : null) },
    tutor: { findUnique: (args: { where: { userId: string } }) => (args.where.userId === ids.tutorUser ? { id: ids.tutor } : null) },
    // Mirrors the real ownership filter: a question is found only with its owner's studentId.
    practiceQuestion: {
      findFirst: (args: { where: { id: string; studentId: string } }) => (questionOwners[args.where.id] === args.where.studentId
        ? { id: args.where.id, report: options.existingReport ? { id: 'report-0' } : null }
        : null),
    },
    questionReport: {
      create: () => {
        if (options.createError) throw options.createError
        return { id: 'report-1', createdAt: new Date('2026-10-04T12:00:00Z') }
      },
      findMany: () => [],
    },
  }
  const prisma = new Proxy({}, {
    get(_target, model: string) {
      return new Proxy({}, {
        get(_inner, method: string) {
          return async (args: never) => {
            calls.push({ model, method, args })
            const handler = handlers[model]?.[method]
            if (!handler) throw new Error(`Unexpected prisma.${model}.${method}`)
            return handler(args)
          }
        },
      })
    },
  })
  return { prisma: prisma as unknown as PrismaClient, calls }
}

function session(userId: string, role: 'STUDENT' | 'TUTOR') {
  const token = jwt.sign({ role }, secret, { subject: userId, expiresIn: 3600, issuer: 'acuity-tutors', audience: 'acuity-tutors-web', algorithm: 'HS256' })
  return `${sessionCookieName}=${token}`
}
const avaSession = session(ids.avaUser, 'STUDENT')
const tutorSession = session(ids.tutorUser, 'TUTOR')

async function call(prisma: PrismaClient, method: string, path: string, cookie: string, body?: unknown) {
  const server = createApp(prisma).listen(0)
  try {
    const { port } = server.address() as { port: number }
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    })
    return { status: response.status, body: await response.json() as Record<string, unknown> }
  } finally {
    server.close()
  }
}
const reportPath = (questionId: string) => `/api/student/practice-questions/${questionId}/report`
const creates = (calls: Call[]) => calls.filter((entry) => entry.model === 'questionReport' && entry.method === 'create')

test('RAI-03: a student can report their own question with a trimmed reason', async () => {
  const { prisma, calls } = fakePrisma()
  const result = await call(prisma, 'POST', reportPath(ids.avaQuestion), avaSession, { reason: '  The answer key looks wrong.\u0007  ' })
  assert.equal(result.status, 201)
  const data = (creates(calls)[0].args as { data: { practiceQuestionId: string; studentId: string; reason: string | null } }).data
  assert.deepEqual(data, { practiceQuestionId: ids.avaQuestion, studentId: ids.avaStudent, reason: 'The answer key looks wrong.' })
})

test('RAI-03: the reason is optional; empty or missing reasons are stored as null', async () => {
  for (const body of [{}, { reason: '   ' }, undefined]) {
    const { prisma, calls } = fakePrisma()
    const result = await call(prisma, 'POST', reportPath(ids.avaQuestion), avaSession, body)
    assert.equal(result.status, 201)
    assert.equal((creates(calls)[0].args as { data: { reason: string | null } }).data.reason, null)
  }
})

test("RAI-03: a student cannot report another student's question", async () => {
  const { prisma, calls } = fakePrisma()
  const result = await call(prisma, 'POST', reportPath(ids.noahQuestion), avaSession, { reason: 'not mine' })
  assert.equal(result.status, 404)
  assert.equal(result.body.error, 'Practice question not found.')
  const lookup = calls.find((entry) => entry.model === 'practiceQuestion')?.args as { where: { id: string; studentId: string } }
  assert.deepEqual(lookup.where, { id: ids.noahQuestion, studentId: ids.avaStudent })
  assert.equal(creates(calls).length, 0)
})

test('RAI-03: reasons over 300 characters, non-text reasons, and unknown fields are rejected', async () => {
  for (const body of [{ reason: 'x'.repeat(301) }, { reason: 42 }, { reason: 'ok', studentId: ids.noahStudent }]) {
    const { prisma, calls } = fakePrisma()
    const result = await call(prisma, 'POST', reportPath(ids.avaQuestion), avaSession, body)
    assert.equal(result.status, 400, JSON.stringify(body))
    assert.equal(creates(calls).length, 0)
  }
  const { prisma } = fakePrisma()
  assert.equal((await call(prisma, 'POST', reportPath(ids.avaQuestion), avaSession, { reason: 'x'.repeat(300) })).status, 201)
})

test('RAI-03: invalid question IDs return 400', async () => {
  const { prisma, calls } = fakePrisma()
  assert.equal((await call(prisma, 'POST', reportPath('-1'), avaSession, {})).status, 400)
  assert.equal(calls.length, 0)
})

test('RAI-03: a question can be reported once (existing report or concurrent duplicate → 409)', async () => {
  const existing = fakePrisma({ existingReport: true })
  const first = await call(existing.prisma, 'POST', reportPath(ids.avaQuestion), avaSession, {})
  assert.equal(first.status, 409)
  assert.equal(first.body.error, alreadyReportedMessage)
  assert.equal(creates(existing.calls).length, 0)

  const race = fakePrisma({ createError: new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6.19.0' }) })
  const second = await call(race.prisma, 'POST', reportPath(ids.avaQuestion), avaSession, {})
  assert.equal(second.status, 409)
})

test('RAI-03: only students can report, and only tutors can list reports', async () => {
  const { prisma } = fakePrisma()
  assert.equal((await call(prisma, 'POST', reportPath(ids.avaQuestion), tutorSession, {})).status, 403)
  assert.equal((await call(prisma, 'GET', '/api/tutor/question-reports', avaSession)).status, 403)
  assert.equal((await call(prisma, 'GET', '/api/tutor/question-reports', '')).status, 401)
})

test("RAI-03: tutors see reports only from their own roster's students", async () => {
  const { prisma, calls } = fakePrisma()
  const result = await call(prisma, 'GET', '/api/tutor/question-reports', tutorSession)
  assert.equal(result.status, 200)
  const query = calls.find((entry) => entry.model === 'questionReport' && entry.method === 'findMany')?.args as { where: unknown; take: number }
  assert.deepEqual(query.where, { student: { tutorLinks: { some: { tutorId: ids.tutor } } } })
  assert.equal(query.take, 50)
})
