import { Prisma, PrismaClient, UserRole } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../auth.js'

export const reportReasonMaxLength = 300
export const alreadyReportedMessage = 'You have already reported this question. Your tutor can see it.'

// Optional free text: trimmed, control characters removed, at most 300 characters.
export const reportSchema = z.object({
  reason: z.string()
    .transform((reason) => reason.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim())
    .pipe(z.string().max(reportReasonMaxLength, `Keep the reason to ${reportReasonMaxLength} characters or fewer.`))
    .optional(),
}).strict()

const questionIdSchema = z.string().cuid()

export function createReportsRouter(prisma: PrismaClient) {
  const router = Router()

  router.post('/student/practice-questions/:questionId/report', requireAuth, requireRole(UserRole.STUDENT), async (request, response, next) => {
    const questionId = questionIdSchema.safeParse(request.params.questionId)
    if (!questionId.success) {
      response.status(400).json({ error: 'This practice question is not valid.' })
      return
    }
    const parsed = reportSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      response.status(400).json({
        error: 'Check the report and try again.',
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join('.') || 'reason', message: issue.message })),
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
      // Ownership check: another student's question is indistinguishable from a missing one.
      const question = await prisma.practiceQuestion.findFirst({
        where: { id: questionId.data, studentId: student.id },
        select: { id: true, report: { select: { id: true } } },
      })
      if (!question) {
        response.status(404).json({ error: 'Practice question not found.' })
        return
      }
      if (question.report) {
        response.status(409).json({ error: alreadyReportedMessage })
        return
      }

      const report = await prisma.questionReport.create({
        data: { practiceQuestionId: question.id, studentId: student.id, reason: parsed.data.reason || null },
        select: { id: true, createdAt: true },
      })
      response.status(201).json({ report })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        response.status(409).json({ error: alreadyReportedMessage })
        return
      }
      next(error)
    }
  })

  router.get('/tutor/question-reports', requireAuth, requireRole(UserRole.TUTOR), async (_request, response, next) => {
    try {
      const auth = response.locals.auth as { sub: string }
      const tutor = await prisma.tutor.findUnique({ where: { userId: auth.sub }, select: { id: true } })
      if (!tutor) {
        response.status(404).json({ error: 'Tutor profile not found.' })
        return
      }
      // Roster scope: only reports from students linked to this tutor.
      const reports = await prisma.questionReport.findMany({
        where: { student: { tutorLinks: { some: { tutorId: tutor.id } } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          reason: true,
          createdAt: true,
          student: { select: { id: true, displayName: true } },
          practiceQuestion: {
            select: {
              prompt: true,
              choices: true,
              correctAnswer: true,
              explanation: true,
              difficulty: true,
              createdAt: true,
              topic: { select: { name: true, subject: { select: { name: true } } } },
            },
          },
        },
      })
      response.json({ reports })
    } catch (error) {
      next(error)
    }
  })

  return router
}
