/*
  Warnings:

  - You are about to drop the column `doctorId` on the `PrivateNote` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "PrivateNote" DROP CONSTRAINT IF EXISTS "PrivateNote_doctorId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "PrivateNote_doctorId_idx";

-- AlterTable
ALTER TABLE "PrivateNote" DROP COLUMN "doctorId";
