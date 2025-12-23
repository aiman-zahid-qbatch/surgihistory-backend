-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "profileImage" TEXT,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BlacklistedToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "cnic" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "fatherName" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "whatsappNumber" TEXT,
    "address" TEXT NOT NULL,
    "assignedSurgeonId" TEXT,
    "assignedModeratorId" TEXT,
    "createdById" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "archivedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Patient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Patient_assignedSurgeonId_fkey" FOREIGN KEY ("assignedSurgeonId") REFERENCES "Surgeon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Patient_assignedModeratorId_fkey" FOREIGN KEY ("assignedModeratorId") REFERENCES "Moderator" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Patient_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Surgeon" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PatientModerator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,
    "respondedAt" DATETIME,
    CONSTRAINT "PatientModerator_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PatientModerator_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "Moderator" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Surgeon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "specialization" TEXT,
    "contactNumber" TEXT NOT NULL,
    "whatsappNumber" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "archivedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Surgeon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Moderator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "whatsappNumber" TEXT,
    "canAddRecords" BOOLEAN NOT NULL DEFAULT true,
    "canEditRecords" BOOLEAN NOT NULL DEFAULT false,
    "canDeleteRecords" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "archivedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Moderator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModeratorAvailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "moderatorId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ModeratorAvailability_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "Moderator" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Surgery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "surgeonId" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "customDiagnosis" TEXT,
    "briefHistory" TEXT NOT NULL,
    "preOpFindings" TEXT NOT NULL,
    "procedureName" TEXT NOT NULL,
    "customProcedure" TEXT,
    "procedureDetails" TEXT NOT NULL,
    "surgeryRole" TEXT NOT NULL,
    "surgeryDate" DATETIME NOT NULL,
    "surgeryTime" TEXT,
    "visibility" TEXT NOT NULL,
    "allowPatientExport" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "archivedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL,
    "lastModifiedBy" TEXT,
    CONSTRAINT "Surgery_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Surgery_surgeonId_fkey" FOREIGN KEY ("surgeonId") REFERENCES "Surgeon" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surgeryId" TEXT NOT NULL,
    "surgeonId" TEXT NOT NULL,
    "followUpDate" DATETIME NOT NULL,
    "scheduledTime" TEXT,
    "description" TEXT NOT NULL,
    "observations" TEXT,
    "status" TEXT NOT NULL,
    "lastDoctorUpdate" DATETIME,
    "lastPatientUpdate" DATETIME,
    "visibility" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "archivedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL,
    "lastModifiedBy" TEXT,
    CONSTRAINT "FollowUp_surgeryId_fkey" FOREIGN KEY ("surgeryId") REFERENCES "Surgery" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FollowUp_surgeonId_fkey" FOREIGN KEY ("surgeonId") REFERENCES "Surgeon" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "followUpId" TEXT,
    "patientId" TEXT,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "fileSize" INTEGER NOT NULL,
    "duration" INTEGER,
    "hasTranscription" BOOLEAN NOT NULL DEFAULT false,
    "transcriptionText" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedByRole" TEXT NOT NULL,
    "uploadedByName" TEXT,
    "visibility" TEXT NOT NULL,
    "includeInExport" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Media_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "FollowUp" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Media_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PatientUpload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "fileSize" INTEGER NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "isReviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" DATETIME,
    "reviewComment" TEXT,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "notificationReadAt" DATETIME,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatientUpload_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "surgeonId" TEXT,
    "followUpId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "status" TEXT NOT NULL,
    "uploadedMediaId" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedAt" DATETIME,
    "rejectedAt" DATETIME,
    "rejectionReason" TEXT,
    CONSTRAINT "DocumentRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentRequest_surgeonId_fkey" FOREIGN KEY ("surgeonId") REFERENCES "Surgeon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DocumentRequest_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "FollowUp" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentRequest_uploadedMediaId_fkey" FOREIGN KEY ("uploadedMediaId") REFERENCES "Media" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrivateNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "followUpId" TEXT,
    "surgeryId" TEXT,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "audioUrl" TEXT,
    "audioDuration" INTEGER,
    "hasTranscription" BOOLEAN NOT NULL DEFAULT false,
    "transcriptionText" TEXT,
    "attachments" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PrivateNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PrivateNote_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "FollowUp" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "followUpId" TEXT,
    "recipientId" TEXT NOT NULL,
    "recipientRole" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientPhone" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "scheduledFor" DATETIME NOT NULL,
    "sentAt" DATETIME,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringPattern" TEXT,
    "daysBefore" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" DATETIME,
    "errorMessage" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reminder_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "FollowUp" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipientId" TEXT NOT NULL,
    "recipientRole" TEXT NOT NULL,
    "patientId" TEXT,
    "surgeonId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "showBadge" BOOLEAN NOT NULL DEFAULT true,
    "badgeColor" TEXT NOT NULL DEFAULT 'red',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    CONSTRAINT "Notification_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_surgeonId_fkey" FOREIGN KEY ("surgeonId") REFERENCES "Surgeon" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" TEXT,
    "description" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestMethod" TEXT,
    "requestPath" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PDFExport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestedBy" TEXT NOT NULL,
    "requestedByRole" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "surgeryIds" TEXT,
    "followUpIds" TEXT,
    "includeConfig" TEXT NOT NULL,
    "exportType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "isPasswordProtected" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "expiresAt" DATETIME,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "maxDownloads" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "dataType" TEXT NOT NULL DEFAULT 'string',
    "category" TEXT,
    "description" TEXT,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BlacklistedToken_token_key" ON "BlacklistedToken"("token");

-- CreateIndex
CREATE INDEX "BlacklistedToken_token_idx" ON "BlacklistedToken"("token");

-- CreateIndex
CREATE INDEX "BlacklistedToken_expiresAt_idx" ON "BlacklistedToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_userId_key" ON "Patient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_patientId_key" ON "Patient"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_cnic_key" ON "Patient"("cnic");

-- CreateIndex
CREATE INDEX "Patient_cnic_idx" ON "Patient"("cnic");

-- CreateIndex
CREATE INDEX "Patient_assignedSurgeonId_idx" ON "Patient"("assignedSurgeonId");

-- CreateIndex
CREATE INDEX "Patient_assignedModeratorId_idx" ON "Patient"("assignedModeratorId");

-- CreateIndex
CREATE INDEX "Patient_createdById_idx" ON "Patient"("createdById");

-- CreateIndex
CREATE INDEX "Patient_patientId_idx" ON "Patient"("patientId");

-- CreateIndex
CREATE INDEX "Patient_fullName_idx" ON "Patient"("fullName");

-- CreateIndex
CREATE INDEX "PatientModerator_patientId_idx" ON "PatientModerator"("patientId");

-- CreateIndex
CREATE INDEX "PatientModerator_moderatorId_idx" ON "PatientModerator"("moderatorId");

-- CreateIndex
CREATE INDEX "PatientModerator_status_idx" ON "PatientModerator"("status");

-- CreateIndex
CREATE INDEX "PatientModerator_moderatorId_status_idx" ON "PatientModerator"("moderatorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PatientModerator_patientId_moderatorId_key" ON "PatientModerator"("patientId", "moderatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Surgeon_userId_key" ON "Surgeon"("userId");

-- CreateIndex
CREATE INDEX "Surgeon_fullName_idx" ON "Surgeon"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "Moderator_userId_key" ON "Moderator"("userId");

-- CreateIndex
CREATE INDEX "Moderator_fullName_idx" ON "Moderator"("fullName");

-- CreateIndex
CREATE INDEX "ModeratorAvailability_moderatorId_idx" ON "ModeratorAvailability"("moderatorId");

-- CreateIndex
CREATE INDEX "ModeratorAvailability_dayOfWeek_idx" ON "ModeratorAvailability"("dayOfWeek");

-- CreateIndex
CREATE INDEX "ModeratorAvailability_moderatorId_dayOfWeek_idx" ON "ModeratorAvailability"("moderatorId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "Surgery_patientId_idx" ON "Surgery"("patientId");

-- CreateIndex
CREATE INDEX "Surgery_surgeonId_idx" ON "Surgery"("surgeonId");

-- CreateIndex
CREATE INDEX "Surgery_surgeryDate_idx" ON "Surgery"("surgeryDate");

-- CreateIndex
CREATE INDEX "Surgery_diagnosis_idx" ON "Surgery"("diagnosis");

-- CreateIndex
CREATE INDEX "Surgery_procedureName_idx" ON "Surgery"("procedureName");

-- CreateIndex
CREATE INDEX "FollowUp_surgeryId_idx" ON "FollowUp"("surgeryId");

-- CreateIndex
CREATE INDEX "FollowUp_surgeonId_idx" ON "FollowUp"("surgeonId");

-- CreateIndex
CREATE INDEX "FollowUp_followUpDate_idx" ON "FollowUp"("followUpDate");

-- CreateIndex
CREATE INDEX "FollowUp_status_idx" ON "FollowUp"("status");

-- CreateIndex
CREATE INDEX "Media_followUpId_idx" ON "Media"("followUpId");

-- CreateIndex
CREATE INDEX "Media_patientId_idx" ON "Media"("patientId");

-- CreateIndex
CREATE INDEX "Media_uploadedBy_idx" ON "Media"("uploadedBy");

-- CreateIndex
CREATE INDEX "Media_fileType_idx" ON "Media"("fileType");

-- CreateIndex
CREATE INDEX "Media_createdAt_idx" ON "Media"("createdAt");

-- CreateIndex
CREATE INDEX "PatientUpload_patientId_idx" ON "PatientUpload"("patientId");

-- CreateIndex
CREATE INDEX "PatientUpload_isReviewed_idx" ON "PatientUpload"("isReviewed");

-- CreateIndex
CREATE INDEX "PatientUpload_notificationSent_idx" ON "PatientUpload"("notificationSent");

-- CreateIndex
CREATE INDEX "PatientUpload_createdAt_idx" ON "PatientUpload"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRequest_uploadedMediaId_key" ON "DocumentRequest"("uploadedMediaId");

-- CreateIndex
CREATE INDEX "DocumentRequest_patientId_idx" ON "DocumentRequest"("patientId");

-- CreateIndex
CREATE INDEX "DocumentRequest_surgeonId_idx" ON "DocumentRequest"("surgeonId");

-- CreateIndex
CREATE INDEX "DocumentRequest_status_idx" ON "DocumentRequest"("status");

-- CreateIndex
CREATE INDEX "DocumentRequest_followUpId_idx" ON "DocumentRequest"("followUpId");

-- CreateIndex
CREATE INDEX "DocumentRequest_requestedAt_idx" ON "DocumentRequest"("requestedAt");

-- CreateIndex
CREATE INDEX "PrivateNote_patientId_idx" ON "PrivateNote"("patientId");

-- CreateIndex
CREATE INDEX "PrivateNote_followUpId_idx" ON "PrivateNote"("followUpId");

-- CreateIndex
CREATE INDEX "PrivateNote_surgeryId_idx" ON "PrivateNote"("surgeryId");

-- CreateIndex
CREATE INDEX "PrivateNote_createdAt_idx" ON "PrivateNote"("createdAt");

-- CreateIndex
CREATE INDEX "PrivateNote_createdBy_idx" ON "PrivateNote"("createdBy");

-- CreateIndex
CREATE INDEX "Reminder_scheduledFor_status_idx" ON "Reminder"("scheduledFor", "status");

-- CreateIndex
CREATE INDEX "Reminder_recipientId_idx" ON "Reminder"("recipientId");

-- CreateIndex
CREATE INDEX "Reminder_followUpId_idx" ON "Reminder"("followUpId");

-- CreateIndex
CREATE INDEX "Reminder_status_idx" ON "Reminder"("status");

-- CreateIndex
CREATE INDEX "Reminder_channel_idx" ON "Reminder"("channel");

-- CreateIndex
CREATE INDEX "Notification_recipientId_isRead_idx" ON "Notification"("recipientId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_patientId_idx" ON "Notification"("patientId");

-- CreateIndex
CREATE INDEX "Notification_surgeonId_idx" ON "Notification"("surgeonId");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_success_idx" ON "AuditLog"("success");

-- CreateIndex
CREATE INDEX "PDFExport_patientId_idx" ON "PDFExport"("patientId");

-- CreateIndex
CREATE INDEX "PDFExport_requestedBy_idx" ON "PDFExport"("requestedBy");

-- CreateIndex
CREATE INDEX "PDFExport_createdAt_idx" ON "PDFExport"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE INDEX "SystemSetting_category_idx" ON "SystemSetting"("category");

-- CreateIndex
CREATE INDEX "SystemSetting_key_idx" ON "SystemSetting"("key");
