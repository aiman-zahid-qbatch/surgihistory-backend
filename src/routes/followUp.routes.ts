import { Router } from 'express';
import followUpController from '../controllers/followUpController';
import { authenticate, authorize, UserRole } from '../middlewares/auth';

const router = Router();

// All follow-up routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/follow-ups/search
 * @desc    Search follow-ups by description, observations, or patient name
 * @access  Private (Doctor, Moderator, Admin)
 * @query   q - Search query string
 */
router.get(
  '/search',
  authorize(UserRole.DOCTOR, UserRole.MODERATOR, UserRole.ADMIN),
  followUpController.searchFollowUps
);

/**
 * @route   GET /api/follow-ups/upcoming
 * @desc    Get upcoming follow-ups for reminders
 * @access  Private (Doctor, Moderator, Admin)
 * @query   days - Number of days ahead (default: 7)
 */
router.get(
  '/upcoming',
  authorize(UserRole.DOCTOR, UserRole.MODERATOR, UserRole.ADMIN),
  followUpController.getUpcomingFollowUps
);

/**
 * @route   GET /api/follow-ups/surgery/:surgeryId
 * @desc    Get all follow-ups for a specific surgery
 * @access  Private (Patient can view own, Doctor/Moderator/Admin can view all)
 */
router.get(
  '/surgery/:surgeryId',
  authorize(UserRole.PATIENT, UserRole.DOCTOR, UserRole.MODERATOR, UserRole.ADMIN),
  followUpController.getFollowUpsBySurgery
);

/**
 * @route   GET /api/follow-ups/doctor/:doctorId
 * @desc    Get all follow-ups for a specific doctor
 * @access  Private (Doctor, Moderator, Admin)
 * @query   status - Optional: filter by status (PENDING, COMPLETED, MISSED)
 */
router.get(
  '/doctor/:doctorId',
  authorize(UserRole.DOCTOR, UserRole.MODERATOR, UserRole.ADMIN),
  followUpController.getFollowUpsByDoctor
);

/**
 * @route   GET /api/follow-ups/patient/:patientId
 * @desc    Get all follow-ups for a specific patient (only public visibility)
 * @access  Private (Patient can view own, Doctor/Moderator/Admin can view all)
 */
router.get(
  '/patient/:patientId',
  authorize(UserRole.PATIENT, UserRole.DOCTOR, UserRole.MODERATOR, UserRole.ADMIN),
  followUpController.getFollowUpsByPatient
);

/**
 * @route   GET /api/follow-ups/:id
 * @desc    Get follow-up by ID with full details
 * @access  Private (Patient can view own public follow-ups, Doctor/Moderator/Admin can view all)
 */
router.get(
  '/:id',
  authorize(UserRole.PATIENT, UserRole.DOCTOR, UserRole.MODERATOR, UserRole.ADMIN),
  followUpController.getFollowUp
);

/**
 * @route   POST /api/follow-ups
 * @desc    Create new follow-up record
 * @access  Private (Doctor, Moderator with add permission, Admin)
 */
router.post(
  '/',
  authorize(UserRole.DOCTOR, UserRole.MODERATOR, UserRole.ADMIN),
  followUpController.createFollowUp
);

/**
 * @route   PUT /api/follow-ups/:id
 * @desc    Update follow-up record
 * @access  Private (Doctor, Moderator with edit permission, Admin)
 */
router.put(
  '/:id',
  authorize(UserRole.DOCTOR, UserRole.MODERATOR, UserRole.ADMIN),
  followUpController.updateFollowUp
);

/**
 * @route   PATCH /api/follow-ups/:id/status
 * @desc    Update follow-up status only
 * @access  Private (Doctor, Moderator, Admin)
 */
router.patch(
  '/:id/status',
  authorize(UserRole.DOCTOR, UserRole.MODERATOR, UserRole.ADMIN),
  followUpController.updateFollowUpStatus
);

/**
 * @route   DELETE /api/follow-ups/:id
 * @desc    Archive follow-up record (soft delete)
 * @access  Private (Doctor, Admin only)
 */
router.delete(
  '/:id',
  authorize(UserRole.DOCTOR, UserRole.ADMIN),
  followUpController.archiveFollowUp
);

export default router;
