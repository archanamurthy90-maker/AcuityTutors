import assert from 'node:assert/strict'
import test from 'node:test'
import jwt from 'jsonwebtoken'
import { registrationPasswordSchema, sessionCookieName, sessionExpiredMessage } from '../src/auth.js'

test('registration password rejects values missing length, letters, or digits', () => {
  for (const password of ['123', 'abcdefgh', '12345678', 'abc123']) {
    const result = registrationPasswordSchema.safeParse(password)
    assert.equal(result.success, false, `${password} should be rejected`)
    if (!result.success) {
      assert.ok(result.error.issues.some((issue) => issue.message.includes('8 characters') && issue.message.includes('letter') && issue.message.includes('number')))
    }
  }
})

test('registration password accepts a value with length, letter, and number', () => {
  assert.equal(registrationPasswordSchema.safeParse('Tutor2026!').success, true)
})

async function requestProtectedRoute(cookie?: string) {
  const { default: express } = await import('express')
  const { cookieMiddleware, requireAuth } = await import('../src/auth.js')
  const app = express()
  app.use(cookieMiddleware)
  app.get('/protected', requireAuth, (_request, response) => { response.json({ ok: true }) })
  const server = app.listen(0)
  try {
    const { port } = server.address() as { port: number }
    const response = await fetch(`http://127.0.0.1:${port}/protected`, { headers: cookie ? { cookie } : {} })
    return { status: response.status, body: await response.json() as { error?: string; code?: string }, setCookie: response.headers.get('set-cookie') }
  } finally {
    server.close()
  }
}

function signSession(secret: string, expiresIn: number) {
  return jwt.sign({ email: 'ava@acuity.local', role: 'STUDENT' }, secret, {
    subject: 'user-1',
    expiresIn,
    issuer: 'acuity-tutors',
    audience: 'acuity-tutors-web',
    algorithm: 'HS256',
  })
}

test('BUG-01: expired session token returns SESSION_EXPIRED with a clear message and clears the cookie', async () => {
  process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long'
  const token = signSession(process.env.JWT_SECRET, -60)
  const result = await requestProtectedRoute(`${sessionCookieName}=${token}`)
  assert.equal(result.status, 401)
  assert.equal(result.body.code, 'SESSION_EXPIRED')
  assert.equal(result.body.error, sessionExpiredMessage)
  assert.match(result.setCookie ?? '', new RegExp(`${sessionCookieName}=;`))
})

test('BUG-01: tampered token is SESSION_INVALID and a missing token is AUTH_REQUIRED', async () => {
  process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long'
  const forged = signSession('a-different-secret-that-is-also-32-characters', 3600)
  const invalid = await requestProtectedRoute(`${sessionCookieName}=${forged}`)
  assert.equal(invalid.status, 401)
  assert.equal(invalid.body.code, 'SESSION_INVALID')

  const missing = await requestProtectedRoute()
  assert.equal(missing.status, 401)
  assert.equal(missing.body.code, 'AUTH_REQUIRED')
})

test('valid session token reaches the protected handler', async () => {
  process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long'
  const result = await requestProtectedRoute(`${sessionCookieName}=${signSession(process.env.JWT_SECRET, 3600)}`)
  assert.equal(result.status, 200)
})
