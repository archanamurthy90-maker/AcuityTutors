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
