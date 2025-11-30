import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { ReminderChannel, ReminderStatus, UserRole } from '@prisma/client';

interface CreateReminderData {
  entityType: string;
  entityId: string;
  followUpId?: string;
  recipientId: string;
  recipientRole: UserRole;
  recipientName?: string;
  recipientPhone?: string;
  title: string;
  message: string;
  scheduledFor: Date;
  channel: ReminderChannel;
  isRecurring?: boolean;
  recurringPattern?: string;
  daysBefore?: number;
}

interface UpdateReminderData {
  title?: string;
  message?: string;
  scheduledFor?: Date;
  channel?: ReminderChannel;
  status?: ReminderStatus;
  isRecurring?: boolean;
  recurringPattern?: string;
  daysBefore?: number;
}

export class ReminderService {
  /**
   * Create a new reminder
   */
  async createReminder(data: CreateReminderData, createdBy: string) {
    try {
      const reminder = await prisma.reminder.create({
        data: {
          ...data,
          createdBy,
        },
        include: {
          followUp: {
            include: {
              surgery: {
                include: {
                  patient: true,
                },
              },
              surgeon: true,
            },
          },
        },
      });

      logger.info(`Reminder created: ${reminder.id} for ${data.entityType}: ${data.entityId}`);
      return reminder;
    } catch (error) {
      logger.error('Error creating reminder:', error);
      throw error;
    }
  }

  /**
   * Create multiple reminders for a follow-up
   */
  async createFollowUpReminders(
    followUpId: string,
    followUpDate: Date,
    patientId: string,
    patientName: string,
    patientPhone: string | null,
    patientWhatsapp: string | null,
    reminderDays: number[], // e.g., [1, 3, 7] days before
    channels: ReminderChannel[], // e.g., ['EMAIL', 'WHATSAPP']
    createdBy: string
  ) {
    try {
      const reminders = [];

      for (const days of reminderDays) {
        const scheduledDate = new Date(followUpDate);
        scheduledDate.setDate(scheduledDate.getDate() - days);

        for (const channel of channels) {
          const reminder = await prisma.reminder.create({
            data: {
              entityType: 'follow_up',
              entityId: followUpId,
              followUpId,
              recipientId: patientId,
              recipientRole: UserRole.PATIENT,
              recipientName: patientName,
              recipientPhone: channel === ReminderChannel.WHATSAPP ? (patientWhatsapp || patientPhone) : patientPhone,
              title: `Follow-up Reminder - ${days} day${days > 1 ? 's' : ''} before`,
              message: `You have a follow-up appointment scheduled in ${days} day${days > 1 ? 's' : ''}. Please make sure to attend.`,
              scheduledFor: scheduledDate,
              channel,
              daysBefore: days,
              createdBy,
            },
            include: {
              followUp: true,
            },
          });

          reminders.push(reminder);
        }
      }

      logger.info(`Created ${reminders.length} reminders for follow-up: ${followUpId}`);
      return reminders;
    } catch (error) {
      logger.error('Error creating follow-up reminders:', error);
      throw error;
    }
  }

  /**
   * Get reminder by ID
   */
  async getReminderById(id: string) {
    try {
      const reminder = await prisma.reminder.findUnique({
        where: { id },
        include: {
          followUp: {
            include: {
              surgery: {
                include: {
                  patient: true,
                },
              },
              surgeon: true,
            },
          },
        },
      });

      return reminder;
    } catch (error) {
      logger.error(`Error fetching reminder ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get reminders for a follow-up
   */
  async getRemindersByFollowUp(followUpId: string) {
    try {
      const reminders = await prisma.reminder.findMany({
        where: { followUpId },
        orderBy: { scheduledFor: 'asc' },
      });

      return reminders;
    } catch (error) {
      logger.error(`Error fetching reminders for follow-up ${followUpId}:`, error);
      throw error;
    }
  }

  /**
   * Get pending reminders (for scheduler)
   */
  async getPendingReminders(beforeDate: Date = new Date()) {
    try {
      const reminders = await prisma.reminder.findMany({
        where: {
          status: ReminderStatus.PENDING,
          scheduledFor: {
            lte: beforeDate,
          },
        },
        include: {
          followUp: {
            include: {
              surgery: {
                include: {
                  patient: true,
                },
              },
              surgeon: true,
            },
          },
        },
        orderBy: { scheduledFor: 'asc' },
      });

      return reminders;
    } catch (error) {
      logger.error('Error fetching pending reminders:', error);
      throw error;
    }
  }

  /**
   * Update reminder
   */
  async updateReminder(id: string, data: UpdateReminderData) {
    try {
      const reminder = await prisma.reminder.update({
        where: { id },
        data,
        include: {
          followUp: true,
        },
      });

      logger.info(`Reminder updated: ${id}`);
      return reminder;
    } catch (error) {
      logger.error(`Error updating reminder ${id}:`, error);
      throw error;
    }
  }

  /**
   * Mark reminder as sent
   */
  async markReminderAsSent(id: string) {
    try {
      const reminder = await prisma.reminder.update({
        where: { id },
        data: {
          status: ReminderStatus.SENT,
          sentAt: new Date(),
          attempts: {
            increment: 1,
          },
          lastAttemptAt: new Date(),
        },
      });

      logger.info(`Reminder marked as sent: ${id}`);
      return reminder;
    } catch (error) {
      logger.error(`Error marking reminder as sent ${id}:`, error);
      throw error;
    }
  }

  /**
   * Mark reminder as failed
   */
  async markReminderAsFailed(id: string, errorMessage: string) {
    try {
      const reminder = await prisma.reminder.update({
        where: { id },
        data: {
          status: ReminderStatus.FAILED,
          attempts: {
            increment: 1,
          },
          lastAttemptAt: new Date(),
          errorMessage,
        },
      });

      logger.error(`Reminder marked as failed: ${id} - ${errorMessage}`);
      return reminder;
    } catch (error) {
      logger.error(`Error marking reminder as failed ${id}:`, error);
      throw error;
    }
  }

  /**
   * Cancel reminder
   */
  async cancelReminder(id: string) {
    try {
      const reminder = await prisma.reminder.update({
        where: { id },
        data: {
          status: ReminderStatus.CANCELLED,
        },
      });

      logger.info(`Reminder cancelled: ${id}`);
      return reminder;
    } catch (error) {
      logger.error(`Error cancelling reminder ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete reminder
   */
  async deleteReminder(id: string) {
    try {
      await prisma.reminder.delete({
        where: { id },
      });

      logger.info(`Reminder deleted: ${id}`);
    } catch (error) {
      logger.error(`Error deleting reminder ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete all reminders for a follow-up
   */
  async deleteFollowUpReminders(followUpId: string) {
    try {
      const result = await prisma.reminder.deleteMany({
        where: { followUpId },
      });

      logger.info(`Deleted ${result.count} reminders for follow-up: ${followUpId}`);
      return result;
    } catch (error) {
      logger.error(`Error deleting reminders for follow-up ${followUpId}:`, error);
      throw error;
    }
  }

  /**
   * Get reminders for a recipient
   */
  async getRemindersByRecipient(recipientId: string, status?: ReminderStatus) {
    try {
      const reminders = await prisma.reminder.findMany({
        where: {
          recipientId,
          ...(status && { status }),
        },
        include: {
          followUp: {
            include: {
              surgery: {
                include: {
                  patient: true,
                },
              },
              surgeon: true,
            },
          },
        },
        orderBy: { scheduledFor: 'desc' },
      });

      return reminders;
    } catch (error) {
      logger.error(`Error fetching reminders for recipient ${recipientId}:`, error);
      throw error;
    }
  }
}

export default new ReminderService();
