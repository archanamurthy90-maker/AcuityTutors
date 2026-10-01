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
  { email: 'ava@acuity.local', password: 'StudentDemo!2026', displayName: 'Ava Chen', strong: [0, 3, 4, 7] },
  { email: 'noah@acuity.local', password: 'StudentDemo!2026', displayName: 'Noah Patel', strong: [1, 2, 4, 6] },
  { email: 'mia@acuity.local', password: 'StudentDemo!2026', displayName: 'Mia Brooks', strong: [0, 2, 5, 7] },
  { email: 'liam@acuity.local', password: 'StudentDemo!2026', displayName: 'Liam Rivera', strong: [1, 3, 4, 6] },
  { email: 'zoe@acuity.local', password: 'StudentDemo!2026', displayName: 'Zoe Kim', strong: [0, 1, 6, 7] },
  { email: 'ethan@acuity.local', password: 'StudentDemo!2026', displayName: 'Ethan Wilson', strong: [2, 3, 4, 5] },
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

const strongResults = [false, true, true, true, true, true]
const weakResults = [false, false, false, true, false, true]
const strongDifficulty = [
  Difficulty.BEGINNER,
  Difficulty.BEGINNER,
  Difficulty.INTERMEDIATE,
  Difficulty.INTERMEDIATE,
  Difficulty.ADVANCED,
  Difficulty.ADVANCED,
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
      const isStrong = student.strong.includes(topicIndex)
      const outcomes = isStrong ? strongResults : weakResults

      outcomes.forEach((isCorrect, attemptIndex) => {
        attempts.push({
          studentId: student.id,
          topicId: topic.id,
          isCorrect,
          difficulty: isStrong ? strongDifficulty[attemptIndex] : attemptIndex < 4 ? Difficulty.BEGINNER : Difficulty.INTERMEDIATE,
          source: 'QUIZ',
          response: isCorrect ? 'Correct answer submitted' : 'Incorrect answer submitted',
          responseTimeMs: 42000 + ((studentIndex * 13 + topicIndex * 7 + attemptIndex * 11) % 90000),
          attemptedAt: new Date(now - (35 - attemptIndex * 5) * 86400000 - studentIndex * 3600000),
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
