/*
  Warnings:

  - Added the required column `createdById` to the `Patient` table without a default value. This is not possible if the table is not empty.

*/

-- Step 1: Add the column as nullable first
ALTER TABLE "Patient" ADD COLUMN "createdById" TEXT;

-- Step 2: Get the first doctor ID and set it as default for existing patients
-- If no doctor exists, create a placeholder doctor entry
DO $$
DECLARE
  default_doctor_id TEXT;
  admin_user_id TEXT;
BEGIN
  -- Try to get an existing doctor
  SELECT id INTO default_doctor_id FROM "Doctor" LIMIT 1;
  
  -- If no doctor exists, create one from the first admin/surgeon user
  IF default_doctor_id IS NULL THEN
    -- Get the first admin or surgeon user
    SELECT id INTO admin_user_id FROM "User" WHERE role IN ('ADMIN', 'SURGEON', 'DOCTOR') LIMIT 1;
    
    -- If we have a user, create a doctor profile
    IF admin_user_id IS NOT NULL THEN
      INSERT INTO "Doctor" (id, "userId", "fullName", "contactNumber")
      VALUES (
        gen_random_uuid()::TEXT,
        admin_user_id,
        (SELECT COALESCE(name, email) FROM "User" WHERE id = admin_user_id),
        'N/A'
      )
      RETURNING id INTO default_doctor_id;
    END IF;
  END IF;
  
  -- Update existing patients with the default doctor
  IF default_doctor_id IS NOT NULL THEN
    UPDATE "Patient" SET "createdById" = default_doctor_id WHERE "createdById" IS NULL;
  END IF;
END $$;

-- Step 3: Make the column required
ALTER TABLE "Patient" ALTER COLUMN "createdById" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Patient_createdById_idx" ON "Patient"("createdById");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
