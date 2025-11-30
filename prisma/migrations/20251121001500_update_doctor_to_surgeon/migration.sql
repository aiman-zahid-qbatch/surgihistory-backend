-- Step 1: Rename DoctorRole enum to SurgeryRole
ALTER TYPE "DoctorRole" RENAME TO "SurgeryRole";

-- Step 2: Rename Doctor table to Surgeon
ALTER TABLE "Doctor" RENAME TO "Surgeon";

-- Step 3: Rename Doctor indexes
ALTER INDEX "Doctor_pkey" RENAME TO "Surgeon_pkey";
ALTER INDEX "Doctor_userId_key" RENAME TO "Surgeon_userId_key";
ALTER INDEX "Doctor_fullName_idx" RENAME TO "Surgeon_fullName_idx";

-- Step 4: Update Patient table - rename assignedDoctorId to assignedSurgeonId
ALTER TABLE "Patient" RENAME COLUMN "assignedDoctorId" TO "assignedSurgeonId";
ALTER INDEX "Patient_assignedDoctorId_idx" RENAME TO "Patient_assignedSurgeonId_idx";

-- Step 5: Drop and recreate foreign key constraints in Patient table
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_assignedDoctorId_fkey";
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_assignedSurgeonId_fkey"
  FOREIGN KEY ("assignedSurgeonId") REFERENCES "Surgeon"(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "Patient" DROP CONSTRAINT "Patient_createdById_fkey";
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "Surgeon"(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- Step 6: Update Surgery table - rename doctorId to surgeonId and doctorRole to surgeryRole
ALTER TABLE "Surgery" RENAME COLUMN "doctorId" TO "surgeonId";
ALTER TABLE "Surgery" RENAME COLUMN "doctorRole" TO "surgeryRole";
ALTER INDEX "Surgery_doctorId_idx" RENAME TO "Surgery_surgeonId_idx";

-- Step 7: Drop and recreate foreign key constraint in Surgery table
ALTER TABLE "Surgery" DROP CONSTRAINT "Surgery_doctorId_fkey";
ALTER TABLE "Surgery" ADD CONSTRAINT "Surgery_surgeonId_fkey"
  FOREIGN KEY ("surgeonId") REFERENCES "Surgeon"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- Step 8: Update FollowUp table - rename doctorId to surgeonId
ALTER TABLE "FollowUp" RENAME COLUMN "doctorId" TO "surgeonId";
ALTER INDEX "FollowUp_doctorId_idx" RENAME TO "FollowUp_surgeonId_idx";

-- Step 9: Drop and recreate foreign key constraint in FollowUp table
ALTER TABLE "FollowUp" DROP CONSTRAINT "FollowUp_doctorId_fkey";
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_surgeonId_fkey"
  FOREIGN KEY ("surgeonId") REFERENCES "Surgeon"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- Step 10: Update Notification table - rename doctorId to surgeonId
ALTER TABLE "Notification" RENAME COLUMN "doctorId" TO "surgeonId";
ALTER INDEX "Notification_doctorId_idx" RENAME TO "Notification_surgeonId_idx";

-- Step 11: Drop and recreate foreign key constraint in Notification table
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_doctorId_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_surgeonId_fkey"
  FOREIGN KEY ("surgeonId") REFERENCES "Surgeon"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- Step 12: Update UserRole enum - add SURGEON if it doesn't exist, then update any DOCTOR values
DO $$
BEGIN
  -- Add SURGEON to enum if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SURGEON' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')) THEN
    ALTER TYPE "UserRole" ADD VALUE 'SURGEON';
  END IF;
END$$;

-- Update any User records with DOCTOR role to SURGEON
UPDATE "User" SET role = 'SURGEON'::"UserRole" WHERE role = 'DOCTOR'::"UserRole";

-- Note: We cannot remove DOCTOR from the enum in this migration due to PostgreSQL limitations
-- The DOCTOR value in the enum will remain but won't be used
