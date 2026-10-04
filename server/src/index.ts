import dotenv from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import { createApp } from './app.js'

const serverDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: resolve(serverDirectory, '.env') })

const prisma = new PrismaClient()
const app = createApp(prisma, { clientDistPath: resolve(serverDirectory, '../client/dist') })

const port = Number(process.env.PORT ?? 3001)
app.listen(port, '0.0.0.0', () => {
  console.log(`Acuity Tutors API listening on http://localhost:${port}`)
})
