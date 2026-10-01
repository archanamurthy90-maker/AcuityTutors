import { AttemptSource, Difficulty, PrismaClient, UserRole } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../auth.js'
import { buildTopicProgressSeries, recalculateTopicMastery } from '../services/mastery.js'

const attemptSchema = z.object({
  topicId: z.string().cuid(),
  isCorrect: z.boolean(),
  difficulty: z.nativeEnum(Difficulty).default(Difficulty.INTERMEDIATE),
  response: z.string().trim().max(1000).optional(),
  responseTimeMs: z.number().int().min(0).max(3_600_000).optional(),
})

export function createMasteryRouter(prisma: PrismaClient) {
  const router = Router()

  router.get('/student/mastery', requireAuth, requireRole(UserRole.STUDENT), async (_request, response, next) => {
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
        orderBy: { topic: { name: 'asc' } },
      })

      response.json({ scores })
    } catch (error) {
      next(error)
    }
  })

  router.get('/student/progress', requireAuth, requireRole(UserRole.STUDENT), async (_request, response, next) => {
    try {
      const auth = response.locals.auth as { sub: string }
      const student = await prisma.student.findUnique({ where: { userId: auth.sub }, select: { id: true } })
      if (!student) {
        response.status(404).json({ error: 'Student profile not found.' })
        return
      }

      const attempts = await prisma.quizAttempt.findMany({
        where: { studentId: student.id },
        orderBy: [{ attemptedAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          topicId: true,
          isCorrect: true,
          attemptedAt: true,
          topic: { select: { name: true, subject: { select: { name: true } } } },
        },
      })
      const progress = buildTopicProgressSeries(attempts.map((attempt) => ({
        id: attempt.id,
        topicId: attempt.topicId,
        topicName: attempt.topic.name,
        subjectName: attempt.topic.subject.name,
        isCorrect: attempt.isCorrect,
        attemptedAt: attempt.attemptedAt,
      })))
      response.json({ progress })
    } catch (error) {
      next(error)
    }
  })

  router.get('/tutor/mastery', requireAuth, requireRole(UserRole.TUTOR), async (_request, response, next) => {
    try {
      const auth = response.locals.auth as { sub: string }
      const tutor = await prisma.tutor.findUnique({ where: { userId: auth.sub }, select: { id: true } })
      if (!tutor) {
        response.status(404).json({ error: 'Tutor profile not found.' })
        return
      }

      const roster = await prisma.tutorStudent.findMany({
        where: { tutorId: tutor.id },
        include: {
          student: {
            include: {
              user: { select: { email: true } },
              masteryScores: {
                include: { topic: { include: { subject: true } } },
              },
            },
          },
        },
      })
      const students = roster
        .map(({ student }) => ({
          id: student.id,
          displayName: student.displayName,
          email: student.user.email,
          scores: student.masteryScores.sort((left, right) => left.topic.name.localeCompare(right.topic.name)),
        }))
        .sort((left, right) => left.displayName.localeCompare(right.displayName))

      response.json({ students, totalScores: students.reduce((count, student) => count + student.scores.length, 0) })
    } catch (error) {
      next(error)
    }
  })

  router.get('/tutor/students/:studentId/progress', requireAuth, requireRole(UserRole.TUTOR), async (request, response, next) => {
    try {
      const auth = response.locals.auth as { sub: string }
      const studentId = z.string().cuid().safeParse(request.params.studentId)
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

      const attempts = await prisma.quizAttempt.findMany({
        where: { studentId: rosterLink.student.id },
        orderBy: [{ attemptedAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          topicId: true,
          isCorrect: true,
          attemptedAt: true,
          topic: { select: { name: true, subject: { select: { name: true } } } },
        },
      })
      const progress = buildTopicProgressSeries(attempts.map((attempt) => ({
        id: attempt.id,
        topicId: attempt.topicId,
        topicName: attempt.topic.name,
        subjectName: attempt.topic.subject.name,
        isCorrect: attempt.isCorrect,
        attemptedAt: attempt.attemptedAt,
      })))
      response.json({ student: { id: rosterLink.student.id, displayName: rosterLink.student.displayName }, progress })
    } catch (error) {
      next(error)
    }
  })

  router.post('/student/attempts', requireAuth, requireRole(UserRole.STUDENT), async (request, response, next) => {
    const parsed = attemptSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({
        error: 'Check the attempt details and try again.',
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

      const topicExists = await prisma.topic.findUnique({ where: { id: parsed.data.topicId }, select: { id: true } })
      if (!topicExists) {
        response.status(404).json({ error: 'Topic not found.' })
        return
      }

      const result = await prisma.$transaction(async (transaction) => {
        const attempt = await transaction.quizAttempt.create({
          data: {
            studentId: student.id,
            topicId: parsed.data.topicId,
            isCorrect: parsed.data.isCorrect,
            difficulty: parsed.data.difficulty,
            response: parsed.data.response,
            responseTimeMs: parsed.data.responseTimeMs,
            source: AttemptSource.QUIZ,
          },
          select: { id: true, topicId: true, isCorrect: true, attemptedAt: true },
        })
        const mastery = await recalculateTopicMastery(transaction, student.id, parsed.data.topicId)
        return { attempt, mastery }
      })

      response.status(201).json(result)
    } catch (error) {
      next(error)
    }
  })

  return router
}
