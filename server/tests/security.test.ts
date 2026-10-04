import assert from 'node:assert/strict'
import test from 'node:test'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { PrismaClient } from '@prisma/client'
import { createApp } from '../src/app.js'
import { registrationPasswordSchema, sessionCookieName, studentOnlyRegistrationMessage } from '../src/auth.js'
import { logApiError } from '../src/middleware/errors.js'
import { aiLimitMessage, signInLimitMessage, signUpLimitMessage, type RateLimitSettings } from '../src/middleware/rateLimits.js'

const secret = 'test-secret-that-is-at-least-32-characters-long'
process.env.JWT_SECRET = secret
delete process.env.GEMINI_API_KEY

const ids = {
  avaUser: 'user-ava',
  avaStudent: 'cjld2cjxh0000qzrmn831ava1',
  noahStudent: 'cjld2cjxh0000qzrmn831noah',
  tutorUser: 'user-tutor',
  tutor: 'tutor-1',
  question: 'cjld2cjxh0000qzrmn831qst1',
  topic: 'cjld2cjxh0000qzrmn831top1',
}

type Call = { model: string; method: string; args: unknown }

// Minimal Prisma stand-in: Ava owns her student profile, the tutor's roster is empty,
// and the only practice question belongs to Noah. Every query is recorded.
function fakePrisma(overrides: Record<string, Record<string, (args: never) => unknown>> = {}) {
  const calls: Call[] = []
  const handlers: Record<string, Record<string, (args: never) => unknown>> = {
    student: { findUnique: (args: { where: { userId: string } }) => (args.where.userId === ids.avaUser ? { id: ids.avaStudent } : null) },
    tutor: { findUnique: (args: { where: { userId: string } }) => (args.where.userId === ids.tutorUser ? { id: ids.tutor } : null) },
    tutorStudent: { findUnique: () => null, findMany: () => [] },
    masteryScore: { findMany: () => [] },
    quizAttempt: { findMany: () => [] },
    topic: { findUnique: () => ({ id: ids.topic }) },
    practiceQuestion: {
      findFirst: (args: { where: { id: string; studentId: string } }) => (args.where.studentId === ids.noahStudent ? { id: ids.question } : null),
    },
    user: { findUnique: () => null },
    ...overrides,
  }
  const prisma = new Proxy({}, {
    get(_target, model: string) {
      if (model === '$transaction') {
        return async (callback: (transaction: unknown) => unknown) => {
          calls.push({ model: '$transaction', method: 'call', args: null })
          return callback(prisma)
        }
      }
      if (model === '$queryRaw') return async () => [{ ok: 1 }]
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

async function withApp<T>(prisma: PrismaClient, run: (request: (method: string, path: string, init?: { cookie?: string; body?: unknown; origin?: string }) => Promise<{ status: number; body: Record<string, unknown>; headers: Headers }>) => Promise<T>, rateLimits?: Partial<RateLimitSettings>) {
  const server = createApp(prisma, { rateLimits }).listen(0)
  try {
    const { port } = server.address() as { port: number }
    return await run(async (method, path, init = {}) => {
      const headers: Record<string, string> = {}
      if (init.cookie) headers.cookie = init.cookie
      if (init.origin) headers.origin = init.origin
      if (init.body !== undefined) headers['content-type'] = 'application/json'
      const response = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
      const text = await response.text()
      let body: Record<string, unknown> = {}
      try { body = JSON.parse(text) as Record<string, unknown> } catch { /* not JSON */ }
      return { status: response.status, body, headers: response.headers }
    })
  } finally {
    server.close()
  }
}

const findCalls = (calls: Call[], model: string, method: string) => calls.filter((call) => call.model === model && call.method === method)

// ---------- IDOR ----------

test('IDOR: a student mastery request is scoped to the session user, ignoring a studentId in the URL', async () => {
  const { prisma, calls } = fakePrisma()
  await withApp(prisma, async (request) => {
    const result = await request('GET', `/api/student/mastery?studentId=${ids.noahStudent}`, { cookie: avaSession })
    assert.equal(result.status, 200)
  })
  assert.deepEqual((findCalls(calls, 'student', 'findUnique')[0].args as { where: unknown }).where, { userId: ids.avaUser })
  assert.equal((findCalls(calls, 'masteryScore', 'findMany')[0].args as { where: { studentId: string } }).where.studentId, ids.avaStudent)
})

test('IDOR: a tutor cannot read progress for a student outside their roster', async () => {
  const { prisma, calls } = fakePrisma()
  await withApp(prisma, async (request) => {
    const result = await request('GET', `/api/tutor/students/${ids.noahStudent}/progress`, { cookie: tutorSession })
    assert.equal(result.status, 404)
    assert.equal(result.body.error, 'This student is not in your roster.')
    assert.equal('progress' in result.body, false)
  })
  const rosterLookup = findCalls(calls, 'tutorStudent', 'findUnique')[0].args as { where: { tutorId_studentId: { tutorId: string; studentId: string } } }
  assert.deepEqual(rosterLookup.where.tutorId_studentId, { tutorId: ids.tutor, studentId: ids.noahStudent })
  assert.equal(findCalls(calls, 'quizAttempt', 'findMany').length, 0)
})

test('IDOR: a tutor cannot generate a summary for a student outside their roster', async () => {
  const { prisma, calls } = fakePrisma()
  await withApp(prisma, async (request) => {
    const result = await request('POST', `/api/tutor/students/${ids.noahStudent}/summary`, { cookie: tutorSession })
    assert.equal(result.status, 404)
    assert.equal('summary' in result.body, false)
  })
  assert.equal(findCalls(calls, 'masteryScore', 'findMany').length, 0)
})

test("IDOR: a student cannot answer another student's practice question", async () => {
  const { prisma, calls } = fakePrisma()
  await withApp(prisma, async (request) => {
    const result = await request('POST', `/api/student/practice-questions/${ids.question}/answer`, { cookie: avaSession, body: { answer: 'A' } })
    assert.equal(result.status, 404)
    assert.equal('correctAnswer' in result.body, false)
  })
  const lookup = findCalls(calls, 'practiceQuestion', 'findFirst')[0].args as { where: { id: string; studentId: string } }
  assert.deepEqual(lookup.where, { id: ids.question, studentId: ids.avaStudent })
  assert.equal(findCalls(calls, '$transaction', 'call').length, 0)
})

test('IDOR: a studentId in the attempt body is ignored; the attempt is saved for the session student', async () => {
  const { prisma, calls } = fakePrisma({
    quizAttempt: { create: () => ({ id: 'attempt-1' }), findMany: () => [{ isCorrect: true }] },
    masteryScore: { findMany: () => [], deleteMany: () => ({}), upsert: () => ({}) },
  })
  await withApp(prisma, async (request) => {
    const result = await request('POST', '/api/student/attempts', { cookie: avaSession, body: { topicId: ids.topic, isCorrect: true, studentId: ids.noahStudent } })
    assert.equal(result.status, 201)
  })
  const created = findCalls(calls, 'quizAttempt', 'create')[0].args as { data: { studentId: string } }
  assert.equal(created.data.studentId, ids.avaStudent)
})

test('role checks: students cannot call tutor routes and tutors cannot call student routes', async () => {
  const { prisma } = fakePrisma()
  await withApp(prisma, async (request) => {
    assert.equal((await request('GET', '/api/tutor/mastery', { cookie: avaSession })).status, 403)
    assert.equal((await request('GET', `/api/tutor/students/${ids.avaStudent}/progress`, { cookie: avaSession })).status, 403)
    assert.equal((await request('GET', '/api/student/mastery', { cookie: tutorSession })).status, 403)
    assert.equal((await request('GET', '/api/student/mastery')).status, 401)
  })
})

// ---------- Registration ----------

function registrationPrisma() {
  return fakePrisma({
    user: {
      findUnique: () => null,
      create: (args: { data: { email: string; role: string } }) => ({ id: 'new-user', ...args.data }),
      findUniqueOrThrow: () => ({ id: 'new-user', email: 'new@example.com', role: 'STUDENT', student: { displayName: 'New Student' }, tutor: null }),
    },
    student: { create: () => ({ id: 'new-student' }), findUnique: () => null },
    tutor: { create: () => ({ id: 'new-tutor' }), findUnique: () => null },
  })
}
const newAccount = { displayName: 'New Student', email: 'new@example.com', password: 'Student2026' }

test('SEC3: public registration as a tutor is rejected with 403 and creates nothing', async () => {
  const { prisma, calls } = registrationPrisma()
  await withApp(prisma, async (request) => {
    const result = await request('POST', '/api/auth/register', { body: { ...newAccount, role: 'TUTOR' } })
    assert.equal(result.status, 403)
    assert.equal(result.body.error, studentOnlyRegistrationMessage)
  })
  assert.equal(calls.length, 0)
})

test('SEC3: registration without a role (or as STUDENT) creates a student account only', async () => {
  for (const extra of [{}, { role: 'STUDENT' }]) {
    const { prisma, calls } = registrationPrisma()
    await withApp(prisma, async (request) => {
      const result = await request('POST', '/api/auth/register', { body: { ...newAccount, ...extra } })
      assert.equal(result.status, 201)
    })
    assert.equal((findCalls(calls, 'user', 'create')[0].args as { data: { role: string } }).data.role, 'STUDENT')
    assert.equal(findCalls(calls, 'student', 'create').length, 1)
    assert.equal(findCalls(calls, 'tutor', 'create').length, 0)
  }
})

test('passwords longer than bcrypt\'s 72-byte input are rejected at registration', () => {
  assert.equal(registrationPasswordSchema.safeParse(`a1${'x'.repeat(70)}`).success, true)
  assert.equal(registrationPasswordSchema.safeParse(`a1${'x'.repeat(71)}`).success, false)
  assert.equal(registrationPasswordSchema.safeParse(`a1${'🙂'.repeat(18)}`).success, false) // 2 + 72 bytes
})

test('session tokens carry only the user id and role, not the email', async () => {
  const passwordHash = await bcrypt.hash('StudentDemo!2026', 4)
  const { prisma } = fakePrisma({
    user: { findUnique: () => ({ id: ids.avaUser, email: 'ava@acuity.local', role: 'STUDENT', passwordHash, student: { displayName: 'Ava' }, tutor: null }) },
  })
  await withApp(prisma, async (request) => {
    const result = await request('POST', '/api/auth/login', { body: { email: 'ava@acuity.local', password: 'StudentDemo!2026' } })
    assert.equal(result.status, 200)
    const token = /acuity_session=([^;]+)/.exec(result.headers.get('set-cookie') ?? '')?.[1] ?? ''
    const claims = jwt.decode(token) as Record<string, unknown>
    assert.equal(claims.sub, ids.avaUser)
    assert.equal(claims.role, 'STUDENT')
    assert.equal('email' in claims, false)
  })
})

// ---------- Rate limiting ----------

test('SEC2: repeated failed sign-ins for one account return 429 with a friendly message', async () => {
  const passwordHash = await bcrypt.hash('StudentDemo!2026', 4)
  const { prisma } = fakePrisma({
    user: { findUnique: (args: { where: { email: string } }) => (args.where.email === 'ava@acuity.local' ? { id: ids.avaUser, email: 'ava@acuity.local', role: 'STUDENT', passwordHash, student: { displayName: 'Ava' }, tutor: null } : null) },
  })
  await withApp(prisma, async (request) => {
    const good = { email: 'ava@acuity.local', password: 'StudentDemo!2026' }
    const bad = { email: 'ava@acuity.local', password: 'WrongPass1' }
    // Successful sign-ins do not count toward the limit.
    for (let index = 0; index < 4; index += 1) assert.equal((await request('POST', '/api/auth/login', { body: good })).status, 200)
    for (let index = 0; index < 3; index += 1) assert.equal((await request('POST', '/api/auth/login', { body: bad })).status, 401)
    const limited = await request('POST', '/api/auth/login', { body: bad })
    assert.equal(limited.status, 429)
    assert.equal(limited.body.error, signInLimitMessage)
    assert.ok(limited.headers.get('retry-after'))
    // A different account from the same address is not blocked by the per-account limit.
    assert.equal((await request('POST', '/api/auth/login', { body: { email: 'other@example.com', password: 'WrongPass1' } })).status, 401)
  }, { loginFailuresPerAccount: 3 })
})

test('SEC2: the per-address sign-in limit stops attempts spread across many emails', async () => {
  const { prisma } = fakePrisma()
  await withApp(prisma, async (request) => {
    for (let index = 0; index < 5; index += 1) {
      assert.equal((await request('POST', '/api/auth/login', { body: { email: `user${index}@example.com`, password: 'WrongPass1' } })).status, 401)
    }
    assert.equal((await request('POST', '/api/auth/login', { body: { email: 'user9@example.com', password: 'WrongPass1' } })).status, 429)
  }, { loginFailuresPerIp: 5 })
})

test('SEC2: account creation is limited per address', async () => {
  const { prisma } = registrationPrisma()
  await withApp(prisma, async (request) => {
    assert.equal((await request('POST', '/api/auth/register', { body: newAccount })).status, 201)
    assert.equal((await request('POST', '/api/auth/register', { body: newAccount })).status, 201)
    const limited = await request('POST', '/api/auth/register', { body: newAccount })
    assert.equal(limited.status, 429)
    assert.equal(limited.body.error, signUpLimitMessage)
  }, { registrationsPerIp: 2 })
})

test('SEC2: AI practice and summary requests are limited per user', async () => {
  // Profiles resolve to "not found" so no Gemini call is made; responses still count.
  const { prisma } = fakePrisma({ student: { findUnique: () => null }, tutor: { findUnique: () => null } })
  await withApp(prisma, async (request) => {
    for (let index = 0; index < 2; index += 1) assert.equal((await request('POST', '/api/student/practice-questions', { cookie: avaSession })).status, 404)
    const limited = await request('POST', '/api/student/practice-questions', { cookie: avaSession })
    assert.equal(limited.status, 429)
    assert.equal(limited.body.error, aiLimitMessage)
    // Another student has their own allowance.
    assert.equal((await request('POST', '/api/student/practice-questions', { cookie: session('user-other', 'STUDENT') })).status, 404)

    for (let index = 0; index < 2; index += 1) assert.equal((await request('POST', `/api/tutor/students/${ids.avaStudent}/summary`, { cookie: tutorSession })).status, 404)
    assert.equal((await request('POST', `/api/tutor/students/${ids.avaStudent}/summary`, { cookie: tutorSession })).status, 429)
  }, { practiceQuestionsPerUser: 2, summariesPerUser: 2 })
})

// ---------- Headers, CORS, health ----------

test('SEC4: responses carry helmet security headers with a strict Content-Security-Policy', async () => {
  const { prisma } = fakePrisma()
  await withApp(prisma, async (request) => {
    const result = await request('GET', '/api/health')
    const csp = result.headers.get('content-security-policy') ?? ''
    for (const directive of ["default-src 'self'", "script-src 'self'", "style-src 'self'", "connect-src 'self'", "object-src 'none'", "frame-ancestors 'none'"]) {
      assert.ok(csp.includes(directive), `CSP missing ${directive}: ${csp}`)
    }
    assert.equal(csp.includes('unsafe-inline'), false)
    assert.equal(result.headers.get('x-content-type-options'), 'nosniff')
    assert.ok(result.headers.get('strict-transport-security'))
    assert.equal(result.headers.get('x-powered-by'), null)
  })
})

test('CORS: only the configured client origin is allowed, and cross-origin writes are rejected', async () => {
  process.env.CLIENT_ORIGIN = 'https://tutors.example.com'
  const { prisma } = fakePrisma()
  try {
    await withApp(prisma, async (request) => {
      const allowed = await request('GET', '/api/health', { origin: 'https://tutors.example.com' })
      assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://tutors.example.com')
      assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true')

      const foreign = await request('GET', '/api/health', { origin: 'https://evil.example' })
      assert.equal(foreign.headers.get('access-control-allow-origin'), null)

      const foreignWrite = await request('POST', '/api/auth/login', { origin: 'https://evil.example', body: { email: 'ava@acuity.local', password: 'x' } })
      assert.equal(foreignWrite.status, 403)
    })
  } finally {
    delete process.env.CLIENT_ORIGIN
  }
})

test('health returns only {status:"ok"} in production and details in development', async () => {
  const { prisma } = fakePrisma()
  const previous = process.env.NODE_ENV
  try {
    process.env.NODE_ENV = 'production'
    await withApp(prisma, async (request) => {
      assert.deepEqual((await request('GET', '/api/health')).body, { status: 'ok' })
    })
    process.env.NODE_ENV = 'development'
    await withApp(prisma, async (request) => {
      assert.deepEqual(Object.keys((await request('GET', '/api/health')).body).sort(), ['databaseConfigured', 'databaseConnected', 'geminiConfigured', 'status'])
    })
  } finally {
    process.env.NODE_ENV = previous
  }
})

test('production error logs omit messages that could contain personal data', () => {
  const previous = process.env.NODE_ENV
  const originalError = console.error
  const lines: string[] = []
  console.error = (...args: unknown[]) => { lines.push(args.map(String).join(' ')) }
  try {
    process.env.NODE_ENV = 'production'
    const failure = Object.assign(new Error('Unique constraint failed for email ava@acuity.local'), { code: 'P2002' })
    logApiError('Unhandled API error:', failure, { method: 'POST', path: '/api/auth/register', route: undefined } as never)
  } finally {
    console.error = originalError
    process.env.NODE_ENV = previous
  }
  assert.equal(lines.length, 1)
  assert.doesNotMatch(lines[0], /ava@acuity\.local|Unique constraint/)
  assert.match(lines[0], /P2002/)
})
