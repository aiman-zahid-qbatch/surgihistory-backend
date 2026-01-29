import { Response, NextFunction } from 'express';
import patientService from '../services/patientService';
import { logger } from '../config/logger';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { emailService } from '../services/emailService';

import { AuthRequest, UserRole } from '../middlewares/auth';
import { prisma } from '../config/database';
import { logAuditEvent } from '../middlewares/auditLog';

export class PatientController {
  // Generate a secure random password
  private generatePassword = (length: number = 12): string => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    const randomBytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length];
    }
    
    return password;
  }

  createPatient = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Get surgeon ID from user ID (only for surgeons, not for admin)
      let surgeonId: string | null = null;
      
      if (req.user.role === UserRole.SURGEON) {
        const surgeon = await prisma.surgeon.findUnique({
          where: { userId: req.user.id },
          select: { id: true },
        });

        if (!surgeon) {
          res.status(404).json({
            success: false,
            message: 'Surgeon profile not found',
          });
          return;
        }
        surgeonId = surgeon.id;
      } else if (req.user.role !== UserRole.ADMIN) {
        // Only surgeons and admins can create patients
        res.status(403).json({
          success: false,
          message: 'Only surgeons and administrators can create patients',
        });
        return;
      }

      const { email, cnic, fullName, fatherName, contactNumber, whatsappNumber, address, assignedDoctorId, assignedModeratorId: _assignedModeratorId, assignedModeratorIds } = req.body;

      // Validation: Email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({
          success: false,
          message: 'Invalid email format',
        });
        return;
      }

      // Validation: CNIC format (13 digits, can have hyphens)
      const cnicRegex = /^\d{5}-?\d{7}-?\d{1}$/;
      if (!cnicRegex.test(cnic)) {
        res.status(400).json({
          success: false,
          message: 'Invalid CNIC format. Use format: 12345-1234567-1 or 1234512345671',
        });
        return;
      }

      // Validation: Contact number (only numbers, +, spaces, hyphens)
      const phoneRegex = /^[+]?[\d\s-]+$/;
      const digitsOnly = contactNumber.replace(/[^\d]/g, '');
      if (!phoneRegex.test(contactNumber) || digitsOnly.length < 10) {
        res.status(400).json({
          success: false,
          message: 'Invalid contact number. Must contain at least 10 digits',
        });
        return;
      }

      // Validation: WhatsApp number (if provided)
      if (whatsappNumber) {
        const whatsappDigits = whatsappNumber.replace(/[^\d]/g, '');
        if (!phoneRegex.test(whatsappNumber) || whatsappDigits.length < 10) {
          res.status(400).json({
            success: false,
            message: 'Invalid WhatsApp number. Must contain at least 10 digits',
          });
          return;
        }
      }

      // Validation: Full name (no special characters except spaces, dots, hyphens)
      const nameRegex = /^[a-zA-Z\s.-]+$/;
      if (!nameRegex.test(fullName)) {
        res.status(400).json({
          success: false,
          message: 'Full name should only contain letters, spaces, dots, and hyphens',
        });
        return;
      }

      // Validation: Father's name
      if (!nameRegex.test(fatherName)) {
        res.status(400).json({
          success: false,
          message: "Father's name should only contain letters, spaces, dots, and hyphens",
        });
        return;
      }

      // Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        res.status(400).json({
          success: false,
          message: 'Email already exists',
        });
        return;
      }

      // Check if CNIC already exists
      const existingPatient = await prisma.patient.findUnique({
        where: { cnic },
      });

      if (existingPatient) {
        res.status(400).json({
          success: false,
          message: 'CNIC already exists',
        });
        return;
      }

      // Generate a random secure password
      const generatedPassword = this.generatePassword();
      const hashedPassword = await bcrypt.hash(generatedPassword, 10);

      // Generate patient ID (e.g., PAT-2025-0001)
      const year = new Date().getFullYear();
      const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const patientId = `PAT-${year}-${randomNum}`;

      // Prepare patient data
      const patientData: any = {
        user: {
          create: {
            email,
            password: hashedPassword,
            role: UserRole.PATIENT,
          },
        },
        patientId,
        cnic,
        fullName,
        fatherName,
        contactNumber,
        whatsappNumber: whatsappNumber || contactNumber,
        address,
        ...(assignedDoctorId && {
          assignedSurgeon: {
            connect: { id: assignedDoctorId },
          },
        }),
      };

      // Only connect createdBy if surgeon exists
      if (surgeonId) {
        patientData.createdBy = {
          connect: { id: surgeonId },
        };
      }

      const patient = await patientService.createPatient({
        ...patientData,
        assignedModeratorIds: assignedModeratorIds || (_assignedModeratorId ? [_assignedModeratorId] : undefined),
        assignedBy: req.user.id,
      });

      // Send welcome email with credentials (don't fail patient creation if email fails)
      try {
        await emailService.sendWelcomeEmail(
          email,
          fullName,
          generatedPassword,
          UserRole.PATIENT
        );
        logger.info(`Welcome email sent to patient: ${email}`);
      } catch (emailError) {
        logger.error(`Failed to send welcome email to ${email}:`, emailError);
        // Continue - patient creation succeeded even if email failed
      }

      // Log audit event for patient creation
      await logAuditEvent(req, 'CREATE', 'patient', patient.id, {
        description: `Created patient: ${fullName}`,
        changes: {
          patientId,
          fullName,
          cnic,
          email,
        },
      });

      res.status(201).json({
        success: true,
        data: patient,
      });
    } catch (error) {
      logger.error('Error in createPatient controller:', error);
      next(error);
    }
  }

  getPatient = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const patient = await patientService.getPatientById(id);

      if (!patient) {
        res.status(404).json({
          success: false,
          message: 'Patient not found',
        });
        return;
      }

      res.json({
        success: true,
        data: patient,
      });
    } catch (error) {
      logger.error('Error in getPatient controller:', error);
      next(error);
    }
  }

  getAllPatients = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Get surgeon ID for surgeons to filter their patients
      let createdById: string | undefined;
      let assignedModeratorId: string | undefined;
      
      if (req.user.role === UserRole.SURGEON) {
        const surgeon = await prisma.surgeon.findUnique({
          where: { userId: req.user.id },
          select: { id: true },
        });
        createdById = surgeon?.id;
      }

      // Get moderator ID to filter patients assigned to them
      if (req.user.role === UserRole.MODERATOR) {
        const moderator = await prisma.moderator.findUnique({
          where: { userId: req.user.id },
          select: { id: true },
        });
        assignedModeratorId = moderator?.id;
      }

      const patients = await patientService.getAllPatients(createdById, assignedModeratorId);
      res.json({
        success: true,
        data: patients,
      });
    } catch (error) {
      logger.error('Error in getAllPatients controller:', error);
      next(error);
    }
  }

  updatePatient = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { fullName, fatherName, contactNumber, whatsappNumber, cnic, assignedModeratorIds, assignedModeratorId: _assignedModeratorId } = req.body;

      // Validation: Contact number (only numbers, +, spaces, hyphens)
      if (contactNumber) {
        const phoneRegex = /^[+]?[\d\s-]+$/;
        const digitsOnly = contactNumber.replace(/[^\d]/g, '');
        if (!phoneRegex.test(contactNumber) || digitsOnly.length < 10) {
          res.status(400).json({
            success: false,
            message: 'Invalid contact number. Must contain at least 10 digits',
          });
          return;
        }
      }

      // Validation: WhatsApp number (if provided)
      if (whatsappNumber) {
        const phoneRegex = /^[+]?[\d\s-]+$/;
        const whatsappDigits = whatsappNumber.replace(/[^\d]/g, '');
        if (!phoneRegex.test(whatsappNumber) || whatsappDigits.length < 10) {
          res.status(400).json({
            success: false,
            message: 'Invalid WhatsApp number. Must contain at least 10 digits',
          });
          return;
        }
      }

      // Validation: Full name (no special characters except spaces, dots, hyphens)
      if (fullName) {
        const nameRegex = /^[a-zA-Z\s.-]+$/;
        if (!nameRegex.test(fullName)) {
          res.status(400).json({
            success: false,
            message: 'Full name should only contain letters, spaces, dots, and hyphens',
          });
          return;
        }
      }

      // Validation: Father's name
      if (fatherName) {
        const nameRegex = /^[a-zA-Z\s.-]+$/;
        if (!nameRegex.test(fatherName)) {
          res.status(400).json({
            success: false,
            message: "Father's name should only contain letters, spaces, dots, and hyphens",
          });
          return;
        }
      }

      // Validation: CNIC format (if provided and being changed)
      if (cnic) {
        const cnicRegex = /^\d{5}-?\d{7}-?\d{1}$/;
        if (!cnicRegex.test(cnic)) {
          res.status(400).json({
            success: false,
            message: 'Invalid CNIC format. Use format: 12345-1234567-1 or 1234512345671',
          });
          return;
        }

        // Check if CNIC already exists for a different patient
        const existingPatient = await prisma.patient.findUnique({
          where: { cnic },
        });

        if (existingPatient && existingPatient.id !== id) {
          res.status(400).json({
            success: false,
            message: 'CNIC already exists for another patient',
          });
          return;
        }
      }

      const patient = await patientService.updatePatient(id, {
        ...req.body,
        assignedModeratorIds: assignedModeratorIds || (_assignedModeratorId ? [_assignedModeratorId] : undefined),
        assignedBy: req.user?.id,
      });

      // Log audit event for patient update
      await logAuditEvent(req, 'UPDATE', 'patient', id, {
        description: `Updated patient: ${patient.fullName}`,
        changes: req.body,
      });

      res.json({
        success: true,
        data: patient,
      });
    } catch (error) {
      logger.error('Error in updatePatient controller:', error);
      next(error);
    }
  }

  archivePatient = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const patient = await patientService.archivePatient(id);

      // Log audit event for patient archive
      await logAuditEvent(req, 'ARCHIVE', 'patient', id, {
        description: `Archived patient: ${patient.fullName}`,
      });

      res.json({
        success: true,
        message: 'Patient archived successfully',
        data: patient,
      });
    } catch (error) {
      logger.error('Error in archivePatient controller:', error);
      next(error);
    }
  }

  searchPatients = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { q } = req.query;
      
      if (!q || typeof q !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Search query is required',
        });
        return;
      }

      const patients = await patientService.searchPatients(q);
      res.json({
        success: true,
        data: patients,
      });
    } catch (error) {
      logger.error('Error in searchPatients controller:', error);
      next(error);
    }
  }

  /**
   * Get patients assigned to the current moderator via PatientModerator join table
   */
  getModeratorAssignedPatients = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Get moderator profile from user ID
      let moderator = await prisma.moderator.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });

      // Auto-create moderator profile if it doesn't exist (for existing users before profile creation code)
      if (!moderator && req.user.role === 'MODERATOR') {
        const user = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { name: true, email: true },
        });
        
        if (user) {
          moderator = await prisma.moderator.create({
            data: {
              userId: req.user.id,
              fullName: user.name || user.email.split('@')[0],
              contactNumber: '',
            },
            select: { id: true },
          });
          logger.info(`Auto-created moderator profile for user: ${user.email}`);
        }
      }

      if (!moderator) {
        res.status(404).json({
          success: false,
          message: 'Moderator profile not found',
        });
        return;
      }

      // Get assigned patients via PatientModerator join table (only ACCEPTED status)
      const assignedPatients = await prisma.patientModerator.findMany({
        where: {
          moderatorId: moderator.id,
          status: 'ACCEPTED',
        },
        include: {
          patient: {
            include: {
              user: { select: { email: true, role: true } },
              assignedSurgeon: { include: { user: true } },
              createdBy: { include: { user: true } },
            },
          },
        },
        orderBy: { assignedAt: 'desc' },
      });

      // Extract patient data from the join table results
      const patients = assignedPatients
        .filter(ap => !ap.patient.isArchived)
        .map(ap => ap.patient);

      res.json({
        success: true,
        data: patients,
      });
    } catch (error) {
      logger.error('Error in getModeratorAssignedPatients controller:', error);
      next(error);
    }
  }
}

export default new PatientController();
