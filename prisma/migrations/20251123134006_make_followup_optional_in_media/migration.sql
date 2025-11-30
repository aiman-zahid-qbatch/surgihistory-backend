/*
  Warnings:

  - The values [DOCTOR] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "DocumentRequestStatus" AS ENUM ('PENDING', 'UPLOADED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'DOCUMENT_UPLOADED';
ALTER TYPE "NotificationType" ADD VALUE 'DOCUMENT_REQUESTED';

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('PATIENT', 'MODERATOR', 'SURGEON', 'ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TABLE "Media" ALTER COLUMN "uploadedByRole" TYPE "UserRole_new" USING ("uploadedByRole"::text::"UserRole_new");
ALTER TABLE "PrivateNote" ALTER COLUMN "createdByRole" TYPE "UserRole_new" USING ("createdByRole"::text::"UserRole_new");
ALTER TABLE "Reminder" ALTER COLUMN "recipientRole" TYPE "UserRole_new" USING ("recipientRole"::text::"UserRole_new");
ALTER TABLE "Notification" ALTER COLUMN "recipientRole" TYPE "UserRole_new" USING ("recipientRole"::text::"UserRole_new");
ALTER TABLE "PDFExport" ALTER COLUMN "requestedByRole" TYPE "UserRole_new" USING ("requestedByRole"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
COMMIT;

-- AlterTable
ALTER TABLE "Media" ALTER COLUMN "followUpId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DocumentRequest" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "surgeonId" TEXT NOT NULL,
    "followUpId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "status" "DocumentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedMediaId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,

    CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRequest_uploadedMediaId_key" ON "DocumentRequest"("uploadedMediaId");

-- CreateIndex
CREATE INDEX "DocumentRequest_patientId_idx" ON "DocumentRequest"("patientId");

-- CreateIndex
CREATE INDEX "DocumentRequest_surgeonId_idx" ON "DocumentRequest"("surgeonId");

-- CreateIndex
CREATE INDEX "DocumentRequest_status_idx" ON "DocumentRequest"("status");

-- CreateIndex
CREATE INDEX "DocumentRequest_followUpId_idx" ON "DocumentRequest"("followUpId");

-- CreateIndex
CREATE INDEX "DocumentRequest_requestedAt_idx" ON "DocumentRequest"("requestedAt");

-- RenameForeignKey
ALTER TABLE "Surgeon" RENAME CONSTRAINT "Doctor_userId_fkey" TO "Surgeon_userId_fkey";

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_surgeonId_fkey" FOREIGN KEY ("surgeonId") REFERENCES "Surgeon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "FollowUp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_uploadedMediaId_fkey" FOREIGN KEY ("uploadedMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
