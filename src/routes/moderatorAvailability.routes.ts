import { Router } from 'express';
import moderatorAvailabilityController from '../controllers/moderatorAvailabilityController';
import { authenticate, authorize, UserRole } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/moderator-availability/moderators
 * @desc    Get all moderators with their availability (for surgeons)
 * @access  Private (Surgeon, Admin)
 * @query   dayOfWeek - (optional) Day of week (0-6)
 * @query   time - (optional) Time in HH:MM format
 */
router.get(
  '/moderators',
  authorize(UserRole.SURGEON, UserRole.ADMIN),
  moderatorAvailabilityController.getModeratorsAvailability
);

/**
 * @route   GET /api/moderator-availability/my-availability
 * @desc    Get availability for current moderator
 * @access  Private (Moderator)
 */
router.get(
  '/my-availability',
  authorize(UserRole.MODERATOR),
  moderatorAvailabilityController.getMyAvailability
);

/**
 * @route   POST /api/moderator-availability/my-availability
 * @desc    Set availability for current moderator
 * @access  Private (Moderator)
 */
router.post(
  '/my-availability',
  authorize(UserRole.MODERATOR),
  moderatorAvailabilityController.setMyAvailability
);

/**
 * @route   PUT /api/moderator-availability/:id
 * @desc    Update a specific availability slot
 * @access  Private (Moderator - own availability only)
 */
router.put(
  '/:id',
  authorize(UserRole.MODERATOR),
  moderatorAvailabilityController.updateAvailability
);

/**
 * @route   DELETE /api/moderator-availability/:id
 * @desc    Delete a specific availability slot
 * @access  Private (Moderator - own availability only)
 */
router.delete(
  '/:id',
  authorize(UserRole.MODERATOR),
  moderatorAvailabilityController.deleteAvailability
);

export default router;
