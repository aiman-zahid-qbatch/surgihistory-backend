-- CreateTable
CREATE TABLE "ModeratorAvailability" (
    "id" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeratorAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModeratorAvailability_moderatorId_idx" ON "ModeratorAvailability"("moderatorId");

-- CreateIndex
CREATE INDEX "ModeratorAvailability_dayOfWeek_idx" ON "ModeratorAvailability"("dayOfWeek");

-- CreateIndex
CREATE INDEX "ModeratorAvailability_moderatorId_dayOfWeek_idx" ON "ModeratorAvailability"("moderatorId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "ModeratorAvailability" ADD CONSTRAINT "ModeratorAvailability_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "Moderator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
