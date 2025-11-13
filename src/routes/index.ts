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

export default router;
