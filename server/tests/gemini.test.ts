import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '@google/genai'
import { z } from 'zod'
import { GeminiServiceError, mapProviderError, parseGeminiJson } from '../src/services/gemini.js'

const questionSchema = z.object({
  question: z.string().min(10),
  options: z.array(z.string()).length(4),
  correctAnswer: z.string(),
  explanation: z.string().min(10),
}).superRefine((question, context) => {
  if (new Set(question.options.map((option) => option.toLowerCase())).size !== 4) {
    context.addIssue({ code: 'custom', message: 'Options must be unique.' })
  }
  if (!question.options.some((option) => option.toLowerCase() === question.correctAnswer.toLowerCase())) {
    context.addIssue({ code: 'custom', message: 'Answer must match an option.' })
  }
})

const validQuestion = {
  question: 'Which equation shows three groups of four?',
  options: ['3 x 4', '3 + 4', '4 - 3', '4 / 3'],
  correctAnswer: '3 x 4',
  explanation: 'Three equal groups of four are represented by multiplication.',
}

test('accepts valid structured JSON and rejects malformed or semantically invalid output', () => {
  assert.deepEqual(parseGeminiJson(JSON.stringify(validQuestion), questionSchema), validQuestion)

  assert.throws(
    () => parseGeminiJson('{not json}', questionSchema),
    (error: unknown) => error instanceof GeminiServiceError && error.statusCode === 502,
  )

  assert.throws(
    () => parseGeminiJson(JSON.stringify({ ...validQuestion, options: ['same', 'same', 'other', 'fourth'] }), questionSchema),
    (error: unknown) => error instanceof GeminiServiceError && error.statusCode === 502,
  )
})

test('maps rate limits and timeouts to friendly errors without exposing provider details', () => {
  const rateLimit = mapProviderError(new ApiError({ status: 429, message: 'PRIVATE_PROVIDER_DETAIL' }))
  assert.equal(rateLimit.statusCode, 429)
  assert.match(rateLimit.publicMessage, /many requests/i)
  assert.doesNotMatch(rateLimit.publicMessage, /PRIVATE_PROVIDER_DETAIL/)

  const timeout = new Error('request timed out')
  timeout.name = 'RequestTimeoutError'
  const timeoutError = mapProviderError(timeout)
  assert.equal(timeoutError.statusCode, 504)
  assert.match(timeoutError.publicMessage, /too long/i)
})
