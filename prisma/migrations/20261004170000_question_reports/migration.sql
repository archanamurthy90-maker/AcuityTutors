-- CreateTable
CREATE TABLE "QuestionReport" (
    "id" TEXT NOT NULL,
    "practiceQuestionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reason" VARCHAR(300),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuestionReport_practiceQuestionId_key" ON "QuestionReport"("practiceQuestionId");

-- CreateIndex
CREATE INDEX "QuestionReport_studentId_createdAt_idx" ON "QuestionReport"("studentId", "createdAt");

-- AddForeignKey
ALTER TABLE "QuestionReport" ADD CONSTRAINT "QuestionReport_practiceQuestionId_fkey" FOREIGN KEY ("practiceQuestionId") REFERENCES "PracticeQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionReport" ADD CONSTRAINT "QuestionReport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

