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
