import { Router } from 'express';
import notificationController from '../controllers/notificationController';
import { authenticate, authorize, UserRole } from '../middlewares/auth';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for authenticated user
 * @access  Private (All authenticated users)
 * @query   isRead - Optional: filter by read status (true/false)
 */
router.get(
  '/',
  notificationController.getUserNotifications
);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private (All authenticated users)
 */
router.get(
  '/unread-count',
  notificationController.getUnreadCount
);

/**
 * @route   GET /api/notifications/:id
 * @desc    Get notification by ID
 * @access  Private (All authenticated users - own notifications only)
 */
router.get(
  '/:id',
  notificationController.getNotificationById
);

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private (All authenticated users - own notifications only)
 */
router.patch(
  '/:id/read',
  notificationController.markAsRead
);

/**
 * @route   PATCH /api/notifications/mark-multiple-read
 * @desc    Mark multiple notifications as read
 * @access  Private (All authenticated users - own notifications only)
 * @body    { ids: string[] }
 */
router.patch(
  '/mark-multiple-read',
  notificationController.markMultipleAsRead
);

/**
 * @route   POST /api/notifications/test
 * @desc    Create a test notification (for testing purposes)
 * @access  Private (Admin only)
 */
router.post(
  '/test',
  authorize(UserRole.ADMIN),
  notificationController.createTestNotification
);

/**
 * @route   DELETE /api/notifications/expired
 * @desc    Delete all expired notifications
 * @access  Private (Admin only)
 */
router.delete(
  '/expired',
  authorize(UserRole.ADMIN),
  notificationController.deleteExpiredNotifications
);

export default router;