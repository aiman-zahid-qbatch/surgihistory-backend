import { Response, NextFunction } from 'express';
import notificationService from '../services/notificationService';
import { logger } from '../config/logger';
import { AuthRequest, UserRole } from '../middlewares/auth';

export class NotificationController {
  /**
   * Get all notifications for the authenticated user
   */
  async getUserNotifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { isRead } = req.query;

      const notifications = await notificationService.getNotificationsByUser(
        req.user.id,
        req.user.role,
        isRead === 'true' ? true : isRead === 'false' ? false : undefined
      );

      res.json({
        success: true,
        data: notifications,
      });
    } catch (error) {
      logger.error('Error fetching notifications:', error);
      next(error);
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const count = await notificationService.getUnreadCount(
        req.user.id,
        req.user.role
      );

      res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      logger.error('Error getting unread count:', error);
      next(error);
    }
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;

      const notification = await notificationService.getNotificationById(id);

      if (!notification) {
        res.status(404).json({
          success: false,
          message: 'Notification not found',
        });
        return;
      }

      // Verify the notification belongs to the user
      if (notification.recipientRole !== req.user.role) {
        res.status(403).json({
          success: false,
          message: 'Unauthorized access',
        });
        return;
      }

      res.json({
        success: true,
        data: notification,
      });
    } catch (error) {
      logger.error('Error fetching notification:', error);
      next(error);
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;

      // First verify the notification belongs to the user
      const notification = await notificationService.getNotificationById(id);

      if (!notification) {
        res.status(404).json({
          success: false,
          message: 'Notification not found',
        });
        return;
      }

      if (notification.recipientRole !== req.user.role) {
        res.status(403).json({
          success: false,
          message: 'Unauthorized access',
        });
        return;
      }

      const updatedNotification = await notificationService.markAsRead(id);

      res.json({
        success: true,
        data: updatedNotification,
      });
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      next(error);
    }
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid notification IDs',
        });
        return;
      }

      const count = await notificationService.markMultipleAsRead(ids);

      res.json({
        success: true,
        data: { count },
        message: `${count} notifications marked as read`,
      });
    } catch (error) {
      logger.error('Error marking notifications as read:', error);
      next(error);
    }
  }

  /**
   * Create a test notification (admin only)
   */
  async createTestNotification(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user || req.user.role !== UserRole.ADMIN) {
        res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
        return;
      }

      const { recipientId, recipientRole, type, title, message } = req.body;

      const notification = await notificationService.createNotification({
        recipientId,
        recipientRole,
        type,
        title,
        message,
        priority: 'normal',
        badgeColor: 'blue',
      });

      res.json({
        success: true,
        data: notification,
        message: 'Test notification created successfully',
      });
    } catch (error) {
      logger.error('Error creating test notification:', error);
      next(error);
    }
  }

  /**
   * Delete expired notifications (admin only)
   */
  async deleteExpiredNotifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user || req.user.role !== UserRole.ADMIN) {
        res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
        return;
      }

      const count = await notificationService.deleteExpiredNotifications();

      res.json({
        success: true,
        data: { count },
        message: `${count} expired notifications deleted`,
      });
    } catch (error) {
      logger.error('Error deleting expired notifications:', error);
      next(error);
    }
  }
}

export default new NotificationController();