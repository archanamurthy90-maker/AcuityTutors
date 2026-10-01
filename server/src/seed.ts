import { Difficulty, Prisma, PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { calculateTopicMastery } from './services/mastery.js'

const prisma = new PrismaClient()

const demoTutor = {
  email: 'tutor@acuity.local',
  password: 'TutorDemo!2026',
  displayName: 'Taylor Morgan',
}

const demoStudents = [
  {
    email: 'ava@acuity.local', password: 'StudentDemo!2026', displayName: 'Ava Chen',
    topicPlans: [{ attempts: 10, correct: 9 }, { attempts: 9, correct: 6 }, { attempts: 8, correct: 3 }, { attempts: 7, correct: 6 }, { attempts: 6, correct: 4 }, { attempts: 11, correct: 5 }, { attempts: 5, correct: 5 }, { attempts: 2, correct: 2 }],
  },
  {
    email: 'noah@acuity.local', password: 'StudentDemo!2026', displayName: 'Noah Patel',
    topicPlans: [{ attempts: 8, correct: 7 }, { attempts: 9, correct: 7 }, { attempts: 12, correct: 6 }, { attempts: 6, correct: 4 }, { attempts: 5, correct: 4 }, { attempts: 10, correct: 8 }, { attempts: 7, correct: 4 }, { attempts: 11, correct: 10 }],
  },
  {
    email: 'mia@acuity.local', password: 'StudentDemo!2026', displayName: 'Mia Brooks',
    topicPlans: [{ attempts: 5, correct: 4 }, { attempts: 12, correct: 8 }, { attempts: 10, correct: 5 }, { attempts: 9, correct: 8 }, { attempts: 7, correct: 5 }, { attempts: 6, correct: 2 }, { attempts: 11, correct: 9 }, { attempts: 8, correct: 5 }],
  },
  {
    email: 'liam@acuity.local', password: 'StudentDemo!2026', displayName: 'Liam Rivera',
    topicPlans: [{ attempts: 7, correct: 4 }, { attempts: 8, correct: 7 }, { attempts: 9, correct: 6 }, { attempts: 6, correct: 3 }, { attempts: 10, correct: 9 }, { attempts: 12, correct: 8 }, { attempts: 5, correct: 3 }, { attempts: 11, correct: 5 }],
  },
  {
    email: 'zoe@acuity.local', password: 'StudentDemo!2026', displayName: 'Zoe Kim',
    topicPlans: [{ attempts: 11, correct: 9 }, { attempts: 7, correct: 5 }, { attempts: 5, correct: 2 }, { attempts: 12, correct: 11 }, { attempts: 6, correct: 4 }, { attempts: 8, correct: 3 }, { attempts: 9, correct: 8 }, { attempts: 10, correct: 6 }],
  },
  {
    email: 'ethan@acuity.local', password: 'StudentDemo!2026', displayName: 'Ethan Wilson',
    topicPlans: [{ attempts: 12, correct: 6 }, { attempts: 5, correct: 4 }, { attempts: 7, correct: 5 }, { attempts: 10, correct: 9 }, { attempts: 9, correct: 4 }, { attempts: 6, correct: 4 }, { attempts: 8, correct: 5 }, { attempts: 11, correct: 10 }],
  },
]

const subjectDefinitions = [
  {
    name: 'Mathematics',
    topics: [
      'Fractions and Ratios',
      'Expressions and Equations',
      'Linear Relationships',
      'Geometry and Measurement',
    ],
  },
  {
    name: 'Science',
    topics: ['Life Science', 'Matter and Energy', 'Forces and Motion', 'Earth Systems'],
  },
]

async function main() {
  const tutorPasswordHash = await bcrypt.hash(demoTutor.password, 12)
  const tutor = await prisma.user.upsert({
    where: { email: demoTutor.email },
    update: { passwordHash: tutorPasswordHash, role: 'TUTOR' },
    create: { email: demoTutor.email, passwordHash: tutorPasswordHash, role: 'TUTOR' },
  })
  const tutorProfile = await prisma.tutor.upsert({
    where: { userId: tutor.id },
    update: { displayName: demoTutor.displayName },
    create: { userId: tutor.id, displayName: demoTutor.displayName },
  })

  const students = []
  for (const studentData of demoStudents) {
    const passwordHash = await bcrypt.hash(studentData.password, 12)
    const user = await prisma.user.upsert({
      where: { email: studentData.email },
      update: { passwordHash, role: 'STUDENT' },
      create: { email: studentData.email, passwordHash, role: 'STUDENT' },
    })
    const profile = await prisma.student.upsert({
      where: { userId: user.id },
      update: { displayName: studentData.displayName },
      create: { userId: user.id, displayName: studentData.displayName },
    })
    students.push({ ...studentData, id: profile.id })

    await prisma.tutorStudent.upsert({
      where: { tutorId_studentId: { tutorId: tutorProfile.id, studentId: profile.id } },
      update: {},
      create: { tutorId: tutorProfile.id, studentId: profile.id },
    })
  }

  const topics: Array<{ id: string; name: string }> = []
  for (const subjectData of subjectDefinitions) {
    const subject = await prisma.subject.upsert({
      where: { name: subjectData.name },
      update: {},
      create: { name: subjectData.name },
    })
    for (const name of subjectData.topics) {
      const topic = await prisma.topic.upsert({
        where: { subjectId_name: { subjectId: subject.id, name } },
        update: {},
        create: { subjectId: subject.id, name },
      })
      topics.push({ id: topic.id, name: topic.name })
    }
  }

  const studentIds = students.map((student) => student.id)
  const topicIds = topics.map((topic) => topic.id)
  await prisma.quizAttempt.deleteMany({ where: { studentId: { in: studentIds } } })
  await prisma.masteryScore.deleteMany({ where: { studentId: { in: studentIds } } })

  const attempts: Prisma.QuizAttemptCreateManyInput[] = []
  const now = Date.now()

  students.forEach((student, studentIndex) => {
    topics.forEach((topic, topicIndex) => {
      const plan = student.topicPlans[topicIndex]

      Array.from({ length: plan.attempts }, (_, attemptIndex) => {
        const previousCorrectCount = Math.floor(attemptIndex * plan.correct / plan.attempts)
        const nextCorrectCount = Math.floor((attemptIndex + 1) * plan.correct / plan.attempts)
        const isCorrect = nextCorrectCount > previousCorrectCount
        const difficulty = attemptIndex < plan.attempts / 3
          ? Difficulty.BEGINNER
          : attemptIndex < plan.attempts * 2 / 3 ? Difficulty.INTERMEDIATE : Difficulty.ADVANCED

        attempts.push({
          studentId: student.id,
          topicId: topic.id,
          isCorrect,
          difficulty,
          source: 'QUIZ',
          response: isCorrect ? 'Correct answer submitted' : 'Incorrect answer submitted',
          responseTimeMs: 42000 + ((studentIndex * 13 + topicIndex * 7 + attemptIndex * 11) % 90000),
          attemptedAt: new Date(now - (plan.attempts - attemptIndex - 1) * 3 * 86400000 - studentIndex * 3600000),
        })
      })

    })
  })

  await prisma.quizAttempt.createMany({ data: attempts })

  const persistedAttempts = await prisma.quizAttempt.findMany({
    where: { studentId: { in: studentIds }, topicId: { in: topicIds } },
    select: { studentId: true, topicId: true, isCorrect: true },
  })
  const attemptsByStudentAndTopic = new Map<string, {
    studentId: string
    topicId: string
    outcomes: Array<{ isCorrect: boolean }>
  }>()

  for (const attempt of persistedAttempts) {
    const key = `${attempt.studentId}:${attempt.topicId}`
    const group = attemptsByStudentAndTopic.get(key) ?? {
      studentId: attempt.studentId,
      topicId: attempt.topicId,
      outcomes: [],
    }
    group.outcomes.push({ isCorrect: attempt.isCorrect })
    attemptsByStudentAndTopic.set(key, group)
  }

  const masteryScores: Prisma.MasteryScoreCreateManyInput[] = []
  for (const group of attemptsByStudentAndTopic.values()) {
    const mastery = calculateTopicMastery(group.outcomes)
    if (mastery.accuracy === null) continue

    masteryScores.push({
      studentId: group.studentId,
      topicId: group.topicId,
      score: mastery.accuracy,
      status: mastery.status,
      attemptCount: mastery.totalAttempts,
      confidence: Math.min(1, mastery.totalAttempts / 8),
      computedAt: new Date(now),
    })
  }

  await prisma.masteryScore.createMany({ data: masteryScores })

  console.log(`Seeded 1 tutor, ${students.length} students, 2 subjects, ${topics.length} topics.`)
  console.log(`Recorded ${attempts.length} quiz attempts and ${masteryScores.length} mastery scores.`)
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
