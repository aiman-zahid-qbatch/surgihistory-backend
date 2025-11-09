-- DropForeignKey
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_createdById_fkey";

-- AlterTable
ALTER TABLE "Patient" ALTER COLUMN "createdById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
