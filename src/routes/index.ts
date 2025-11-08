import { Router } from 'express';
import authRoutes from './auth.routes';
import patientRoutes from './patient.routes';
import surgeryRoutes from './surgery.routes';

const router = Router();

// Import route modules here
router.use('/auth', authRoutes);
router.use('/patients', patientRoutes);
router.use('/surgeries', surgeryRoutes);

// import followUpRoutes from './followUp.routes';
// router.use('/follow-ups', followUpRoutes);

export default router;
