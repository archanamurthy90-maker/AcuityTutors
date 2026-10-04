import { AttemptSource, Difficulty, Prisma, PrismaClient, UserRole } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../auth.js'
import { GEMINI_MODEL, generatePracticeQuestion, generateTutorSummary } from '../services/gemini.js'
import { recalculateTopicMastery } from '../services/mastery.js'

const answerSchema = z.object({ answer: z.string().trim().min(1, 'Choose an answer.').max(300) })
const studentIdSchema = z.string().cuid()
export const alreadyAnsweredMessage = 'This question has already been answered.'

const weaknessRank = {
  NEEDS_PRACTICE: 0,
  DEVELOPING: 1,
  NOT_ENOUGH_DATA: 2,
  MASTERED: 3,
} as const

function questionDifficulty(status: keyof typeof weaknessRank) {
  switch (status) {
    case 'NEEDS_PRACTICE': return { difficulty: Difficulty.BEGINNER, promptDifficulty: 'easy' as const }
    case 'DEVELOPING': return { difficulty: Difficulty.INTERMEDIATE, promptDifficulty: 'medium' as const }
    case 'MASTERED': return { difficulty: Difficulty.ADVANCED, promptDifficulty: 'hard' as const }
    case 'NOT_ENOUGH_DATA': return { difficulty: Difficulty.BEGINNER, promptDifficulty: 'easy' as const }
  }
}

export function createGeminiRouter(prisma: PrismaClient) {
  const router = Router()

  router.post('/student/practice-questions', requireAuth, requireRole(UserRole.STUDENT), async (_request, response, next) => {
    try {
      const auth = response.locals.auth as { sub: string }
      const student = await prisma.student.findUnique({ where: { userId: auth.sub }, select: { id: true } })
      if (!student) {
        response.status(404).json({ error: 'Student profile not found.' })
        return
      }

      const scores = await prisma.masteryScore.findMany({
        where: { studentId: student.id },
        include: { topic: { include: { subject: true } } },
      })
      if (scores.length === 0) {
        response.status(404).json({ error: 'There are no topic results to focus practice yet.' })
        return
      }

      const weakest = [...scores].sort((left, right) => {
        const rankDifference = weaknessRank[left.status] - weaknessRank[right.status]
        return rankDifference || left.score - right.score
      })[0]
      const difficulty = questionDifficulty(weakest.status)
      const generated = await generatePracticeQuestion({
        subject: weakest.topic.subject.name,
        topic: weakest.topic.name,
        accuracy: weakest.score,
        status: weakest.status,
        attempts: weakest.attemptCount,
        difficulty: difficulty.promptDifficulty,
      })
      const saved = await prisma.practiceQuestion.create({
        data: {
          studentId: student.id,
          topicId: weakest.topicId,
          prompt: generated.question,
          choices: generated.options,
          correctAnswer: generated.correctAnswer,
          explanation: generated.explanation,
          difficulty: difficulty.difficulty,
          model: GEMINI_MODEL,
        },
        select: { id: true, topicId: true, prompt: true, choices: true, difficulty: true, topic: { select: { name: true } } },
      })

      response.status(201).json({
        practiceQuestion: {
          id: saved.id,
          topicId: saved.topicId,
          question: saved.prompt,
          options: saved.choices,
          difficulty: saved.difficulty,
          topic: saved.topic.name,
        },
      })
    } catch (error) {
      next(error)
    }
  })

  router.post('/student/practice-questions/:questionId/answer', requireAuth, requireRole(UserRole.STUDENT), async (request, response, next) => {
    const parsed = answerSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({
        error: 'Choose one of the answer options.',
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
      })
      return
    }

    try {
      const auth = response.locals.auth as { sub: string }
      const student = await prisma.student.findUnique({ where: { userId: auth.sub }, select: { id: true } })
      if (!student) {
        response.status(404).json({ error: 'Student profile not found.' })
        return
      }

      const questionId = z.string().cuid().safeParse(request.params.questionId)
      if (!questionId.success) {
        response.status(400).json({ error: 'This practice question is not valid.' })
        return
      }
      const question = await prisma.practiceQuestion.findFirst({
        where: { id: questionId.data, studentId: student.id },
        select: { id: true, topicId: true, prompt: true, choices: true, correctAnswer: true, explanation: true, difficulty: true, attempt: { select: { id: true } } },
      })
      if (!question) {
        response.status(404).json({ error: 'Practice question not found.' })
        return
      }
      if (question.attempt) {
        response.status(409).json({ error: alreadyAnsweredMessage })
        return
      }

      const choices = Array.isArray(question.choices) ? question.choices.filter((choice): choice is string => typeof choice === 'string') : []
      if (!choices.some((choice) => choice.toLocaleLowerCase() === parsed.data.answer.toLocaleLowerCase())) {
        response.status(400).json({ error: 'Choose one of the four options shown for this question.' })
        return
      }

      const isCorrect = question.correctAnswer.toLocaleLowerCase() === parsed.data.answer.toLocaleLowerCase()
      const result = await prisma.$transaction(async (transaction) => {
        const attempt = await transaction.quizAttempt.create({
          data: {
            studentId: student.id,
            topicId: question.topicId,
            practiceQuestionId: question.id,
            isCorrect,
            response: parsed.data.answer,
            difficulty: question.difficulty,
            source: AttemptSource.PRACTICE,
          },
          select: { id: true, isCorrect: true, attemptedAt: true },
        })
        const mastery = await recalculateTopicMastery(transaction, student.id, question.topicId)
        return { attempt, mastery }
      })

      response.status(201).json({
        isCorrect,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        mastery: result.mastery,
      })
    } catch (error) {
      // The unique practiceQuestionId constraint rejects a concurrent second answer.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        response.status(409).json({ error: alreadyAnsweredMessage })
        return
      }
      next(error)
    }
  })

  router.post('/tutor/students/:studentId/summary', requireAuth, requireRole(UserRole.TUTOR), async (request, response, next) => {
    try {
      const auth = response.locals.auth as { sub: string }
      const studentId = studentIdSchema.safeParse(request.params.studentId)
      if (!studentId.success) {
        response.status(400).json({ error: 'Student identifier is not valid.' })
        return
      }

      const tutor = await prisma.tutor.findUnique({ where: { userId: auth.sub }, select: { id: true } })
      if (!tutor) {
        response.status(404).json({ error: 'Tutor profile not found.' })
        return
      }
      const rosterLink = await prisma.tutorStudent.findUnique({
        where: { tutorId_studentId: { tutorId: tutor.id, studentId: studentId.data } },
        select: { student: { select: { id: true, displayName: true } } },
      })
      if (!rosterLink) {
        response.status(404).json({ error: 'This student is not in your roster.' })
        return
      }

      const scores = await prisma.masteryScore.findMany({
        where: { studentId: rosterLink.student.id },
        include: { topic: { include: { subject: true } } },
      })
      const summary = await generateTutorSummary(scores.map((score) => ({
        subject: score.topic.subject.name,
        topic: score.topic.name,
        accuracy: score.score,
        status: score.status,
        attempts: score.attemptCount,
      })))

      response.json({ student: rosterLink.student.displayName, summary })
    } catch (error) {
      next(error)
    }
  })

  return router
}
