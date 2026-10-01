import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import { Router, type RequestHandler } from 'express'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import { Prisma, PrismaClient, UserRole } from '@prisma/client'
import { z } from 'zod'

export const sessionCookieName = 'acuity_session'
const sessionLifetimeSeconds = 60 * 60 * 8
const sessionIssuer = 'acuity-tutors'
const sessionAudience = 'acuity-tutors-web'

const registerSchema = z.object({
  displayName: z.string().trim().min(2, 'Enter at least 2 characters.').max(80, 'Use 80 characters or fewer.'),
  email: z.string().trim().email('Enter a valid email address.').max(254),
  password: z.string().min(8, 'Use at least 8 characters.').max(128, 'Use 128 characters or fewer.'),
  role: z.nativeEnum(UserRole),
})

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(254),
  password: z.string().min(1, 'Enter your password.').max(128),
})

type SessionClaims = JwtPayload & {
  sub: string
  email: string
  role: UserRole
}

type PublicUser = {
  id: string
  email: string
  role: UserRole
  displayName: string
}

function getJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET
  return secret && secret.length >= 32 && !secret.includes('replace-with') ? secret : null
}

function toPublicUser(user: {
  id: string
  email: string
  role: UserRole
  student: { displayName: string } | null
  tutor: { displayName: string } | null
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.student?.displayName ?? user.tutor?.displayName ?? user.email,
  }
}

function sendValidationError(response: Parameters<RequestHandler>[1], issues: z.ZodIssue[]) {
  response.status(400).json({
    error: 'Check the form fields and try again.',
    details: issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
  })
}

function setSessionCookie(response: Parameters<RequestHandler>[1], token: string) {
  response.cookie(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: sessionLifetimeSeconds * 1000,
    path: '/',
  })
}

export function createAuthRouter(prisma: PrismaClient) {
  const router = Router()

  router.post('/register', async (request, response, next) => {
    const parsed = registerSchema.safeParse(request.body)
    if (!parsed.success) {
      sendValidationError(response, parsed.error.issues)
      return
    }

    const secret = getJwtSecret()
    if (!secret) {
      response.status(503).json({ error: 'Authentication is not configured on this server.' })
      return
    }

    const { displayName, password, role } = parsed.data
    const email = parsed.data.email.toLowerCase()

    try {
      const passwordHash = await bcrypt.hash(password, 12)
      const user = await prisma.$transaction(async (transaction) => {
        const createdUser = await transaction.user.create({
          data: { email, passwordHash, role },
        })

        if (role === UserRole.STUDENT) {
          await transaction.student.create({ data: { userId: createdUser.id, displayName } })
        } else {
          await transaction.tutor.create({ data: { userId: createdUser.id, displayName } })
        }

        return transaction.user.findUniqueOrThrow({
          where: { id: createdUser.id },
          include: { student: true, tutor: true },
        })
      })

      const token = jwt.sign({ email: user.email, role: user.role }, secret, {
        subject: user.id,
        expiresIn: sessionLifetimeSeconds,
        issuer: sessionIssuer,
        audience: sessionAudience,
        algorithm: 'HS256',
      })
      setSessionCookie(response, token)
      response.status(201).json({ user: toPublicUser(user) })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        response.status(409).json({ error: 'An account with this email already exists.' })
        return
      }
      next(error)
    }
  })

  router.post('/login', async (request, response, next) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      sendValidationError(response, parsed.error.issues)
      return
    }

    const secret = getJwtSecret()
    if (!secret) {
      response.status(503).json({ error: 'Authentication is not configured on this server.' })
      return
    }

    try {
      const email = parsed.data.email.toLowerCase()
      const user = await prisma.user.findUnique({
        where: { email },
        include: { student: true, tutor: true },
      })

      if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
        response.status(401).json({ error: 'Email or password is incorrect.' })
        return
      }

      const token = jwt.sign({ email: user.email, role: user.role }, secret, {
        subject: user.id,
        expiresIn: sessionLifetimeSeconds,
        issuer: sessionIssuer,
        audience: sessionAudience,
        algorithm: 'HS256',
      })
      setSessionCookie(response, token)
      response.json({ user: toPublicUser(user) })
    } catch (error) {
      next(error)
    }
  })

  router.post('/logout', (_request, response) => {
    response.clearCookie(sessionCookieName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    })
    response.status(204).end()
  })

  router.get('/me', requireAuth, async (_request, response, next) => {
    try {
      const claims = response.locals.auth as SessionClaims
      const user = await prisma.user.findUnique({
        where: { id: claims.sub },
        include: { student: true, tutor: true },
      })

      if (!user) {
        response.clearCookie(sessionCookieName, { path: '/' })
        response.status(401).json({ error: 'Your session is no longer valid. Please sign in again.' })
        return
      }

      response.json({ user: toPublicUser(user) })
    } catch (error) {
      next(error)
    }
  })

  return router
}

export const requireAuth: RequestHandler = (request, response, next) => {
  const secret = getJwtSecret()
  const token = request.cookies?.[sessionCookieName]

  if (!secret || typeof token !== 'string') {
    response.status(401).json({ error: 'Please sign in to continue.' })
    return
  }

  try {
    const decoded = jwt.verify(token, secret, {
      issuer: sessionIssuer,
      audience: sessionAudience,
      algorithms: ['HS256'],
    })

    if (
      typeof decoded === 'string' ||
      !decoded.sub ||
      typeof decoded.email !== 'string' ||
      (decoded.role !== UserRole.STUDENT && decoded.role !== UserRole.TUTOR)
    ) {
      response.status(401).json({ error: 'Your session is invalid. Please sign in again.' })
      return
    }

    response.locals.auth = decoded as SessionClaims
    next()
  } catch {
    response.clearCookie(sessionCookieName, { path: '/' })
    response.status(401).json({ error: 'Your session has expired. Please sign in again.' })
  }
}

export function requireRole(role: UserRole): RequestHandler {
  return (_request, response, next) => {
    const claims = response.locals.auth as SessionClaims | undefined
    if (!claims) {
      response.status(401).json({ error: 'Please sign in to continue.' })
      return
    }
    if (claims.role !== role) {
      response.status(403).json({ error: 'You do not have permission to access this page.' })
      return
    }
    next()
  }
}

export const cookieMiddleware = cookieParser()
