-- DropForeignKey
ALTER TABLE "DocumentRequest" DROP CONSTRAINT "DocumentRequest_surgeonId_fkey";

-- AlterTable
ALTER TABLE "DocumentRequest" ALTER COLUMN "surgeonId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_surgeonId_fkey" FOREIGN KEY ("surgeonId") REFERENCES "Surgeon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
