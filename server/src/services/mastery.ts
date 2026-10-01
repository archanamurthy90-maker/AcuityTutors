import { Prisma } from '@prisma/client'

export const masteryStatuses = {
  MASTERED: 'MASTERED',
  DEVELOPING: 'DEVELOPING',
  NEEDS_PRACTICE: 'NEEDS_PRACTICE',
  NOT_ENOUGH_DATA: 'NOT_ENOUGH_DATA',
} as const

export type MasteryStatus = (typeof masteryStatuses)[keyof typeof masteryStatuses]
export type AttemptOutcome = { isCorrect: boolean }

export type TopicMastery = {
  accuracy: number | null
  correctAttempts: number
  totalAttempts: number
  status: MasteryStatus
}

export type ProgressAttempt = {
  id: string
  topicId: string
  topicName: string
  subjectName: string
  isCorrect: boolean
  attemptedAt: Date
}

export type TopicProgressSeries = {
  topicId: string
  topicName: string
  subjectName: string
  points: Array<{ attemptedAt: string; accuracy: number; attempts: number; isCorrect: boolean }>
}

export function calculateTopicMastery(attempts: readonly AttemptOutcome[]): TopicMastery {
  const totalAttempts = attempts.length
  const correctAttempts = attempts.reduce((total, attempt) => total + Number(attempt.isCorrect), 0)
  const accuracy = totalAttempts === 0 ? null : (correctAttempts / totalAttempts) * 100

  if (totalAttempts < 3) {
    return { accuracy, correctAttempts, totalAttempts, status: masteryStatuses.NOT_ENOUGH_DATA }
  }

  if (correctAttempts * 100 >= totalAttempts * 80) {
    return { accuracy, correctAttempts, totalAttempts, status: masteryStatuses.MASTERED }
  }

  if (correctAttempts * 100 >= totalAttempts * 60) {
    return { accuracy, correctAttempts, totalAttempts, status: masteryStatuses.DEVELOPING }
  }

  return { accuracy, correctAttempts, totalAttempts, status: masteryStatuses.NEEDS_PRACTICE }
}

export function buildTopicProgressSeries(attempts: readonly ProgressAttempt[]): TopicProgressSeries[] {
  const orderedAttempts = [...attempts].sort((left, right) =>
    left.attemptedAt.getTime() - right.attemptedAt.getTime() || left.id.localeCompare(right.id),
  )
  const seriesByTopic = new Map<string, TopicProgressSeries>()
  const totalsByTopic = new Map<string, { attempts: number; correct: number }>()

  for (const attempt of orderedAttempts) {
    const series = seriesByTopic.get(attempt.topicId) ?? {
      topicId: attempt.topicId,
      topicName: attempt.topicName,
      subjectName: attempt.subjectName,
      points: [],
    }
    const totals = totalsByTopic.get(attempt.topicId) ?? { attempts: 0, correct: 0 }
    totals.attempts += 1
    totals.correct += Number(attempt.isCorrect)
    series.points.push({
      attemptedAt: attempt.attemptedAt.toISOString(),
      accuracy: totals.correct / totals.attempts * 100,
      attempts: totals.attempts,
      isCorrect: attempt.isCorrect,
    })
    seriesByTopic.set(attempt.topicId, series)
    totalsByTopic.set(attempt.topicId, totals)
  }

  return [...seriesByTopic.values()].sort((left, right) =>
    left.subjectName.localeCompare(right.subjectName) || left.topicName.localeCompare(right.topicName),
  )
}

export async function recalculateTopicMastery(
  transaction: Prisma.TransactionClient,
  studentId: string,
  topicId: string,
): Promise<TopicMastery> {
  const attempts = await transaction.quizAttempt.findMany({
    where: { studentId, topicId },
    select: { isCorrect: true },
  })
  const mastery = calculateTopicMastery(attempts)

  if (mastery.accuracy === null) {
    await transaction.masteryScore.deleteMany({ where: { studentId, topicId } })
    return mastery
  }

  await transaction.masteryScore.upsert({
    where: { studentId_topicId: { studentId, topicId } },
    update: {
      score: mastery.accuracy,
      status: mastery.status,
      attemptCount: mastery.totalAttempts,
      confidence: Math.min(1, mastery.totalAttempts / 8),
      computedAt: new Date(),
    },
    create: {
      studentId,
      topicId,
      score: mastery.accuracy,
      status: mastery.status,
      attemptCount: mastery.totalAttempts,
      confidence: Math.min(1, mastery.totalAttempts / 8),
    },
  })

  return mastery
}
