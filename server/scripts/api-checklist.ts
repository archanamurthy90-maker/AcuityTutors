// Runs the API-level cases from docs/TEST_CHECKLIST.md against a running API.
// Usage (API running, e.g. `npm run dev`): npm run test:api --workspace=server
// Optional: API_URL=http://localhost:3001  SKIP_GEMINI=1 (skips cases that call Gemini)
// Creates temporary accounts under a unique qa-<timestamp> email prefix and deletes them at the end.
// Practice answers are recorded for ava@acuity.local; run `npm run db:seed` afterwards to restore the baseline.
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const serverDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: resolve(serverDirectory, '.env'), quiet: true })

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
const skipGemini = process.env.SKIP_GEMINI === '1'
const runTag = `qa-${Date.now()}`
const prisma = new PrismaClient()

type ApiResult = { status: number; body: Record<string, unknown>; text: string; headers: Headers }
type CaseResult = { id: string; result: 'PASS' | 'FAIL' | 'SKIP'; note: string }
const results: CaseResult[] = []

async function api(method: string, path: string, options: { cookie?: string; body?: unknown; raw?: string } = {}): Promise<ApiResult> {
  const headers: Record<string, string> = {}
  if (options.cookie) headers.cookie = options.cookie
  if (options.body !== undefined || options.raw !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers,
    body: options.raw ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
  })
  const text = await response.text()
  let body: Record<string, unknown> = {}
  try { body = JSON.parse(text) as Record<string, unknown> } catch { /* non-JSON body */ }
  return { status: response.status, body, text, headers: response.headers }
}

function sessionCookie(result: ApiResult) {
  const match = /acuity_session=([^;]*)/.exec(result.headers.get('set-cookie') ?? '')
  return match?.[1] ? `acuity_session=${match[1]}` : ''
}

async function login(email: string, password: string) {
  const result = await api('POST', '/api/auth/login', { body: { email, password } })
  if (result.status !== 200) throw new Error(`Login failed for ${email}: ${result.status}`)
  return sessionCookie(result)
}

let accountCounter = 0
function testEmail() {
  accountCounter += 1
  return `${runTag}-${accountCounter}@example.com`
}

async function register(fields: { displayName?: string; email?: string; password?: string; role?: string }) {
  return api('POST', '/api/auth/register', {
    body: { displayName: 'QA Student', email: testEmail(), password: 'QaCheck2026', role: 'STUDENT', ...fields },
  })
}

async function check(id: string, run: () => Promise<{ pass: boolean; note: string }>) {
  try {
    const { pass, note } = await run()
    results.push({ id, result: pass ? 'PASS' : 'FAIL', note })
  } catch (error) {
    results.push({ id, result: 'FAIL', note: `Error: ${error instanceof Error ? error.message : String(error)}` })
  }
}

const describe = (result: ApiResult) => `${result.status} ${JSON.stringify(result.body.error ?? result.body.code ?? '')}`
const fakeCuid = 'cjld2cjxh0000qzrmn831i7rn'

async function main() {
  const health = await api('GET', '/api/health')
  if (health.status !== 200) throw new Error(`API not reachable at ${apiUrl}`)

  const tutorCookie = await login('tutor@acuity.local', 'TutorDemo!2026')
  const avaCookie = await login('ava@acuity.local', 'StudentDemo!2026')
  const ava = await prisma.student.findFirstOrThrow({ where: { user: { email: 'ava@acuity.local' } }, select: { id: true } })
  const avaTopic = await prisma.masteryScore.findFirstOrThrow({ where: { studentId: ava.id }, select: { topicId: true } })
  const attemptCount = () => prisma.quizAttempt.count({ where: { studentId: ava.id } })

  // Setup and health
  await check('S3', async () => ({
    pass: health.body.status === 'ok' && health.body.databaseConnected === true && health.body.geminiConfigured === true,
    note: JSON.stringify(health.body),
  }))
  await check('SEC1', async () => {
    const keys = Object.keys(health.body).sort().join(',')
    const onlyBooleans = Object.entries(health.body).every(([key, value]) => key === 'status' || typeof value === 'boolean')
    return { pass: keys === 'databaseConfigured,databaseConnected,geminiConfigured,status' && onlyBooleans, note: `keys: ${keys}` }
  })

  // Access control
  await check('A3', async () => {
    const result = await api('GET', '/api/student/mastery')
    return { pass: result.status === 401 && !('scores' in result.body), note: describe(result) }
  })
  await check('X16', async () => {
    const me = await api('GET', '/api/auth/me')
    const session = await login('ava@acuity.local', 'StudentDemo!2026')
    const logout = await api('POST', '/api/auth/logout', { cookie: session })
    const cleared = /acuity_session=;/.test(logout.headers.get('set-cookie') ?? '')
    return { pass: me.status === 401 && me.body.code === 'AUTH_REQUIRED' && logout.status === 204 && cleared, note: `/me ${describe(me)}; logout ${logout.status}, cookie cleared: ${cleared}` }
  })
  await check('X17', async () => {
    const tutorAsStudent = await api('GET', '/api/student/mastery', { cookie: tutorCookie })
    const studentAsTutor = await api('GET', '/api/tutor/mastery', { cookie: avaCookie })
    return { pass: tutorAsStudent.status === 403 && studentAsTutor.status === 403, note: `tutor→student ${describe(tutorAsStudent)}; student→tutor ${describe(studentAsTutor)}` }
  })
  await check('X9', async () => {
    const outsider = await register({ displayName: 'QA Outsider' })
    const outsiderStudent = await prisma.student.findFirstOrThrow({ where: { user: { email: (outsider.body.user as { email: string }).email } } })
    const result = await api('GET', `/api/tutor/students/${outsiderStudent.id}/progress`, { cookie: tutorCookie })
    return { pass: result.status === 404 && !('progress' in result.body), note: describe(result) }
  })
  await check('X10', async () => {
    const result = await api('POST', `/api/tutor/students/${ava.id}/summary`, { cookie: avaCookie })
    return { pass: result.status === 403 && !('summary' in result.body), note: describe(result) }
  })
  await check('X18', async () => {
    const result = await api('GET', '/api/does-not-exist')
    return { pass: result.status === 404 && result.body.error === 'API route not found', note: describe(result) }
  })

  // Log an attempt API
  await check('X6', async () => {
    const result = await api('POST', '/api/student/attempts', { cookie: avaCookie, body: { topicId: 'x', isCorrect: 'yes' } })
    const fields = ((result.body.details ?? []) as Array<{ field: string }>).map((detail) => detail.field)
    return { pass: result.status === 400 && fields.includes('topicId') && fields.includes('isCorrect'), note: `${describe(result)}; fields: ${fields.join(', ')}` }
  })
  await check('X7', async () => {
    const before = await attemptCount()
    const result = await api('POST', '/api/student/attempts', { cookie: avaCookie, body: { topicId: fakeCuid, isCorrect: true } })
    const after = await attemptCount()
    return { pass: result.status === 404 && result.body.error === 'Topic not found.' && before === after, note: `${describe(result)}; attempts ${before}→${after}` }
  })
  await check('W5', async () => {
    const result = await api('POST', '/api/student/attempts', { cookie: avaCookie, body: { topicId: avaTopic.topicId, isCorrect: true, response: 'x'.repeat(2000) } })
    return { pass: result.status === 400, note: describe(result) }
  })
  await check('W16', async () => {
    const before = await attemptCount()
    const result = await api('POST', '/api/student/attempts', { cookie: avaCookie, body: { topicId: "' OR 1=1 --", isCorrect: true } })
    const after = await attemptCount()
    return { pass: result.status === 400 && before === after, note: `${describe(result)}; attempts ${before}→${after}` }
  })

  // Registration and login input
  await check('W1', async () => {
    const result = await register({ displayName: 'A'.repeat(81) })
    const details = JSON.stringify(result.body.details ?? '')
    return { pass: result.status === 400 && details.includes('Use 80 characters or fewer.'), note: `${describe(result)}; ${details}` }
  })
  await check('W2', async () => {
    const longEmail = `${'a'.repeat(290)}@example.com`
    const registration = await register({ email: longEmail })
    const loginResult = await api('POST', '/api/auth/login', { body: { email: longEmail, password: 'QaCheck2026' } })
    return { pass: registration.status === 400 && loginResult.status === 400, note: `register ${registration.status}, login ${loginResult.status}` }
  })
  await check('W3', async () => {
    const result = await register({ password: `A1${'x'.repeat(127)}` })
    return { pass: result.status === 400, note: `129-char password: ${describe(result)}` }
  })
  await check('W6', async () => {
    const result = await register({ displayName: 'Ava 🚀📚' })
    const me = await api('GET', '/api/auth/me', { cookie: sessionCookie(result) })
    const name = (me.body.user as { displayName?: string } | undefined)?.displayName
    return { pass: result.status === 201 && name === 'Ava 🚀📚', note: `register ${result.status}; /me displayName ${JSON.stringify(name)} (header display needs browser)` }
  })
  await check('W7', async () => {
    const result = await register({ email: `${runTag}🙂@example.com` })
    return { pass: result.status === 400, note: describe(result) }
  })
  await check('W8', async () => {
    const email = testEmail()
    const registration = await register({ email, password: 'Passw0rd🙂' })
    const loginResult = await api('POST', '/api/auth/login', { body: { email, password: 'Passw0rd🙂' } })
    return { pass: registration.status === 201 && loginResult.status === 200, note: `register ${registration.status}, login ${loginResult.status}` }
  })
  await check('W9', async () => {
    const result = await register({ displayName: '     ' })
    return { pass: result.status === 400, note: describe(result) }
  })
  await check('W10', async () => {
    const result = await api('POST', '/api/auth/login', { body: { email: '   ', password: 'anything' } })
    return { pass: result.status === 400, note: describe(result) }
  })
  await check('W11', async () => {
    const registration = await register({ password: '        ' })
    const loginResult = await api('POST', '/api/auth/login', { body: { email: 'ava@acuity.local', password: '        ' } })
    return {
      pass: registration.status === 400 && loginResult.status === 401 && loginResult.body.error === 'Email or password is incorrect.',
      note: `register ${describe(registration)}; login ${describe(loginResult)}`,
    }
  })
  await check('W12', async () => {
    const result = await register({ displayName: '  Ava Test  ' })
    const name = (result.body.user as { displayName?: string } | undefined)?.displayName
    return { pass: result.status === 201 && name === 'Ava Test', note: `stored ${JSON.stringify(name)}` }
  })
  await check('W13', async () => {
    const result = await api('POST', '/api/auth/login', { body: { email: "' OR 1=1 --", password: 'anything' } })
    return { pass: result.status === 400 && !sessionCookie(result), note: describe(result) }
  })
  await check('W14', async () => {
    const result = await api('POST', '/api/auth/login', { body: { email: 'ava@acuity.local', password: "' OR 1=1 --" } })
    return { pass: result.status === 401 && result.body.error === 'Email or password is incorrect.' && !sessionCookie(result), note: describe(result) }
  })
  await check('W15', async () => {
    const usersBefore = await prisma.user.count()
    const result = await register({ displayName: "' OR 1=1 --" })
    const usersAfter = await prisma.user.count()
    const name = (result.body.user as { displayName?: string } | undefined)?.displayName
    return { pass: result.status === 201 && name === "' OR 1=1 --" && usersAfter === usersBefore + 1, note: `stored literally: ${name === "' OR 1=1 --"}; users ${usersBefore}→${usersAfter}` }
  })
  await check('W17', async () => {
    const result = await register({ displayName: '<script>alert(1)</script>' })
    const name = (result.body.user as { displayName?: string } | undefined)?.displayName
    const isJson = (result.headers.get('content-type') ?? '').includes('application/json')
    return { pass: result.status === 201 && name === '<script>alert(1)</script>' && isJson, note: `stored literally, JSON response: ${isJson} (rendering needs browser)` }
  })
  await check('W19', async () => {
    const result = await api('POST', '/api/auth/login', { body: { email: '<script>alert(1)</script>@x.com', password: 'anything' } })
    return { pass: result.status === 400, note: describe(result) }
  })

  // URL IDs
  await check('W21', async () => {
    const result = await api('GET', '/api/tutor/students/-1/progress', { cookie: tutorCookie })
    return { pass: result.status === 400 && result.body.error === 'Student identifier is not valid.', note: describe(result) }
  })
  await check('W22', async () => {
    const progress = await api('GET', '/api/tutor/students/abc/progress', { cookie: tutorCookie })
    const summary = await api('POST', '/api/tutor/students/123/summary', { cookie: tutorCookie })
    return { pass: progress.status === 400 && summary.status === 400, note: `progress ${describe(progress)}; summary ${describe(summary)}` }
  })
  await check('W23', async () => {
    const result = await api('POST', '/api/student/practice-questions/-1/answer', { cookie: avaCookie, body: { answer: 'A' } })
    return { pass: result.status === 400 && result.body.error === 'This practice question is not valid.', note: describe(result) }
  })
  await check('W26', async () => {
    const result = await api('GET', "/api/tutor/students/abc'%20OR%201=1--/progress", { cookie: tutorCookie })
    return { pass: result.status === 400, note: describe(result) }
  })

  // Session expiry and body errors (BUG-01, BUG-04)
  const secret = process.env.JWT_SECRET ?? ''
  const token = (expiresIn: number, signingSecret = secret) => jwt.sign({ email: 'ava@acuity.local', role: 'STUDENT' }, signingSecret, {
    subject: 'qa-user', expiresIn, issuer: 'acuity-tutors', audience: 'acuity-tutors-web', algorithm: 'HS256',
  })
  await check('B2', async () => {
    const result = await api('GET', '/api/auth/me', { cookie: `acuity_session=${token(-60)}` })
    const cleared = /acuity_session=;/.test(result.headers.get('set-cookie') ?? '')
    return { pass: result.status === 401 && result.body.code === 'SESSION_EXPIRED' && cleared, note: `${describe(result)}; cookie cleared: ${cleared}` }
  })
  await check('B3', async () => {
    const valid = avaCookie.split('=')[1]
    const tampered = valid.slice(0, -2) + (valid.endsWith('AA') ? 'BB' : 'AA')
    const result = await api('GET', '/api/auth/me', { cookie: `acuity_session=${tampered}` })
    return { pass: result.status === 401 && result.body.code === 'SESSION_INVALID', note: `${describe(result)} (sign-in page display needs browser)` }
  })
  await check('B12', async () => {
    const result = await api('POST', '/api/auth/login', { raw: '{bad' })
    return { pass: result.status === 400 && result.body.error === 'The request body is not valid JSON. Check the data and try again.', note: describe(result) }
  })
  await check('B14', async () => {
    const result = await api('POST', '/api/auth/login', { raw: JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(1_100_000) }) })
    return { pass: result.status === 413 && result.body.error === 'The request body is too large.', note: describe(result) }
  })

  // Deferred security checks (recorded, fixed in a later phase)
  await check('SEC3', async () => {
    const result = await register({ role: 'TUTOR', displayName: 'QA Tutor' })
    return { pass: result.status !== 201, note: `self-registered tutor: ${result.status}` }
  })
  await check('SEC4', async () => {
    const result = await api('GET', '/api/health')
    const present = ['x-content-type-options', 'content-security-policy', 'x-frame-options'].filter((name) => result.headers.has(name))
    const poweredBy = result.headers.has('x-powered-by')
    return { pass: present.length === 3 && !poweredBy, note: `security headers present: [${present.join(', ')}]; x-powered-by present: ${poweredBy}` }
  })
  await check('SEC2', async () => {
    const statuses: number[] = []
    for (let index = 0; index < 20; index += 1) {
      statuses.push((await api('POST', '/api/auth/login', { body: { email: 'ava@acuity.local', password: `Wrong${index}!` } })).status)
    }
    return { pass: statuses.includes(429), note: `20 wrong logins → ${[...new Set(statuses)].join('/')}` }
  })

  // Practice questions (Gemini)
  if (skipGemini) {
    for (const id of ['X11', 'X12', 'W4', 'W20', 'W24', 'W31']) results.push({ id, result: 'SKIP', note: 'SKIP_GEMINI=1' })
    return
  }
  const generate = (cookie: string) => api('POST', '/api/student/practice-questions', { cookie })
  const answerQuestion = (id: string, answer: string, cookie = avaCookie) => api('POST', `/api/student/practice-questions/${id}/answer`, { cookie, body: { answer } })

  const first = await generate(avaCookie)
  const question = first.body.practiceQuestion as { id: string; options: string[] } | undefined
  await check('X11', async () => {
    const keys = Object.keys(question ?? {}).sort().join(',')
    return { pass: first.status === 201 && Boolean(question) && !keys.includes('correctAnswer') && !keys.includes('explanation'), note: `${first.status}; keys: ${keys}` }
  })
  if (!question) throw new Error(`Question generation failed: ${describe(first)}`)
  const linkedAttempts = (id: string) => prisma.quizAttempt.count({ where: { practiceQuestionId: id } })

  await check('X12', async () => {
    const result = await answerQuestion(question.id, 'not an option')
    return { pass: result.status === 400 && result.body.error === 'Choose one of the four options shown for this question.' && await linkedAttempts(question.id) === 0, note: describe(result) }
  })
  await check('W4', async () => {
    const result = await answerQuestion(question.id, 'x'.repeat(5000))
    return { pass: result.status === 400, note: describe(result) }
  })
  await check('W20', async () => {
    const result = await answerQuestion(question.id, '<script>alert(1)</script>')
    return { pass: result.status === 400 && result.body.error === 'Choose one of the four options shown for this question.', note: describe(result) }
  })
  await check('W31', async () => {
    const firstAnswer = await answerQuestion(question.id, question.options[0])
    const secondAnswer = await answerQuestion(question.id, question.options[1])
    const sequentialRows = await linkedAttempts(question.id)

    const concurrent = (await generate(avaCookie)).body.practiceQuestion as { id: string; options: string[] }
    const racing = await Promise.all([answerQuestion(concurrent.id, concurrent.options[0]), answerQuestion(concurrent.id, concurrent.options[1])])
    const racingStatuses = racing.map((result) => result.status).sort()
    const racingRows = await linkedAttempts(concurrent.id)
    const conflict = racing.find((result) => result.status === 409)

    return {
      pass: firstAnswer.status === 201 && secondAnswer.status === 409 && secondAnswer.body.error === 'This question has already been answered.'
        && sequentialRows === 1 && racingStatuses.join(',') === '201,409' && racingRows === 1 && conflict?.body.error === 'This question has already been answered.',
      note: `sequential: ${firstAnswer.status} then ${describe(secondAnswer)}, rows ${sequentialRows}; concurrent: ${racingStatuses.join('+')}, rows ${racingRows}`,
    }
  })
  await check('W24', async () => {
    const noahCookie = await login('noah@acuity.local', 'StudentDemo!2026')
    const noahQuestion = (await generate(noahCookie)).body.practiceQuestion as { id: string; options: string[] }
    const result = await answerQuestion(noahQuestion.id, noahQuestion.options[0], avaCookie)
    return { pass: result.status === 404 && result.body.error === 'Practice question not found.' && await linkedAttempts(noahQuestion.id) === 0, note: describe(result) }
  })
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: runTag } }, select: { id: true } })
  const userIds = users.map((user) => user.id)
  await prisma.student.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.tutor.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  return userIds.length
}

try {
  await main()
} catch (error) {
  console.error(`Run stopped early: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  const removed = await cleanup()
  await prisma.$disconnect()
  for (const { id, result, note } of results) console.log(`${result.padEnd(4)}  ${id.padEnd(5)}  ${note}`)
  const failed = results.filter((item) => item.result === 'FAIL').length
  console.log(`\n${results.length} cases: ${results.length - failed} pass/skip, ${failed} fail. Removed ${removed} temporary accounts.`)
  if (failed) process.exitCode = 1
}
