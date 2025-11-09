import { Router } from 'express';
import patientController from '../controllers/patientController';
import { authenticate, authorize, UserRole } from '../middlewares/auth';

const router = Router();

// All patient routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/patients/search
 * @desc    Search patients by name, email, CNIC, or patient ID
 * @access  Private (Doctor, Surgeon, Moderator, Admin)
 * @query   q - Search query string
 */
router.get(
  '/search',
  authorize(UserRole.DOCTOR, UserRole.SURGEON, UserRole.MODERATOR, UserRole.ADMIN),
  patientController.searchPatients
);

/**
 * @route   GET /api/patients
 * @desc    Get all patients (excluding archived)
 * @access  Private (Doctor, Surgeon, Moderator, Admin)
 */
router.get(
  '/',
  authorize(UserRole.DOCTOR, UserRole.SURGEON, UserRole.MODERATOR, UserRole.ADMIN),
  patientController.getAllPatients
);

/**
 * @route   GET /api/patients/:id
 * @desc    Get patient by ID
 * @access  Private (Patient can view own profile, Doctor/Surgeon/Moderator/Admin can view all)
 */
router.get(
  '/:id',
  authorize(UserRole.PATIENT, UserRole.DOCTOR, UserRole.SURGEON, UserRole.MODERATOR, UserRole.ADMIN),
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
