-- CreateEnum
CREATE TYPE "MasteryStatus" AS ENUM ('MASTERED', 'DEVELOPING', 'NEEDS_PRACTICE', 'NOT_ENOUGH_DATA');

-- AlterTable
ALTER TABLE "MasteryScore" ADD COLUMN     "status" "MasteryStatus" NOT NULL DEFAULT 'NOT_ENOUGH_DATA';
