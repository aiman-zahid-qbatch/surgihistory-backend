import nodemailer from 'nodemailer';
import { logger } from '../config/logger';

interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: `"${process.env.FROM_NAME || 'SurgiHistory System'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent: ${info.messageId} to ${options.to}`);
      return true;
    } catch (error) {
      logger.error('Error sending email:', error);
      return false;
    }
  }

  async sendWelcomeEmail(email: string, name: string, password: string, role: string): Promise<boolean> {
    const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const subject = 'Welcome to SurgiHistory - Your Account Details';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .credentials {
            background: white;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
            border-left: 4px solid #667eea;
          }
          .credential-item {
            margin: 10px 0;
          }
          .credential-label {
            font-weight: bold;
            color: #667eea;
          }
          .credential-value {
            font-family: 'Courier New', monospace;
            background: #f0f0f0;
            padding: 5px 10px;
            border-radius: 3px;
            display: inline-block;
          }
          .warning {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to SurgiHistory</h1>
            <p>Your Medical Records Management System</p>
          </div>
          <div class="content">
            <p>Hello ${name || 'User'},</p>
            
            <p>Your account has been created successfully. Below are your login credentials:</p>
            
            <div class="credentials">
              <div class="credential-item">
                <span class="credential-label">Email:</span><br/>
                <span class="credential-value">${email}</span>
              </div>
              <div class="credential-item">
                <span class="credential-label">Password:</span><br/>
                <span class="credential-value">${password}</span>
              </div>
              <div class="credential-item">
                <span class="credential-label">Role:</span><br/>
                <span class="credential-value">${role}</span>
              </div>
            </div>
            
            <div class="warning">
              <strong>⚠️ Important Security Notice:</strong>
              <ul>
                <li>Please change your password after your first login</li>
                <li>Do not share your credentials with anyone</li>
                <li>Keep this email secure or delete it after changing your password</li>
              </ul>
            </div>
            
            <p>You can now log in to the system using these credentials.</p>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}/login" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Login to SurgiHistory</a>
            </p>
            
            <p>If you have any questions or need assistance, please contact your system administrator.</p>
            
            <p>Best regards,<br/>
            The SurgiHistory Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} SurgiHistory. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Welcome to SurgiHistory!

Hello ${name || 'User'},

Your account has been created successfully. Below are your login credentials:

Email: ${email}
Password: ${password}
Role: ${role}

IMPORTANT SECURITY NOTICE:
- Please change your password after your first login
- Do not share your credentials with anyone
- Keep this email secure or delete it after changing your password

You can now log in to the system using these credentials.

Login URL: ${loginUrl}/login

If you have any questions or need assistance, please contact your system administrator.

Best regards,
The SurgiHistory Team

This is an automated message, please do not reply to this email.
© ${new Date().getFullYear()} SurgiHistory. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject,
      text,
      html,
    });
  }

  async sendApprovalEmail(email: string, name: string): Promise<boolean> {
    const subject = 'Your Surgeon Account Has Been Approved! 🎉';
    
    // Use the name as-is if provided, otherwise use a generic greeting
    const greeting = name ? `Hello ${name},` : 'Hello,';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .success-box {
            background: #d1fae5;
            border: 2px solid #10b981;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
            text-align: center;
          }
          .cta-button {
            display: inline-block;
            background: #10b981;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Account Approved!</h1>
            <p>Welcome to SurgiHistory</p>
          </div>
          <div class="content">
            <p>${greeting}</p>
            
            <div class="success-box">
              <h2 style="color: #059669; margin: 0;">✓ Your account has been approved!</h2>
            </div>
            
            <p>Great news! Your surgeon account registration has been reviewed and approved by our administrator.</p>
            
            <p>You can now log in to the SurgiHistory platform and start managing your surgical records, patients, and follow-ups.</p>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" class="cta-button">
                Log In Now
              </a>
            </div>
            
            <p><strong>What you can do:</strong></p>
            <ul>
              <li>Manage patient surgical records</li>
              <li>Track surgery outcomes and follow-ups</li>
              <li>Upload and manage medical documents</li>
              <li>Collaborate with other healthcare professionals</li>
            </ul>
            
            <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
            
            <p>Best regards,<br/>
            The SurgiHistory Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} SurgiHistory. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Account Approved! 🎉

${greeting}

Great news! Your surgeon account registration has been reviewed and approved by our administrator.

You can now log in to the SurgiHistory platform and start managing your surgical records, patients, and follow-ups.

Log in at: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/login

What you can do:
- Manage patient surgical records
- Track surgery outcomes and follow-ups
- Upload and manage medical documents
- Collaborate with other healthcare professionals

If you have any questions or need assistance, please don't hesitate to contact our support team.

Best regards,
The SurgiHistory Team

This is an automated message, please do not reply to this email.
© ${new Date().getFullYear()} SurgiHistory. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject,
      text,
      html,
    });
  }

  async sendPasswordResetEmail(email: string, name: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    const subject = 'Reset Your SurgiHistory Password';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .reset-box {
            background: white;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
            border-left: 4px solid #667eea;
            text-align: center;
          }
          .cta-button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
          }
          .warning {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
            <p>SurgiHistory - Medical Records Platform</p>
          </div>
          <div class="content">
            <p>Hello ${name || 'User'},</p>

            <p>We received a request to reset your password for your SurgiHistory account.</p>

            <div class="reset-box">
              <p>Click the button below to reset your password:</p>
              <a href="${resetUrl}" class="cta-button">
                Reset Password
              </a>
            </div>

            <div class="warning">
              <strong>⚠️ Important:</strong>
              <ul>
                <li>This link will expire in 1 hour</li>
                <li>If you didn't request this reset, you can safely ignore this email</li>
                <li>Your password will not be changed until you create a new one</li>
              </ul>
            </div>

            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; font-size: 12px; color: #666;">${resetUrl}</p>

            <p>Best regards,<br/>
            The SurgiHistory Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} SurgiHistory. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Password Reset Request

Hello ${name || 'User'},

We received a request to reset your password for your SurgiHistory account.

Click the link below to reset your password:
${resetUrl}

IMPORTANT:
- This link will expire in 1 hour
- If you didn't request this reset, you can safely ignore this email
- Your password will not be changed until you create a new one

Best regards,
The SurgiHistory Team

This is an automated message, please do not reply to this email.
© ${new Date().getFullYear()} SurgiHistory. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject,
      text,
      html,
    });
  }

  async sendRejectionEmail(email: string, name: string): Promise<boolean> {
    const subject = 'Update on Your Surgeon Account Registration';
    
    // Use the name as-is if provided, otherwise use a generic greeting
    const greeting = name ? `Hello ${name},` : 'Hello,';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .info-box {
            background: #fef2f2;
            border: 2px solid #dc2626;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Registration Update</h1>
            <p>SurgiHistory Account Status</p>
          </div>
          <div class="content">
            <p>${greeting}</p>
            
            <div class="info-box">
              <p><strong>Thank you for your interest in joining SurgiHistory.</strong></p>
              <p>After careful review, we regret to inform you that we are unable to approve your surgeon account registration at this time.</p>
            </div>
            
            <p>This decision may have been made for various reasons, including:</p>
            <ul>
              <li>Incomplete or inaccurate information provided</li>
              <li>Unable to verify credentials</li>
              <li>Other administrative reasons</li>
            </ul>
            
            <p>If you believe this decision was made in error or if you have additional information to provide, please contact our administrator at <a href="mailto:${process.env.ADMIN_EMAIL || 'admin@surgihistory.com'}">${process.env.ADMIN_EMAIL || 'admin@surgihistory.com'}</a>.</p>
            
            <p>We appreciate your understanding.</p>
            
            <p>Best regards,<br/>
            The SurgiHistory Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} SurgiHistory. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Registration Update

${greeting}

Thank you for your interest in joining SurgiHistory.

After careful review, we regret to inform you that we are unable to approve your surgeon account registration at this time.

This decision may have been made for various reasons, including:
- Incomplete or inaccurate information provided
- Unable to verify credentials
- Other administrative reasons

If you believe this decision was made in error or if you have additional information to provide, please contact our administrator at ${process.env.ADMIN_EMAIL || 'admin@surgihistory.com'}.

We appreciate your understanding.

Best regards,
The SurgiHistory Team

This is an automated message, please do not reply to this email.
© ${new Date().getFullYear()} SurgiHistory. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject,
      text,
      html,
    });
  }
}

export const emailService = new EmailService();
