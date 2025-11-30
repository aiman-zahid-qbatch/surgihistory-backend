import { logger } from '../config/logger';

interface WhatsAppMessageResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

interface SendTemplateOptions {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: any[];
}

export class WhatsAppService {
  private accessToken: string;
  private phoneNumberId: string;
  private apiVersion: string;
  private baseUrl: string;

  constructor() {
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`;
  }

  /**
   * Format phone number to WhatsApp format (with country code, no + sign)
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    let formatted = phone.replace(/\D/g, '');
    
    // If starts with 0, assume Pakistan and replace with 92
    if (formatted.startsWith('0')) {
      formatted = '92' + formatted.substring(1);
    }
    
    // If doesn't start with country code, assume Pakistan (92)
    if (!formatted.startsWith('92') && formatted.length === 10) {
      formatted = '92' + formatted;
    }
    
    return formatted;
  }

  /**
   * Send a text message
   */
  async sendTextMessage(to: string, message: string): Promise<WhatsAppMessageResponse | null> {
    try {
      if (!this.accessToken || !this.phoneNumberId) {
        logger.error('WhatsApp API credentials not configured');
        throw new Error('WhatsApp API credentials not configured');
      }

      const formattedPhone = this.formatPhoneNumber(to);

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'text',
          text: {
            preview_url: false,
            body: message,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw { response: { data: errorData }, message: `HTTP ${response.status}` };
      }

      const data = await response.json() as WhatsAppMessageResponse;

      logger.info(`WhatsApp message sent successfully to ${formattedPhone}`, {
        messageId: data.messages?.[0]?.id,
      });

      return data;
    } catch (error: any) {
      logger.error('Error sending WhatsApp message:', {
        error: error.response?.data || error.message,
        to,
      });
      throw error;
    }
  }

  /**
   * Send a template message (for approved templates)
   */
  async sendTemplateMessage(options: SendTemplateOptions): Promise<WhatsAppMessageResponse | null> {
    try {
      if (!this.accessToken || !this.phoneNumberId) {
        logger.error('WhatsApp API credentials not configured');
        throw new Error('WhatsApp API credentials not configured');
      }

      const formattedPhone = this.formatPhoneNumber(options.to);

      const payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'template',
        template: {
          name: options.templateName,
          language: {
            code: options.languageCode || 'en',
          },
        },
      };

      // Add components if provided (for template variables)
      if (options.components && options.components.length > 0) {
        payload.template.components = options.components;
      }

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw { response: { data: errorData }, message: `HTTP ${response.status}` };
      }

      const data = await response.json() as WhatsAppMessageResponse;

      logger.info(`WhatsApp template message sent successfully to ${formattedPhone}`, {
        messageId: data.messages?.[0]?.id,
        template: options.templateName,
      });

      return data;
    } catch (error: any) {
      logger.error('Error sending WhatsApp template message:', {
        error: error.response?.data || error.message,
        to: options.to,
        template: options.templateName,
      });
      throw error;
    }
  }

  /**
   * Send a follow-up reminder message
   */
  async sendFollowUpReminder(
    to: string,
    patientName: string,
    followUpDate: string,
    followUpTime: string | null,
    doctorName: string,
    procedureName: string
  ): Promise<WhatsAppMessageResponse | null> {
    const timeStr = followUpTime ? ` at ${followUpTime}` : '';
    const message = `
🏥 *SurgiHistory - Follow-up Reminder*

Dear ${patientName},

This is a reminder for your upcoming follow-up appointment:

📅 *Date:* ${followUpDate}${timeStr}
👨‍⚕️ *Doctor:* Dr. ${doctorName}
🏷️ *For:* ${procedureName}

Please make sure to:
✅ Arrive 15 minutes early
✅ Bring your previous reports
✅ Bring your medications list

If you need to reschedule, please contact us as soon as possible.

Thank you for choosing SurgiHistory!
    `.trim();

    return this.sendTextMessage(to, message);
  }

  /**
   * Send a document request notification
   */
  async sendDocumentRequestNotification(
    to: string,
    patientName: string,
    documentTitle: string,
    doctorName: string
  ): Promise<WhatsAppMessageResponse | null> {
    const message = `
🏥 *SurgiHistory - Document Request*

Dear ${patientName},

Dr. ${doctorName} has requested you to upload the following document:

📄 *Document:* ${documentTitle}

Please log in to your SurgiHistory account to upload the requested document.

Thank you!
    `.trim();

    return this.sendTextMessage(to, message);
  }

  /**
   * Send appointment confirmation
   */
  async sendAppointmentConfirmation(
    to: string,
    patientName: string,
    appointmentDate: string,
    appointmentTime: string | null,
    doctorName: string
  ): Promise<WhatsAppMessageResponse | null> {
    const timeStr = appointmentTime ? ` at ${appointmentTime}` : '';
    const message = `
🏥 *SurgiHistory - Appointment Confirmed*

Dear ${patientName},

Your appointment has been confirmed:

📅 *Date:* ${appointmentDate}${timeStr}
👨‍⚕️ *Doctor:* Dr. ${doctorName}

We look forward to seeing you!

Thank you for choosing SurgiHistory!
    `.trim();

    return this.sendTextMessage(to, message);
  }

  /**
   * Send a custom message
   */
  async sendCustomMessage(to: string, message: string): Promise<WhatsAppMessageResponse | null> {
    return this.sendTextMessage(to, message);
  }

  /**
   * Check if WhatsApp service is configured
   */
  isConfigured(): boolean {
    return !!(this.accessToken && this.phoneNumberId);
  }

  /**
   * Get configuration status
   */
  getConfigStatus(): { configured: boolean; phoneNumberId: string | null } {
    return {
      configured: this.isConfigured(),
      phoneNumberId: this.phoneNumberId ? `****${this.phoneNumberId.slice(-4)}` : null,
    };
  }
}

export default new WhatsAppService();
