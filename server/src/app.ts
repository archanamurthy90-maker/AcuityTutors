import express from 'express'
import { existsSync } from 'node:fs'
import { PrismaClient, UserRole } from '@prisma/client'
import { createAuthRouter, cookieMiddleware, requireAuth, requireRole } from './auth.js'
import { createGeminiRouter } from './routes/gemini.js'
import { createMasteryRouter } from './routes/mastery.js'
import { createReportsRouter } from './routes/reports.js'
import { apiErrorHandler } from './middleware/errors.js'
import { createAiRateLimiters, createAuthRateLimiters, type RateLimitSettings } from './middleware/rateLimits.js'
import { corsPolicy, rejectCrossOriginWrites, securityHeaders } from './middleware/security.js'

export type AppOptions = {
  clientDistPath?: string
  rateLimits?: Partial<RateLimitSettings>
}

export function createApp(prisma: PrismaClient, options: AppOptions = {}) {
  const app = express()
  const isProduction = process.env.NODE_ENV === 'production'

  app.disable('x-powered-by')
  // Cloud Run terminates TLS at one proxy hop; trust it so rate limits see the client IP.
  if (isProduction) app.set('trust proxy', 1)
  app.use(securityHeaders)
  app.use('/api', corsPolicy, rejectCrossOriginWrites)
  // The largest legitimate body is a quiz attempt (≤1,000-character response).
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieMiddleware)

  // Public health is a liveness signal only; configuration details are for local development.
  app.get('/api/health', async (_request, response) => {
    if (process.env.NODE_ENV === 'production') {
      response.json({ status: 'ok' })
      return
    }

    let databaseConnected = false
    if (process.env.DATABASE_URL) {
      try {
        await prisma.$queryRaw`SELECT 1`
        databaseConnected = true
      } catch {
        databaseConnected = false
      }
    }

    response.json({
      status: 'ok',
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      databaseConnected,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    })
  })

  app.use('/api/auth', createAuthRouter(prisma, createAuthRateLimiters(options.rateLimits)))
  app.use('/api', createMasteryRouter(prisma))
  app.use('/api', createGeminiRouter(prisma, createAiRateLimiters(options.rateLimits)))
  app.use('/api', createReportsRouter(prisma))

  app.get('/api/student/dashboard', requireAuth, requireRole(UserRole.STUDENT), (_request, response) => {
    response.json({ role: UserRole.STUDENT, message: 'Your student workspace is ready.' })
  })

  app.get('/api/tutor/dashboard', requireAuth, requireRole(UserRole.TUTOR), (_request, response) => {
    response.json({ role: UserRole.TUTOR, message: 'Your tutor workspace is ready.' })
  })

  app.use('/api', (_request, response) => {
    response.status(404).json({ error: 'API route not found' })
  })

  app.use(apiErrorHandler)

  const clientDistPath = options.clientDistPath
  if (isProduction && clientDistPath && existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath))
    app.get(/.*/, (_request, response) => {
      response.sendFile('index.html', { root: clientDistPath })
    })
  }

  return app
}
