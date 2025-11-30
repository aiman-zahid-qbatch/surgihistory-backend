-- CreateTable
CREATE TABLE "PatientModerator" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,

    CONSTRAINT "PatientModerator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientModerator_patientId_idx" ON "PatientModerator"("patientId");

-- CreateIndex
CREATE INDEX "PatientModerator_moderatorId_idx" ON "PatientModerator"("moderatorId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientModerator_patientId_moderatorId_key" ON "PatientModerator"("patientId", "moderatorId");

-- AddForeignKey
ALTER TABLE "PatientModerator" ADD CONSTRAINT "PatientModerator_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientModerator" ADD CONSTRAINT "PatientModerator_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "Moderator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
