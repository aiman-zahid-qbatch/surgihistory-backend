import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { Notification } from '@prisma/client';
import { emitNotification } from '../config/socket';

interface CreateNotificationData {
  recipientId: string;
  recipientRole: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  priority?: string;
  badgeColor?: string;
  patientId?: string;
  surgeonId?: string;
}

class NotificationService {
  /**
   * Create a new notification
   */
  async createNotification(data: CreateNotificationData): Promise<Notification> {
    try {
      const notification = await prisma.notification.create({
        data: {
          recipientId: data.recipientId,
          recipientRole: data.recipientRole as any,
          type: data.type as any,
          title: data.title,
          message: data.message,
          entityType: data.entityType,
          entityId: data.entityId,
          priority: data.priority || 'normal',
          badgeColor: data.badgeColor || 'red',
          showBadge: true,
          patientId: data.patientId,
          surgeonId: data.surgeonId,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days expiry
        },
        include: {
          patient: true,
          surgeon: true,
        },
      });

      logger.info(`Notification created for ${data.recipientRole} ${data.recipientId}: ${data.title}`);

      // Emit real-time notification via Socket.IO
      try {
        // Get user ID from the recipient (patient/surgeon/moderator) ID
        let userId = data.recipientId;

        if (data.recipientRole === 'PATIENT') {
          const patient = await prisma.patient.findUnique({
            where: { id: data.recipientId },
            select: { userId: true },
          });
          if (patient) userId = patient.userId;
        } else if (data.recipientRole === 'SURGEON') {
          const surgeon = await prisma.surgeon.findUnique({
            where: { id: data.recipientId },
            select: { userId: true },
          });
          if (surgeon) userId = surgeon.userId;
        } else if (data.recipientRole === 'MODERATOR') {
          const moderator = await prisma.moderator.findUnique({
            where: { id: data.recipientId },
            select: { userId: true },
          });
          if (moderator) userId = moderator.userId;
        }

        emitNotification(userId, notification);
      } catch (socketError) {
        logger.error('Error emitting socket notification:', socketError);
        // Don't fail notification creation if socket emit fails
      }

      return notification;
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a specific user
   */
  async getNotificationsByUser(
    userId: string,
    role: string,
    isRead?: boolean
  ): Promise<Notification[]> {
    try {
      // First get the appropriate ID based on role
      let recipientId = userId;

      if (role === 'PATIENT') {
        const patient = await prisma.patient.findUnique({
          where: { userId },
          select: { id: true },
        });
        if (!patient) {
          return [];
        }
        recipientId = patient.id;
      } else if (role === 'SURGEON') {
        const surgeon = await prisma.surgeon.findUnique({
          where: { userId },
          select: { id: true },
        });
        if (!surgeon) {
          return [];
        }
        recipientId = surgeon.id;
      } else if (role === 'MODERATOR') {
        const moderator = await prisma.moderator.findUnique({
          where: { userId },
          select: { id: true },
        });
        if (!moderator) {
          return [];
        }
        recipientId = moderator.id;
      }

      const whereClause: any = {
        recipientId,
        recipientRole: role as any,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      };

      if (isRead !== undefined) {
        whereClause.isRead = isRead;
      }

      const notifications = await prisma.notification.findMany({
        where: whereClause,
        include: {
          patient: {
            select: {
              id: true,
              fullName: true,
              patientId: true,
            },
          },
          surgeon: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return notifications;
    } catch (error) {
      logger.error('Error getting notifications:', error);
      throw error;
    }
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(id: string): Promise<Notification | null> {
    try {
      const notification = await prisma.notification.findUnique({
        where: { id },
        include: {
          patient: true,
          surgeon: true,
        },
      });

      return notification;
    } catch (error) {
      logger.error('Error getting notification:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string): Promise<Notification> {
    try {
      const notification = await prisma.notification.update({
        where: { id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
        include: {
          patient: true,
          surgeon: true,
        },
      });

      logger.info(`Notification ${id} marked as read`);
      return notification;
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(ids: string[]): Promise<number> {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          id: { in: ids },
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      logger.info(`${result.count} notifications marked as read`);
      return result.count;
    } catch (error) {
      logger.error('Error marking notifications as read:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string, role: string): Promise<number> {
    try {
      // Get the appropriate ID based on role
      let recipientId = userId;

      if (role === 'PATIENT') {
        const patient = await prisma.patient.findUnique({
          where: { userId },
          select: { id: true },
        });
        if (!patient) {
          return 0;
        }
        recipientId = patient.id;
      } else if (role === 'SURGEON') {
        const surgeon = await prisma.surgeon.findUnique({
          where: { userId },
          select: { id: true },
        });
        if (!surgeon) {
          return 0;
        }
        recipientId = surgeon.id;
      } else if (role === 'MODERATOR') {
        const moderator = await prisma.moderator.findUnique({
          where: { userId },
          select: { id: true },
        });
        if (!moderator) {
          return 0;
        }
        recipientId = moderator.id;
      }

      const count = await prisma.notification.count({
        where: {
          recipientId,
          recipientRole: role as any,
          isRead: false,
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: new Date() } },
          ],
        },
      });

      return count;
    } catch (error) {
      logger.error('Error getting unread count:', error);
      throw error;
    }
  }

  /**
   * Delete expired notifications
   */
  async deleteExpiredNotifications(): Promise<number> {
    try {
      const result = await prisma.notification.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      if (result.count > 0) {
        logger.info(`Deleted ${result.count} expired notifications`);
      }

      return result.count;
    } catch (error) {
      logger.error('Error deleting expired notifications:', error);
      throw error;
    }
  }

  /**
   * Create follow-up reminder notification
   */
  async createFollowUpReminder(
    followUpId: string,
    patientUserId: string,
    surgeonUserId: string
  ): Promise<void> {
    try {
      // Get patient and surgeon data
      const patient = await prisma.patient.findUnique({
        where: { userId: patientUserId },
        select: { id: true, fullName: true },
      });

      const surgeon = await prisma.surgeon.findUnique({
        where: { userId: surgeonUserId },
        select: { id: true, fullName: true },
      });

      const followUp = await prisma.followUp.findUnique({
        where: { id: followUpId },
        include: {
          surgery: {
            include: {
              patient: true,
            },
          },
        },
      });

      if (!followUp || !patient || !surgeon) {
        throw new Error('Required data not found');
      }

      // Create notification for patient
      await this.createNotification({
        recipientId: patient.id,
        recipientRole: 'PATIENT',
        type: 'FOLLOW_UP_REMINDER',
        title: 'Upcoming Follow-up Appointment',
        message: `You have a follow-up appointment scheduled for ${followUp.followUpDate.toLocaleDateString()}`,
        entityType: 'follow_up',
        entityId: followUpId,
        priority: 'high',
        badgeColor: 'blue',
        patientId: patient.id,
        surgeonId: surgeon.id,
      });

      // Create notification for surgeon
      await this.createNotification({
        recipientId: surgeon.id,
        recipientRole: 'SURGEON',
        type: 'FOLLOW_UP_REMINDER',
        title: 'Patient Follow-up Scheduled',
        message: `Follow-up scheduled for patient ${patient.fullName} on ${followUp.followUpDate.toLocaleDateString()}`,
        entityType: 'follow_up',
        entityId: followUpId,
        priority: 'normal',
        badgeColor: 'blue',
        patientId: patient.id,
        surgeonId: surgeon.id,
      });
    } catch (error) {
      logger.error('Error creating follow-up reminder:', error);
      throw error;
    }
  }

  /**
   * Create notification for new patient upload
   */
  async createUploadNotification(
    uploadId: string,
    patientId: string,
    surgeonId?: string
  ): Promise<void> {
    try {
      const upload = await prisma.patientUpload.findUnique({
        where: { id: uploadId },
        include: {
          patient: true,
        },
      });

      if (!upload) {
        throw new Error('Upload not found');
      }

      // Notify surgeon if assigned
      if (surgeonId) {
        await this.createNotification({
          recipientId: surgeonId,
          recipientRole: 'SURGEON',
          type: 'NEW_UPLOAD',
          title: 'New Patient Upload',
          message: `Patient ${upload.patient.fullName} uploaded a new ${upload.category || 'document'}`,
          entityType: 'patient_upload',
          entityId: uploadId,
          priority: 'normal',
          badgeColor: 'green',
          patientId: patientId,
          surgeonId: surgeonId,
        });
      }

      // Notify patient of successful upload
      await this.createNotification({
        recipientId: patientId,
        recipientRole: 'PATIENT',
        type: 'NEW_UPLOAD',
        title: 'Upload Successful',
        message: 'Your document has been uploaded successfully and is pending review',
        entityType: 'patient_upload',
        entityId: uploadId,
        priority: 'low',
        badgeColor: 'green',
        patientId: patientId,
        surgeonId: surgeonId,
      });
    } catch (error) {
      logger.error('Error creating upload notification:', error);
      throw error;
    }
  }

  /**
   * Create notification for record update
   */
  async createUpdateNotification(
    entityType: string,
    entityId: string,
    patientId: string,
    updateMessage: string
  ): Promise<void> {
    try {
      await this.createNotification({
        recipientId: patientId,
        recipientRole: 'PATIENT',
        type: 'RECORD_UPDATE',
        title: 'Medical Record Updated',
        message: updateMessage,
        entityType,
        entityId,
        priority: 'normal',
        badgeColor: 'yellow',
        patientId,
      });
    } catch (error) {
      logger.error('Error creating update notification:', error);
      throw error;
    }
  }

  /**
   * Notify moderator when their account is created by a surgeon
   */
  async notifyModeratorCreated(
    moderatorId: string,
    surgeonName: string
  ): Promise<void> {
    try {
      await this.createNotification({
        recipientId: moderatorId,
        recipientRole: 'MODERATOR',
        type: 'MODERATOR_CREATED',
        title: 'Welcome to SurgiHistory',
        message: `Your moderator account has been created by Dr. ${surgeonName}. You can now manage patient assignments.`,
        priority: 'high',
        badgeColor: 'blue',
      });
    } catch (error) {
      logger.error('Error creating moderator created notification:', error);
      throw error;
    }
  }

  /**
   * Notify moderator when a new patient is assigned to them
   */
  async notifyPatientAssignmentRequest(
    moderatorId: string,
    patientName: string,
    patientId: string,
    surgeonName: string,
    assignmentId: string
  ): Promise<void> {
    try {
      await this.createNotification({
        recipientId: moderatorId,
        recipientRole: 'MODERATOR',
        type: 'ASSIGNMENT_REQUEST',
        title: 'New Patient Assignment',
        message: `Dr. ${surgeonName} has assigned patient "${patientName}" to you. Please review and respond.`,
        entityType: 'patient_assignment',
        entityId: assignmentId,
        priority: 'high',
        badgeColor: 'blue',
        patientId,
      });
    } catch (error) {
      logger.error('Error creating assignment request notification:', error);
      throw error;
    }
  }

  /**
   * Notify surgeon when moderator accepts a patient assignment
   */
  async notifyAssignmentAccepted(
    surgeonId: string,
    moderatorName: string,
    patientName: string,
    patientId: string
  ): Promise<void> {
    try {
      await this.createNotification({
        recipientId: surgeonId,
        recipientRole: 'SURGEON',
        type: 'ASSIGNMENT_ACCEPTED',
        title: 'Assignment Accepted',
        message: `${moderatorName} has accepted the assignment for patient "${patientName}".`,
        entityType: 'patient',
        entityId: patientId,
        priority: 'normal',
        badgeColor: 'green',
        patientId,
        surgeonId,
      });
    } catch (error) {
      logger.error('Error creating assignment accepted notification:', error);
      throw error;
    }
  }

  /**
   * Notify surgeon when moderator rejects a patient assignment
   */
  async notifyAssignmentRejected(
    surgeonId: string,
    moderatorName: string,
    patientName: string,
    patientId: string
  ): Promise<void> {
    try {
      await this.createNotification({
        recipientId: surgeonId,
        recipientRole: 'SURGEON',
        type: 'ASSIGNMENT_REJECTED',
        title: 'Assignment Rejected',
        message: `${moderatorName} has rejected the assignment for patient "${patientName}". Please assign a different moderator.`,
        entityType: 'patient',
        entityId: patientId,
        priority: 'normal',
        badgeColor: 'red',
        patientId,
        surgeonId,
      });
    } catch (error) {
      logger.error('Error creating assignment rejected notification:', error);
      throw error;
    }
  }

  /**
   * Notify moderator when patient uploads media
   */
  async notifyModeratorPatientUpload(
    moderatorId: string,
    patientName: string,
    patientId: string,
    mediaId: string,
    fileName: string
  ): Promise<void> {
    try {
      await this.createNotification({
        recipientId: moderatorId,
        recipientRole: 'MODERATOR',
        type: 'PATIENT_MEDIA_UPLOAD',
        title: 'New Patient Upload',
        message: `Patient "${patientName}" has uploaded a new file: ${fileName}`,
        entityType: 'media',
        entityId: mediaId,
        priority: 'normal',
        badgeColor: 'green',
        patientId,
      });
    } catch (error) {
      logger.error('Error creating patient upload notification for moderator:', error);
      throw error;
    }
  }
}

export default new NotificationService();
