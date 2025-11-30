-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ASSIGNMENT_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'ASSIGNMENT_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'MODERATOR_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'PATIENT_MEDIA_UPLOAD';
