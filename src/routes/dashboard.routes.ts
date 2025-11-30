import { Router } from 'express';
import { dashboardController } from '../controllers/dashboardController';
import { authenticate, authorize, UserRole } from '../middlewares/auth';

const router = Router();

/**
 * @route   GET /api/dashboard/admin/stats
 * @desc    Get admin dashboard statistics
 * @access  Admin only
 */
router.get(
  '/admin/stats',
  authenticate,
  authorize(UserRole.ADMIN),
  dashboardController.getAdminStats
);

/**
 * @route   GET /api/dashboard/surgeon/stats
 * @desc    Get surgeon dashboard statistics
 * @access  Surgeon only
 */
router.get(
  '/surgeon/stats',
  authenticate,
  authorize(UserRole.SURGEON),
  dashboardController.getSurgeonStats
);

/**
 * @route   GET /api/dashboard/moderator/stats
 * @desc    Get moderator dashboard statistics
 * @access  Moderator only
 */
router.get(
  '/moderator/stats',
  authenticate,
  authorize(UserRole.MODERATOR),
  dashboardController.getModeratorStats
);

export default router;
