import { Router } from 'express';
import whatsappController from '../controllers/whatsappController';
import { authenticate, authorize, UserRole } from '../middlewares/auth';

const router = Router();

/**
 * @route   GET /api/whatsapp/webhook
 * @desc    Webhook verification for Meta WhatsApp API
 * @access  Public (Meta verification)
 */
router.get('/webhook', whatsappController.verifyWebhook);

/**
 * @route   POST /api/whatsapp/webhook
 * @desc    Receive webhook events from Meta WhatsApp API
 * @access  Public (Meta webhook)
 */
router.post('/webhook', whatsappController.handleWebhook);

// All routes below require authentication
router.use(authenticate);

/**
 * @route   GET /api/whatsapp/status
 * @desc    Get WhatsApp configuration status
 * @access  Admin, Surgeon, Moderator
 */
router.get(
  '/status',
  authorize(UserRole.ADMIN, UserRole.SURGEON, UserRole.MODERATOR),
  whatsappController.getConfigStatus
);

/**
 * @route   POST /api/whatsapp/test
 * @desc    Send a test WhatsApp message
 * @access  Admin only
 */
router.post(
  '/test',
  authorize(UserRole.ADMIN),
  whatsappController.sendTestMessage
);

/**
 * @route   POST /api/whatsapp/follow-up/:followUpId/remind
 * @desc    Send a follow-up reminder to patient via WhatsApp
 * @access  Admin, Surgeon, Moderator
 */
router.post(
  '/follow-up/:followUpId/remind',
  authorize(UserRole.ADMIN, UserRole.SURGEON, UserRole.MODERATOR),
  whatsappController.sendFollowUpReminder
);

/**
 * @route   POST /api/whatsapp/patient/:patientId/message
 * @desc    Send a custom message to patient via WhatsApp
 * @access  Admin, Surgeon, Moderator
 */
router.post(
  '/patient/:patientId/message',
  authorize(UserRole.ADMIN, UserRole.SURGEON, UserRole.MODERATOR),
  whatsappController.sendMessageToPatient
);

/**
 * @route   POST /api/whatsapp/process-reminders
 * @desc    Process and send all pending WhatsApp reminders
 * @access  Admin only
 */
router.post(
  '/process-reminders',
  authorize(UserRole.ADMIN),
  whatsappController.processPendingReminders
);

/**
 * @route   POST /api/whatsapp/document-request
 * @desc    Send document request notification to patient
 * @access  Admin, Surgeon, Moderator
 */
router.post(
  '/document-request',
  authorize(UserRole.ADMIN, UserRole.SURGEON, UserRole.MODERATOR),
  whatsappController.sendDocumentRequestNotification
);

export default router;
