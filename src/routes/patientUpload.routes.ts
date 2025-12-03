import { Router } from 'express';
import patientUploadController from '../controllers/patientUploadController';
import { authenticate, authorize, UserRole } from '../middlewares/auth';
import { uploadSingle } from '../middlewares/upload';

const router = Router();

// All patient upload routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/patient-uploads/search
 * @desc    Search patient uploads
 * @access  Private (Moderator, Admin)
 * @query   q - Search query string
 * @query   patientId - Optional: filter by patient
 */
router.get(
  '/search',
  authorize(UserRole.MODERATOR, UserRole.ADMIN),
  patientUploadController.searchUploads
);

/**
 * @route   GET /api/patient-uploads/unreviewed
 * @desc    Get all unreviewed uploads
 * @access  Private (Moderator, Admin)
 * @query   doctorId - Optional: filter by assigned doctor
 */
router.get(
  '/unreviewed',
  authorize(UserRole.MODERATOR, UserRole.ADMIN),
  patientUploadController.getUnreviewedUploads
);

/**
 * @route   GET /api/patient-uploads/reviewed
 * @desc    Get all reviewed uploads
 * @access  Private (Moderator, Admin)
 * @query   doctorId - Optional: filter by assigned doctor
 */
router.get(
  '/reviewed',
  authorize(UserRole.MODERATOR, UserRole.ADMIN),
  patientUploadController.getReviewedUploads
);

/**
 * @route   GET /api/patient-uploads/notification-count
 * @desc    Get count of unread upload notifications
 * @access  Private (Moderator, Admin)
 * @query   doctorId - Optional: filter by assigned doctor
 */
router.get(
  '/notification-count',
  authorize(UserRole.MODERATOR, UserRole.ADMIN),
  patientUploadController.getUnreadNotificationCount
);

/**
 * @route   GET /api/patient-uploads/category/:category
 * @desc    Get uploads by category
 * @access  Private (Moderator, Admin)
 * @query   patientId - Optional: filter by patient
 */
router.get(
  '/category/:category',
  authorize(UserRole.MODERATOR, UserRole.ADMIN),
  patientUploadController.getUploadsByCategory
);

/**
 * @route   GET /api/patient-uploads/patient/:patientId
 * @desc    Get all uploads for a specific patient
 * @access  Private (Patient can view own, Moderator/Admin can view all)
 */
router.get(
  '/patient/:patientId',
  authorize(UserRole.PATIENT, UserRole.MODERATOR, UserRole.ADMIN),
  patientUploadController.getUploadsByPatient
);

/**
 * @route   GET /api/patient-uploads/patient/:patientId/stats
 * @desc    Get upload statistics for a patient
 * @access  Private (Moderator, Admin)
 */
router.get(
  '/patient/:patientId/stats',
  authorize(UserRole.MODERATOR, UserRole.ADMIN),
  patientUploadController.getUploadStats
);

/**
 * @route   GET /api/patient-uploads/:id
 * @desc    Get patient upload by ID
 * @access  Private (Patient can view own, Moderator/Admin can view all)
 */
router.get(
  '/:id',
  authorize(UserRole.PATIENT, UserRole.MODERATOR, UserRole.ADMIN),
  patientUploadController.getPatientUpload
);

/**
 * @route   GET /api/patient-uploads/:id/download
 * @desc    Download patient upload file
 * @access  Private (Patient can download own, Moderator/Admin can download all)
 */
router.get(
  '/:id/download',
  authorize(UserRole.PATIENT, UserRole.MODERATOR, UserRole.ADMIN),
  patientUploadController.downloadUpload
);

/**
 * @route   POST /api/patient-uploads/upload
 * @desc    Upload file by patient
 * @access  Private (Patient, Moderator, Admin)
 */
router.post(
  '/upload',
  authorize(UserRole.PATIENT, UserRole.MODERATOR, UserRole.ADMIN),
  uploadSingle,
  patientUploadController.uploadFile
);

/**
 * @route   POST /api/patient-uploads/:id/review
 * @desc    Review patient upload (mark as reviewed with optional comment)
 * @access  Private (Moderator, Admin)
 */
router.post(
  '/:id/review',
  authorize(UserRole.MODERATOR, UserRole.ADMIN),
  patientUploadController.reviewUpload
);

/**
 * @route   PATCH /api/patient-uploads/:id/mark-read
 * @desc    Mark upload notification as read
 * @access  Private (Moderator, Admin)
 */
router.patch(
  '/:id/mark-read',
  authorize(UserRole.MODERATOR, UserRole.ADMIN),
  patientUploadController.markNotificationRead
);

/**
 * @route   DELETE /api/patient-uploads/:id
 * @desc    Archive patient upload (soft delete)
 * @access  Private (Admin only)
 */
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  patientUploadController.archiveUpload
);

export default router;
