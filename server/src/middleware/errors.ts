import { Prisma } from '@prisma/client'
import type { ErrorRequestHandler, Request } from 'express'
import { GeminiServiceError } from '../services/gemini.js'

export const invalidJsonMessage = 'The request body is not valid JSON. Check the data and try again.'
export const databaseUnavailableMessage = 'The database is temporarily unavailable. Please try again in a moment.'
export const unexpectedErrorMessage = 'Something went wrong. Please try again.'

// Prisma P1xxx codes are connection/server-level failures; P2024 is a connection-pool timeout.
export function isDatabaseUnavailableError(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    return true
  }
  return error instanceof Prisma.PrismaClientKnownRequestError && (/^P1\d{3}$/.test(error.code) || error.code === 'P2024')
}

// body-parser errors carry a `type` and a 4xx `status`.
function bodyParserError(error: unknown): { status: number; type: string } | null {
  if (typeof error !== 'object' || error === null) return null
  const { status, type } = error as { status?: unknown; type?: unknown }
  if (typeof status !== 'number' || typeof type !== 'string' || status < 400 || status >= 500) return null
  return { status, type }
}

// Prisma and provider messages can echo query values such as emails, so production
// logs keep only the error type, code, and route. Development logs the full error.
export function logApiError(label: string, error: unknown, request: Request) {
  if (process.env.NODE_ENV !== 'production') {
    console.error(label, error)
    return
  }
  const { name, code } = (typeof error === 'object' && error !== null ? error : {}) as { name?: unknown; code?: unknown }
  console.error(label, JSON.stringify({
    name: typeof name === 'string' ? name : typeof error,
    code: typeof code === 'string' ? code : undefined,
    method: request.method,
    path: request.route?.path ?? request.path,
  }))
}

export const apiErrorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (error instanceof GeminiServiceError) {
    response.status(error.statusCode).json({ error: error.publicMessage })
    return
  }

  const parserError = bodyParserError(error)
  if (parserError) {
    const message = parserError.type === 'entity.parse.failed'
      ? invalidJsonMessage
      : parserError.type === 'entity.too.large'
        ? 'The request body is too large.'
        : 'The request body could not be read.'
    response.status(parserError.status).json({ error: message })
    return
  }

  if (isDatabaseUnavailableError(error)) {
    logApiError('Database unavailable:', error, request)
    response.status(503).json({ error: databaseUnavailableMessage })
    return
  }

  logApiError('Unhandled API error:', error, request)
  response.status(500).json({ error: unexpectedErrorMessage })
}
