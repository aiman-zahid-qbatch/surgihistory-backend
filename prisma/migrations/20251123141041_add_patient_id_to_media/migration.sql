-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "patientId" TEXT;

-- CreateIndex
CREATE INDEX "Media_patientId_idx" ON "Media"("patientId");

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
