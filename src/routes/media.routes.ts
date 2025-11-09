import { Router } from 'express';
import mediaController from '../controllers/mediaController';
import { authenticate, authorize, UserRole } from '../middlewares/auth';
import { uploadSingle, uploadMultiple } from '../middlewares/upload';

const router = Router();

// All media routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/media/search
 * @desc    Search media by filename or transcription
 * @access  Private (Doctor, Moderator, Admin)
 * @query   q - Search query string
 */
router.get(
  '/search',
  authorize(UserRole.DOCTOR, UserRole.MODERATOR, UserRole.ADMIN),
  mediaController.searchMedia
);

/**
 * @route   GET /api/media/follow-up/:followUpId
 * @desc    Get all media for a specific follow-up
 * @access  Private (Patient can view public media, Doctor/Moderator/Admin can view all)
 */
router.get(
  '/follow-up/:followUpId',
  authorize(UserRole.PATIENT, UserRole.DOCTOR, UserRole.MODERATOR, UserRole.ADMIN),
  mediaController.getMediaByFollowUp
);

/**
 * @route   GET /api/media/follow-up/:followUpId/stats
 * @desc    Get media statistics for a follow-up
 * @access  Private (Doctor, Moderator, Admin)
 */
router.get(
  '/follow-up/:followUpId/stats',
  authorize(UserRole.DOCTOR, UserRole.MODERATOR, UserRole.ADMIN),
  mediaController.getMediaStats
);

/**
 * @route   GET /api/media/patient/:patientId
 * @desc    Get all media for a specific patient (across all follow-ups)
 * @access  Private (Patient can view own public media, Doctor/Moderator/Admin can view all)
 */
router.get(
  '/patient/:patientId',
  authorize(UserRole.PATIENT, UserRole.DOCTOR, UserRole.MODERATOR, UserRole.ADMIN),
  mediaController.getMediaByPatient
);

/**
 * @route   GET /api/media/uploader/:uploaderId
 * @desc    Get all media uploaded by a specific user
 * @access  Private (Doctor, Moderator, Admin)
 */
router.get(
  '/uploader/:uploaderId',
  authorize(UserRole.DOCTOR, UserRole.MODERATOR, UserRole.ADMIN),
  mediaController.getMediaByUploader
);

/**
 * @route   GET /api/media/:id
 * @desc    Get media by ID
 * @access  Private (Patient can view public media, Doctor/Moderator/Admin can view all)
 */
router.get(
  '/:id',
  authorize(UserRole.PATIENT, UserRole.DOCTOR, UserRole.MODERATOR, UserRole.ADMIN),
  mediaController.getMedia
);

/**
 * @route   GET /api/media/:id/download
 * @desc    Download media file
 * @access  Private (Patient can download public media, Doctor/Moderator/Admin can download all)
 */
router.get(
  '/:id/download',
  authorize(UserRole.PATIENT, UserRole.DOCTOR, UserRole.MODERATOR, UserRole.ADMIN),
  mediaController.downloadMedia
);

/**
 * @route   POST /api/media/upload
 * @desc    Upload single media file
 * @access  Private (Doctor, Patient, Moderator, Admin)
 */
router.post(
  '/upload',
  authorize(UserRole.PATIENT, UserRole.DOCTOR, UserRole.MODERATOR, UserRole.ADMIN),
  uploadSingle,
  mediaController.uploadMedia
);

/**
 * @route   POST /api/media/upload-multiple
 * @desc    Upload multiple media files (max 10)
 * @access  Private (Doctor, Patient, Moderator, Admin)
 */
router.post(
  '/upload-multiple',
  authorize(UserRole.PATIENT, UserRole.DOCTOR, UserRole.MODERATOR, UserRole.ADMIN),
  uploadMultiple,
  mediaController.uploadMultipleMedia
);

/**
 * @route   PUT /api/media/:id
 * @desc    Update media metadata
 * @access  Private (Doctor, Moderator, Admin)
 */
router.put(
  '/:id',
  authorize(UserRole.DOCTOR, UserRole.MODERATOR, UserRole.ADMIN),
  mediaController.updateMedia
);

/**
 * @route   POST /api/media/:id/transcription
 * @desc    Add transcription to audio/video media
 * @access  Private (Doctor, Admin)
 */
router.post(
  '/:id/transcription',
  authorize(UserRole.DOCTOR, UserRole.ADMIN),
  mediaController.addTranscription
);

/**
 * @route   DELETE /api/media/:id
 * @desc    Archive media (soft delete)
 * @access  Private (Doctor, Admin only)
 */
router.delete(
  '/:id',
  authorize(UserRole.DOCTOR, UserRole.ADMIN),
  mediaController.archiveMedia
);

export default router;
