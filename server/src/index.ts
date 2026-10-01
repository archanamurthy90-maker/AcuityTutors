import dotenv from 'dotenv'
import express from 'express'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient, UserRole } from '@prisma/client'
import { createAuthRouter, cookieMiddleware, requireAuth, requireRole } from './auth.js'

const serverDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: resolve(serverDirectory, '.env') })

const app = express()
const prisma = new PrismaClient()
const clientDistPath = resolve(serverDirectory, '../client/dist')

app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))
app.use(cookieMiddleware)

app.use('/api/auth', createAuthRouter(prisma))

app.get('/api/health', async (_request, response) => {
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

app.get('/api/student/dashboard', requireAuth, requireRole(UserRole.STUDENT), (_request, response) => {
  response.json({ role: UserRole.STUDENT, message: 'Your student workspace is ready.' })
})

app.get('/api/tutor/dashboard', requireAuth, requireRole(UserRole.TUTOR), (_request, response) => {
  response.json({ role: UserRole.TUTOR, message: 'Your tutor workspace is ready.' })
})

app.use('/api', (_request, response) => {
  response.status(404).json({ error: 'API route not found' })
})

app.use((_error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  response.status(500).json({ error: 'Something went wrong. Please try again.' })
})

if (process.env.NODE_ENV === 'production' && existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath))
  app.get(/.*/, (_request, response) => {
    response.sendFile(resolve(clientDistPath, 'index.html'))
  })
}

const port = Number(process.env.PORT ?? 3001)
app.listen(port, '0.0.0.0', () => {
  console.log(`Acuity Tutors API listening on http://localhost:${port}`)
})
