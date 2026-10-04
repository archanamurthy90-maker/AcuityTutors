import type { Request, RequestHandler } from 'express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'

export const signInLimitMessage = 'Too many sign-in attempts. Please wait 15 minutes and try again.'
export const signUpLimitMessage = 'Too many sign-up attempts from this network. Please try again later.'
export const aiLimitMessage = 'You have made a lot of AI requests in a short time. Please wait a few minutes and try again.'

export type RateLimitSettings = {
  loginFailuresPerAccount: number
  loginFailuresPerIp: number
  registrationsPerIp: number
  registerRequestsPerIp: number
  practiceQuestionsPerUser: number
  summariesPerUser: number
}

// Sized for a tutoring center where many students share one network address.
export const defaultRateLimits: RateLimitSettings = {
  loginFailuresPerAccount: 10, // per IP + email, 15 minutes, failed attempts only
  loginFailuresPerIp: 100, // 15 minutes, failed attempts only
  registrationsPerIp: 20, // successful accounts per hour
  registerRequestsPerIp: 100, // all registration requests per 15 minutes
  practiceQuestionsPerUser: 20, // 10 minutes
  summariesPerUser: 30, // 10 minutes
}

const fifteenMinutes = 15 * 60 * 1000
const tenMinutes = 10 * 60 * 1000

function limiter(options: {
  windowMs: number
  limit: number
  message: string
  keyGenerator: (request: Request) => string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}): RequestHandler {
  const { message, ...rest } = options
  return rateLimit({
    ...rest,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_request, response) => {
      response.status(429).json({ error: message })
    },
  })
}

const clientIp = (request: Request) => ipKeyGenerator(request.ip ?? 'unknown')

function loginEmail(request: Request) {
  const email = (request.body as { email?: unknown } | undefined)?.email
  return typeof email === 'string' ? email.trim().toLowerCase().slice(0, 254) : ''
}

// Runs after requireAuth, so the session subject identifies the user.
function sessionUser(request: Request) {
  const auth = request.res?.locals.auth as { sub?: string } | undefined
  return `user:${auth?.sub ?? 'anonymous'}`
}

export function createAuthRateLimiters(settings: Partial<RateLimitSettings> = {}) {
  const limits = { ...defaultRateLimits, ...settings }
  return {
    login: [
      limiter({ windowMs: fifteenMinutes, limit: limits.loginFailuresPerIp, message: signInLimitMessage, keyGenerator: clientIp, skipSuccessfulRequests: true }),
      limiter({
        windowMs: fifteenMinutes,
        limit: limits.loginFailuresPerAccount,
        message: signInLimitMessage,
        keyGenerator: (request) => `${clientIp(request)}|${loginEmail(request)}`,
        skipSuccessfulRequests: true,
      }),
    ],
    register: [
      limiter({ windowMs: fifteenMinutes, limit: limits.registerRequestsPerIp, message: signUpLimitMessage, keyGenerator: clientIp }),
      limiter({ windowMs: 60 * 60 * 1000, limit: limits.registrationsPerIp, message: signUpLimitMessage, keyGenerator: clientIp, skipFailedRequests: true }),
    ],
  }
}

export function createAiRateLimiters(settings: Partial<RateLimitSettings> = {}) {
  const limits = { ...defaultRateLimits, ...settings }
  return {
    practiceQuestions: limiter({ windowMs: tenMinutes, limit: limits.practiceQuestionsPerUser, message: aiLimitMessage, keyGenerator: sessionUser }),
    summaries: limiter({ windowMs: tenMinutes, limit: limits.summariesPerUser, message: aiLimitMessage, keyGenerator: sessionUser }),
  }
}
