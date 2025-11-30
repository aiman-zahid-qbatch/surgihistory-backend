import { Router } from 'express';
import authRoutes from './auth.routes';
import patientRoutes from './patient.routes';
import surgeryRoutes from './surgery.routes';
import followUpRoutes from './followUp.routes';
import mediaRoutes from './media.routes';
import privateNoteRoutes from './privateNote.routes';
import patientUploadRoutes from './patientUpload.routes';
import userRoutes from './user.routes';
import profileRoutes from './profile.routes';
import moderatorRoutes from './moderator.routes';
import reminderRoutes from './reminder.routes';
import moderatorAvailabilityRoutes from './moderatorAvailability.routes';
import patientModeratorRoutes from './patientModerator.routes';
import notificationRoutes from './notification.routes';
import documentRequestRoutes from './documentRequest.routes';
import auditLogRoutes from './auditLog.routes';
import whatsappRoutes from './whatsapp.routes';
import dashboardRoutes from './dashboard.routes';

const router = Router();

// Import route modules here
router.use('/auth', authRoutes);
router.use('/patients', patientRoutes);
router.use('/surgeries', surgeryRoutes);
router.use('/follow-ups', followUpRoutes);
router.use('/media', mediaRoutes);
router.use('/private-notes', privateNoteRoutes);
router.use('/patient-uploads', patientUploadRoutes);
router.use('/users', userRoutes);
router.use('/profile', profileRoutes);
router.use('/moderators', moderatorRoutes);
router.use('/reminders', reminderRoutes);
router.use('/moderator-availability', moderatorAvailabilityRoutes);
router.use('/patient-moderators', patientModeratorRoutes);
router.use('/notifications', notificationRoutes);
router.use('/document-requests', documentRequestRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
