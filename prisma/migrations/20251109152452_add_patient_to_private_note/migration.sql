/*
  Warnings:

  - Added the required column `patientId` to the `PrivateNote` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PrivateNote" ADD COLUMN     "patientId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "PrivateNote_patientId_idx" ON "PrivateNote"("patientId");

-- AddForeignKey
ALTER TABLE "PrivateNote" ADD CONSTRAINT "PrivateNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
