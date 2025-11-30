import { Router } from 'express';
import surgeryController from '../controllers/surgeryController';
import { authenticate, authorize, UserRole } from '../middlewares/auth';

const router = Router();

// All surgery routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/surgeries
 * @desc    Get all surgeries (Admin only)
 * @access  Private (Admin)
 */
router.get(
  '/',
  authorize(UserRole.ADMIN),
  surgeryController.getAllSurgeries
);

/**
 * @route   GET /api/surgeries/search
 * @desc    Search surgeries by diagnosis or procedure name
 * @access  Private (Surgeon, Moderator, Admin)
 * @query   q - Search query string
 */
router.get(
  '/search',
  authorize(UserRole.SURGEON, UserRole.MODERATOR, UserRole.ADMIN),
  surgeryController.searchSurgeries
);

/**
 * @route   GET /api/surgeries/patient/:patientId
 * @desc    Get all surgeries for a specific patient
 * @access  Private (Patient can view own, Surgeon/Moderator/Admin can view all)
 */
router.get(
  '/patient/:patientId',
  authorize(UserRole.PATIENT, UserRole.SURGEON, UserRole.MODERATOR, UserRole.ADMIN),
  surgeryController.getSurgeriesByPatient
);

/**
 * @route   GET /api/surgeries/surgeon/:surgeonId
 * @desc    Get all surgeries performed by a specific surgeon
 * @access  Private (Surgeon, Moderator, Admin)
 */
router.get(
  '/surgeon/:surgeonId',
  authorize(UserRole.SURGEON, UserRole.MODERATOR, UserRole.ADMIN),
  surgeryController.getSurgeriesBySurgeon
);

/**
 * @route   GET /api/surgeries/:id
 * @desc    Get surgery by ID with full details
 * @access  Private (Patient can view own, Surgeon/Moderator/Admin can view all)
 */
router.get(
  '/:id',
  authorize(UserRole.PATIENT, UserRole.SURGEON, UserRole.MODERATOR, UserRole.ADMIN),
  surgeryController.getSurgery
);

/**
 * @route   POST /api/surgeries
 * @desc    Create new surgery record
 * @access  Private (Surgeon, Moderator with add permission, Admin)
 */
router.post(
  '/',
  authorize(UserRole.SURGEON, UserRole.MODERATOR, UserRole.ADMIN),
  surgeryController.createSurgery
);

/**
 * @route   PUT /api/surgeries/:id
 * @desc    Update surgery record
 * @access  Private (Surgeon, Moderator with edit permission, Admin)
 */
router.put(
  '/:id',
  authorize(UserRole.SURGEON, UserRole.MODERATOR, UserRole.ADMIN),
  surgeryController.updateSurgery
);

/**
 * @route   DELETE /api/surgeries/:id
 * @desc    Archive surgery record (soft delete)
 * @access  Private (Surgeon, Admin only)
 */
router.delete(
  '/:id',
  authorize(UserRole.SURGEON, UserRole.ADMIN),
  surgeryController.archiveSurgery
);

export default router;
