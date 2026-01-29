import { Router } from 'express';
import patientController from '../controllers/patientController';
import { authenticate, authorize, UserRole } from '../middlewares/auth';
import { userController } from '../controllers/userController';

const router = Router();

// All patient routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/patients/moderators
 * @desc    Get all moderators for patient assignment
 * @access  Private (Surgeon, Admin)
 */
router.get(
  '/moderators',
  authorize(UserRole.SURGEON, UserRole.ADMIN),
  userController.getAllModerators.bind(userController)
);

/**
 * @route   GET /api/patients/surgeons
 * @desc    Get all surgeons for patient assignment (admin only)
 * @access  Private (Admin)
 */
router.get(
  '/surgeons',
  authorize(UserRole.ADMIN),
  userController.getAllSurgeons.bind(userController)
);

/**
 * @route   GET /api/patients/moderator/assigned
 * @desc    Get patients assigned to the current moderator
 * @access  Private (Moderator only)
 */
router.get(
  '/moderator/assigned',
  authorize(UserRole.MODERATOR),
  patientController.getModeratorAssignedPatients
);

/**
 * @route   GET /api/patients/search
 * @desc    Search patients by name, email, CNIC, or patient ID
 * @access  Private (Surgeon, Moderator, Admin)
 * @query   q - Search query string
 */
router.get(
  '/search',
  authorize(UserRole.SURGEON, UserRole.MODERATOR, UserRole.ADMIN),
  patientController.searchPatients
);

/**
 * @route   GET /api/patients
 * @desc    Get all patients (excluding archived)
 * @access  Private (Surgeon, Moderator, Admin)
 */
router.get(
  '/',
  authorize(UserRole.SURGEON, UserRole.MODERATOR, UserRole.ADMIN),
  patientController.getAllPatients
);

/**
 * @route   GET /api/patients/:id
 * @desc    Get patient by ID
 * @access  Private (Patient can view own profile, Surgeon/Moderator/Admin can view all)
 */
router.get(
  '/:id',
  authorize(UserRole.PATIENT, UserRole.SURGEON, UserRole.MODERATOR, UserRole.ADMIN),
  patientController.getPatient
);

/**
 * @route   POST /api/patients
 * @desc    Create new patient
 * @access  Private (Surgeon, Moderator, Admin)
 */
router.post(
  '/',
  authorize(UserRole.SURGEON, UserRole.MODERATOR, UserRole.ADMIN),
  patientController.createPatient
);

/**
 * @route   PUT /api/patients/:id
 * @desc    Update patient information
 * @access  Private (Surgeon, Moderator, Admin)
 */
router.put(
  '/:id',
  authorize(UserRole.SURGEON, UserRole.MODERATOR, UserRole.ADMIN),
  patientController.updatePatient
);

/**
 * @route   DELETE /api/patients/:id
 * @desc    Archive patient (soft delete)
 * @access  Private (Admin only)
 */
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  patientController.archivePatient
);

export default router;
