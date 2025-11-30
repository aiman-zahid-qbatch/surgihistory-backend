-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ASSIGNMENT_REQUEST';

-- AlterTable
ALTER TABLE "PatientModerator" ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "PatientModerator_status_idx" ON "PatientModerator"("status");

-- CreateIndex
CREATE INDEX "PatientModerator_moderatorId_status_idx" ON "PatientModerator"("moderatorId", "status");
