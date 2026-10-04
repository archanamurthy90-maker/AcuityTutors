-- DropIndex
DROP INDEX "QuizAttempt_practiceQuestionId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttempt_practiceQuestionId_key" ON "QuizAttempt"("practiceQuestionId");

