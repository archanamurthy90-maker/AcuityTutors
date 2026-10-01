import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTopicProgressSeries } from '../src/services/mastery.js'

test('builds chronological cumulative accuracy points independently per topic', () => {
  const series = buildTopicProgressSeries([
    { id: 'c', topicId: 'ratios', topicName: 'Ratios', subjectName: 'Math', isCorrect: true, attemptedAt: new Date('2026-01-03T00:00:00Z') },
    { id: 'b', topicId: 'ratios', topicName: 'Ratios', subjectName: 'Math', isCorrect: false, attemptedAt: new Date('2026-01-02T00:00:00Z') },
    { id: 'a', topicId: 'ratios', topicName: 'Ratios', subjectName: 'Math', isCorrect: true, attemptedAt: new Date('2026-01-01T00:00:00Z') },
    { id: 'd', topicId: 'forces', topicName: 'Forces', subjectName: 'Science', isCorrect: false, attemptedAt: new Date('2026-01-01T00:00:00Z') },
  ])

  assert.equal(series.length, 2)
  const ratios = series.find((topic) => topic.topicId === 'ratios')
  assert.deepEqual(ratios?.points.map((point) => [point.attempts, point.accuracy]), [
    [1, 100],
    [2, 50],
    [3, (2 / 3) * 100],
  ])
  assert.deepEqual(series.find((topic) => topic.topicId === 'forces')?.points.map((point) => point.accuracy), [0])
})
