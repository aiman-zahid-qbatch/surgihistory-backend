import { Request, Response, NextFunction } from 'express';
import whatsappService from '../services/whatsappService';
import reminderService from '../services/reminderService';
import { logger } from '../config/logger';
import { AuthRequest } from '../middlewares/auth';
import { ReminderChannel, ReminderStatus } from '@prisma/client';
import { prisma } from '../config/database';

// Webhook verify token - set this in your .env file
const WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'surgihistory_whatsapp_webhook';

export class WhatsAppController {
  /**
   * Verify webhook for Meta WhatsApp API
   * This is called by Meta when you set up the webhook
   */
  async verifyWebhook(req: Request, res: Response): Promise<void> {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      logger.info('WhatsApp webhook verification request received', { mode, token });

      if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
        logger.info('WhatsApp webhook verified successfully');
        res.status(200).send(challenge);
      } else {
        logger.warn('WhatsApp webhook verification failed - invalid token');
        res.status(403).send('Forbidden');
      }
    } catch (error: any) {
      logger.error('Error in verifyWebhook:', error);
      res.status(500).send('Error');
    }
  }

  /**
   * Handle incoming webhook events from Meta WhatsApp API
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body;

      logger.info('WhatsApp webhook event received', { body: JSON.stringify(body) });

      // Check if this is a WhatsApp status update
      if (body.object === 'whatsapp_business_account') {
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            const value = change.value;

            // Handle message status updates
            if (value.statuses) {
              for (const status of value.statuses) {
                logger.info('WhatsApp message status update', {
                  messageId: status.id,
                  status: status.status,
                  recipientId: status.recipient_id,
                  timestamp: status.timestamp,
                });

                // Status can be: sent, delivered, read, failed
                if (status.status === 'failed') {
                  logger.error('WhatsApp message failed', {
                    messageId: status.id,
                    errors: status.errors,
                  });
                }
              }
            }

            // Handle incoming messages
            if (value.messages) {
              for (const message of value.messages) {
                logger.info('WhatsApp incoming message', {
                  from: message.from,
                  messageId: message.id,
                  type: message.type,
                  timestamp: message.timestamp,
                  text: message.text?.body,
                });

                // You can add logic here to:
                // - Auto-reply to patients
                // - Store incoming messages
                // - Notify staff of patient messages
              }
            }

            // Handle contacts
            if (value.contacts) {
              for (const contact of value.contacts) {
                logger.info('WhatsApp contact info', {
                  waId: contact.wa_id,
                  name: contact.profile?.name,
                });
              }
            }
          }
        }
      }

      // Always return 200 OK to acknowledge receipt
      res.status(200).send('OK');
    } catch (error: any) {
      logger.error('Error in handleWebhook:', error);
      // Still return 200 to prevent Meta from retrying
      res.status(200).send('OK');
    }
  }

  /**
   * Send a test WhatsApp message
   */
  async sendTestMessage(req: AuthRequest, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { phoneNumber, message } = req.body;

      if (!phoneNumber || !message) {
        res.status(400).json({
          success: false,
          message: 'Phone number and message are required',
        });
        return;
      }

      // Check if WhatsApp is configured
      if (!whatsappService.isConfigured()) {
        res.status(503).json({
          success: false,
          message: 'WhatsApp service is not configured. Please set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in environment variables.',
        });
        return;
      }

      const result = await whatsappService.sendTextMessage(phoneNumber, message);

      res.json({
        success: true,
        message: 'WhatsApp message sent successfully',
        data: result,
      });
    } catch (error: any) {
      logger.error('Error in sendTestMessage controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send WhatsApp message',
        error: error.response?.data || error.message,
      });
    }
  }

  /**
   * Send a follow-up reminder via WhatsApp
   */
  async sendFollowUpReminder(req: AuthRequest, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { followUpId } = req.params;

      // Get follow-up details
      const followUp = await prisma.followUp.findUnique({
        where: { id: followUpId },
        include: {
          surgery: {
            include: {
              patient: true,
            },
          },
          surgeon: true,
        },
      });

      if (!followUp) {
        res.status(404).json({
          success: false,
          message: 'Follow-up not found',
        });
        return;
      }

      const patient = followUp.surgery.patient;
      const phoneNumber = patient.whatsappNumber || patient.contactNumber;

      if (!phoneNumber) {
        res.status(400).json({
          success: false,
          message: 'Patient does not have a phone number configured',
        });
        return;
      }

      // Check if WhatsApp is configured
      if (!whatsappService.isConfigured()) {
        res.status(503).json({
          success: false,
          message: 'WhatsApp service is not configured',
        });
        return;
      }

      const followUpDate = new Date(followUp.followUpDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const result = await whatsappService.sendFollowUpReminder(
        phoneNumber,
        patient.fullName,
        followUpDate,
        followUp.scheduledTime || null,
        followUp.surgeon.fullName,
        followUp.surgery.procedureName
      );

      res.json({
        success: true,
        message: 'Follow-up reminder sent successfully',
        data: result,
      });
    } catch (error: any) {
      logger.error('Error in sendFollowUpReminder controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send follow-up reminder',
        error: error.response?.data || error.message,
      });
    }
  }

  /**
   * Send a custom WhatsApp message to a patient
   */
  async sendMessageToPatient(req: AuthRequest, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { patientId } = req.params;
      const { message } = req.body;

      if (!message) {
        res.status(400).json({
          success: false,
          message: 'Message is required',
        });
        return;
      }

      // Get patient details
      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
      });

      if (!patient) {
        res.status(404).json({
          success: false,
          message: 'Patient not found',
        });
        return;
      }

      const phoneNumber = patient.whatsappNumber || patient.contactNumber;

      if (!phoneNumber) {
        res.status(400).json({
          success: false,
          message: 'Patient does not have a phone number configured',
        });
        return;
      }

      // Check if WhatsApp is configured
      if (!whatsappService.isConfigured()) {
        res.status(503).json({
          success: false,
          message: 'WhatsApp service is not configured',
        });
        return;
      }

      const result = await whatsappService.sendCustomMessage(phoneNumber, message);

      res.json({
        success: true,
        message: 'WhatsApp message sent successfully',
        data: result,
      });
    } catch (error: any) {
      logger.error('Error in sendMessageToPatient controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send WhatsApp message',
        error: error.response?.data || error.message,
      });
    }
  }

  /**
   * Process and send pending WhatsApp reminders
   */
  async processPendingReminders(_req: AuthRequest, res: Response, _next: NextFunction): Promise<void> {
    try {
      // Get all pending WhatsApp reminders that are due
      const pendingReminders = await prisma.reminder.findMany({
        where: {
          status: ReminderStatus.PENDING,
          channel: ReminderChannel.WHATSAPP,
          scheduledFor: {
            lte: new Date(),
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
      });

      if (pendingReminders.length === 0) {
        res.json({
          success: true,
          message: 'No pending WhatsApp reminders to process',
          processed: 0,
        });
        return;
      }

      // Check if WhatsApp is configured
      if (!whatsappService.isConfigured()) {
        res.status(503).json({
          success: false,
          message: 'WhatsApp service is not configured',
        });
        return;
      }

      let successCount = 0;
      let failedCount = 0;
      const results: any[] = [];

      for (const reminder of pendingReminders) {
        try {
          const followUp = reminder.followUp;
          if (!followUp) {
            await reminderService.markReminderAsFailed(reminder.id, 'Follow-up not found');
            failedCount++;
            continue;
          }

          const patient = followUp.surgery.patient;
          const phoneNumber = reminder.recipientPhone || patient.whatsappNumber || patient.contactNumber;

          if (!phoneNumber) {
            await reminderService.markReminderAsFailed(reminder.id, 'No phone number available');
            failedCount++;
            continue;
          }

          const followUpDate = new Date(followUp.followUpDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          await whatsappService.sendFollowUpReminder(
            phoneNumber,
            patient.fullName,
            followUpDate,
            followUp.scheduledTime || null,
            followUp.surgeon.fullName,
            followUp.surgery.procedureName
          );

          await reminderService.markReminderAsSent(reminder.id);
          successCount++;
          results.push({ id: reminder.id, status: 'sent' });
        } catch (error: any) {
          await reminderService.markReminderAsFailed(reminder.id, error.message);
          failedCount++;
          results.push({ id: reminder.id, status: 'failed', error: error.message });
        }
      }

      res.json({
        success: true,
        message: `Processed ${pendingReminders.length} reminders`,
        data: {
          total: pendingReminders.length,
          success: successCount,
          failed: failedCount,
          results,
        },
      });
    } catch (error: any) {
      logger.error('Error in processPendingReminders controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process pending reminders',
        error: error.message,
      });
    }
  }

  /**
   * Get WhatsApp configuration status
   */
  async getConfigStatus(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = whatsappService.getConfigStatus();

      res.json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      logger.error('Error in getConfigStatus controller:', error);
      next(error);
    }
  }

  /**
   * Send document request notification via WhatsApp
   */
  async sendDocumentRequestNotification(req: AuthRequest, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { patientId, documentTitle, doctorName } = req.body;

      if (!patientId || !documentTitle || !doctorName) {
        res.status(400).json({
          success: false,
          message: 'Patient ID, document title, and doctor name are required',
        });
        return;
      }

      // Get patient details
      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
      });

      if (!patient) {
        res.status(404).json({
          success: false,
          message: 'Patient not found',
        });
        return;
      }

      const phoneNumber = patient.whatsappNumber || patient.contactNumber;

      if (!phoneNumber) {
        res.status(400).json({
          success: false,
          message: 'Patient does not have a phone number configured',
        });
        return;
      }

      // Check if WhatsApp is configured
      if (!whatsappService.isConfigured()) {
        res.status(503).json({
          success: false,
          message: 'WhatsApp service is not configured',
        });
        return;
      }

      const result = await whatsappService.sendDocumentRequestNotification(
        phoneNumber,
        patient.fullName,
        documentTitle,
        doctorName
      );

      res.json({
        success: true,
        message: 'Document request notification sent successfully',
        data: result,
      });
    } catch (error: any) {
      logger.error('Error in sendDocumentRequestNotification controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send notification',
        error: error.response?.data || error.message,
      });
    }
  }
}

export default new WhatsAppController();
