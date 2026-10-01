import dotenv from 'dotenv'
import express from 'express'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

dotenv.config({ path: resolve(process.cwd(), '../.env') })

const app = express()
const clientDistPath = resolve(process.cwd(), '../client/dist')

app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  })
})

app.use('/api', (_request, response) => {
  response.status(404).json({ error: 'API route not found' })
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
