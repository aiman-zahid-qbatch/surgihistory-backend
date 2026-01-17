-- CreateTable
CREATE TABLE "PatientSurgeon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "surgeonId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,
    "respondedAt" DATETIME,
    CONSTRAINT "PatientSurgeon_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PatientSurgeon_surgeonId_fkey" FOREIGN KEY ("surgeonId") REFERENCES "Surgeon" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PatientSurgeon_patientId_idx" ON "PatientSurgeon"("patientId");

-- CreateIndex
CREATE INDEX "PatientSurgeon_surgeonId_idx" ON "PatientSurgeon"("surgeonId");

-- CreateIndex
CREATE INDEX "PatientSurgeon_status_idx" ON "PatientSurgeon"("status");

-- CreateIndex
CREATE INDEX "PatientSurgeon_surgeonId_status_idx" ON "PatientSurgeon"("surgeonId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PatientSurgeon_patientId_surgeonId_key" ON "PatientSurgeon"("patientId", "surgeonId");
