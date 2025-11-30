import { Router } from 'express';
import patientModeratorController from '../controllers/patientModeratorController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/patient-moderators/patient/:patientId
 * @desc    Get all moderators assigned to a patient
 * @access  Surgeon, Admin
 */
router.get(
  '/patient/:patientId',
  patientModeratorController.getPatientModerators
);

// Check if user is moderator
const requireModerator = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'MODERATOR') {
    return res.status(403).json({ message: 'Access denied. Moderator role required.' });
  }
  next();
};

router.use(requireModerator);

/**
 * @route   GET /api/patient-moderators/pending
 * @desc    Get pending assignment requests for current moderator
 * @access  Moderator
 */
router.get(
  '/pending',
  patientModeratorController.getPendingRequests
);

/**
 * @route   POST /api/patient-moderators/:id/accept
 * @desc    Accept a patient assignment
 * @access  Moderator
 */
router.post(
  '/:id/accept',
  patientModeratorController.acceptAssignment
);

/**
 * @route   POST /api/patient-moderators/:id/reject
 * @desc    Reject a patient assignment
 * @access  Moderator
 */
router.post(
  '/:id/reject',
  patientModeratorController.rejectAssignment
);

/**
 * @route   GET /api/patient-moderators/my-assignments
 * @desc    Get all assignments for current moderator (with optional status filter)
 * @access  Moderator
 */
router.get(
  '/my-assignments',
  patientModeratorController.getMyAssignments
);

/**
 * @route   GET /api/patient-moderators/counts
 * @desc    Get assignment counts for current moderator
 * @access  Moderator
 */
router.get(
  '/counts',
  patientModeratorController.getAssignmentCounts
);

export default router;
