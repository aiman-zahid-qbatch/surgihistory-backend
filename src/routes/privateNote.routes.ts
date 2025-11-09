import { Router } from 'express';
import privateNoteController from '../controllers/privateNoteController';
import { authenticate, authorize, UserRole } from '../middlewares/auth';

const router = Router();

// All private note routes require authentication
router.use(authenticate);

// All private note routes are DOCTOR-ONLY
router.use(authorize(UserRole.DOCTOR, UserRole.ADMIN));

/**
 * @route   GET /api/private-notes/search
 * @desc    Search private notes (own notes only)
 * @access  Private (Doctor, Admin only)
 * @query   q - Search query string
 */
router.get(
  '/search',
  privateNoteController.searchPrivateNotes
);

/**
 * @route   GET /api/private-notes/my-notes
 * @desc    Get all private notes for current doctor
 * @access  Private (Doctor, Admin only)
 */
router.get(
  '/my-notes',
  privateNoteController.getMyPrivateNotes
);

/**
 * @route   GET /api/private-notes/count
 * @desc    Get count of private notes for current doctor
 * @access  Private (Doctor, Admin only)
 */
router.get(
  '/count',
  privateNoteController.getPrivateNoteCount
);

/**
 * @route   GET /api/private-notes/follow-up/:followUpId
 * @desc    Get all private notes for a specific follow-up (own notes)
 * @access  Private (Doctor, Admin only)
 */
router.get(
  '/follow-up/:followUpId',
  privateNoteController.getPrivateNotesByFollowUp
);

/**
 * @route   GET /api/private-notes/surgery/:surgeryId
 * @desc    Get all private notes for a specific surgery (own notes)
 * @access  Private (Doctor, Admin only)
 */
router.get(
  '/surgery/:surgeryId',
  privateNoteController.getPrivateNotesBySurgery
);

/**
 * @route   GET /api/private-notes/:id
 * @desc    Get private note by ID (own notes only)
 * @access  Private (Doctor, Admin only)
 */
router.get(
  '/:id',
  privateNoteController.getPrivateNote
);

/**
 * @route   POST /api/private-notes
 * @desc    Create new private note
 * @access  Private (Doctor, Admin only)
 */
router.post(
  '/',
  privateNoteController.createPrivateNote
);

/**
 * @route   PUT /api/private-notes/:id
 * @desc    Update private note (own notes only)
 * @access  Private (Doctor, Admin only)
 */
router.put(
  '/:id',
  privateNoteController.updatePrivateNote
);

/**
 * @route   POST /api/private-notes/:id/transcription
 * @desc    Add transcription to private note
 * @access  Private (Doctor, Admin only)
 */
router.post(
  '/:id/transcription',
  privateNoteController.addTranscription
);

/**
 * @route   DELETE /api/private-notes/:id
 * @desc    Archive private note (soft delete, own notes only)
 * @access  Private (Doctor, Admin only)
 */
router.delete(
  '/:id',
  privateNoteController.archivePrivateNote
);

export default router;
