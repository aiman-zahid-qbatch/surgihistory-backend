import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { emailService } from './emailService';
import notificationService from './notificationService';


interface CreateReminderData {
  entityType: string;
  entityId: string;
  followUpId?: string;
  recipientId: string;
  recipientRole: string;
  recipientName?: string;
  recipientPhone?: string;
  title: string;
  message: string;
  scheduledFor: Date;
  channel: string;
  isRecurring?: boolean;
  recurringPattern?: string;
  daysBefore?: number;
}

interface UpdateReminderData {
  title?: string;
  message?: string;
  scheduledFor?: Date;
  channel?: string;
  status?: string;
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
           status: 'PENDING',
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
    reminderDays: number[], // e.g., [1, 3, 7] days before, or 0.007 for 10 min
    channels: string[], // e.g., ['EMAIL', 'WHATSAPP']
    createdBy: string
  ) {
    try {
      const reminders = [];

      for (const days of reminderDays) {
        const scheduledDate = new Date(followUpDate);
        
        // Handle fractional days (for minutes) - convert days to milliseconds
        const millisecondsToSubtract = days * 24 * 60 * 60 * 1000;
        scheduledDate.setTime(scheduledDate.getTime() - millisecondsToSubtract);

        // Format the reminder title based on days or minutes
        let timeLabel: string;
        if (days < 1) {
          const minutes = Math.round(days * 24 * 60);
          timeLabel = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
        } else {
          timeLabel = `${days} day${days > 1 ? 's' : ''}`;
        }

        for (const channel of channels) {
          const reminder = await prisma.reminder.create({
            data: {
              entityType: 'follow_up',
              entityId: followUpId,
              followUpId,
              recipientId: patientId,
              recipientRole: 'PATIENT',
              recipientName: patientName,
              recipientPhone: channel === 'WHATSAPP' ? (patientWhatsapp || patientPhone) : patientPhone,
              title: `Follow-up Reminder - ${timeLabel} before`,
              message: `You have a follow-up appointment scheduled in ${timeLabel}. Please make sure to attend.`,
              scheduledFor: scheduledDate,
              channel,
              daysBefore: days,
               status: 'PENDING',
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
          status: 'PENDING',
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
          status: 'SENT',
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
          status: 'FAILED',
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
          status: 'CANCELLED',
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
  async getRemindersByRecipient(recipientId: string, status?: string) {
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

  /**
   * Process and send a reminder based on its channel
   */
  async processReminder(reminderId: string) {
    try {
      const reminder = await this.getReminderById(reminderId);
      if (!reminder) {
        throw new Error('Reminder not found');
      }

      if (reminder.status !== 'PENDING') {
        logger.info(`Reminder ${reminderId} is not pending, skipping`);
        return reminder;
      }

      const followUp = reminder.followUp;
      const patient = followUp?.surgery?.patient;
      const surgeon = followUp?.surgeon;

      if (!patient) {
        await this.markReminderAsFailed(reminderId, 'Patient not found');
        return reminder;
      }

      let success = false;

      switch (reminder.channel) {
        case 'EMAIL':
          // Get patient email
          const patientUser = await prisma.user.findUnique({
            where: { id: patient.userId },
            select: { email: true },
          });

          if (patientUser?.email) {
            success = await emailService.sendFollowUpReminderEmail(
              patientUser.email,
              patient.fullName,
              followUp?.followUpDate?.toISOString() || new Date().toISOString(),
              reminder.daysBefore || 1,
              surgeon?.fullName,
              followUp?.description
            );
          }
          break;

        case 'IN_APP':
          // Create in-app notification
          await notificationService.createNotification({
            recipientId: patient.id,
            recipientRole: 'PATIENT',
            type: 'FOLLOW_UP_REMINDER',
            title: reminder.title,
            message: reminder.message,
            entityType: 'follow_up',
            entityId: reminder.followUpId || undefined,
            priority: 'high',
            patientId: patient.id,
            surgeonId: surgeon?.id,
          });
          success = true;
          break;

        case 'WHATSAPP':
          // WhatsApp integration - placeholder for future implementation
          logger.info(`WhatsApp reminder for ${reminderId} - not implemented yet`);
          success = false;
          break;

        default:
          logger.warn(`Unknown channel ${reminder.channel} for reminder ${reminderId}`);
          break;
      }

      if (success) {
        await this.markReminderAsSent(reminderId);
      } else {
        await this.markReminderAsFailed(reminderId, `Failed to send via ${reminder.channel}`);
      }

      return await this.getReminderById(reminderId);
    } catch (error) {
      logger.error(`Error processing reminder ${reminderId}:`, error);
      await this.markReminderAsFailed(reminderId, String(error));
      throw error;
    }
  }

  /**
   * Process all pending reminders that are due
   */
  async processPendingReminders() {
    try {
      const pendingReminders = await this.getPendingReminders(new Date());
      logger.info(`Processing ${pendingReminders.length} pending reminders`);

      const results = [];
      for (const reminder of pendingReminders) {
        try {
          const result = await this.processReminder(reminder.id);
          results.push({ id: reminder.id, status: 'processed', result });
        } catch (error) {
          results.push({ id: reminder.id, status: 'failed', error: String(error) });
        }
      }

      return results;
    } catch (error) {
      logger.error('Error processing pending reminders:', error);
      throw error;
    }
  }
}

export default new ReminderService();
