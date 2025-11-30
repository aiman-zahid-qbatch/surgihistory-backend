/*
  Warnings:

  - Added the required column `createdBy` to the `PrivateNote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdByName` to the `PrivateNote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdByRole` to the `PrivateNote` table without a default value. This is not possible if the table is not empty.

*/

-- Step 1: Add columns as nullable first
ALTER TABLE "PrivateNote" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "PrivateNote" ADD COLUMN "createdByName" TEXT;
ALTER TABLE "PrivateNote" ADD COLUMN "createdByRole" "UserRole";

-- Step 2: Update existing rows - set createdBy to doctorId and populate creator info
UPDATE "PrivateNote" pn
SET
  "createdBy" = pn."doctorId",
  "createdByName" = d."fullName",
  "createdByRole" = u.role
FROM "Doctor" d
JOIN "User" u ON d."userId" = u.id
WHERE pn."doctorId" = d.id;

-- Step 3: Make columns NOT NULL
ALTER TABLE "PrivateNote" ALTER COLUMN "createdBy" SET NOT NULL;
ALTER TABLE "PrivateNote" ALTER COLUMN "createdByName" SET NOT NULL;
ALTER TABLE "PrivateNote" ALTER COLUMN "createdByRole" SET NOT NULL;

-- Step 4: Create index
CREATE INDEX "PrivateNote_createdBy_idx" ON "PrivateNote"("createdBy");
