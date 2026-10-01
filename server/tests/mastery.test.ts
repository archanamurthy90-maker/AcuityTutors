import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateTopicMastery, masteryStatuses } from '../src/services/mastery.js'

function outcomes(correct: number, total: number) {
  return Array.from({ length: total }, (_, index) => ({ isCorrect: index < correct }))
}

test('classifies exact mastery boundaries', () => {
  assert.equal(calculateTopicMastery(outcomes(80, 100)).status, masteryStatuses.MASTERED)
  assert.equal(calculateTopicMastery(outcomes(79, 100)).status, masteryStatuses.DEVELOPING)
  assert.equal(calculateTopicMastery(outcomes(60, 100)).status, masteryStatuses.DEVELOPING)
  assert.equal(calculateTopicMastery(outcomes(59, 100)).status, masteryStatuses.NEEDS_PRACTICE)
  assert.equal(calculateTopicMastery(outcomes(100, 100)).status, masteryStatuses.MASTERED)
})

test('requires at least three attempts before assigning a mastery level', () => {
  assert.equal(calculateTopicMastery(outcomes(2, 2)).status, masteryStatuses.NOT_ENOUGH_DATA)
  assert.equal(calculateTopicMastery(outcomes(0, 0)).status, masteryStatuses.NOT_ENOUGH_DATA)
  assert.equal(calculateTopicMastery(outcomes(0, 0)).accuracy, null)
})

test('returns accuracy and attempt counts from the supplied history', () => {
  assert.deepEqual(calculateTopicMastery(outcomes(5, 6)), {
    accuracy: (5 / 6) * 100,
    correctAttempts: 5,
    totalAttempts: 6,
    status: masteryStatuses.MASTERED,
  })
})
