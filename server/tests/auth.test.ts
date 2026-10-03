import assert from 'node:assert/strict'
import test from 'node:test'
import { registrationPasswordSchema } from '../src/auth.js'

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
