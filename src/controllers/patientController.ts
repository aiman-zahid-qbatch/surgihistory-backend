import { Response, NextFunction } from 'express';
import patientService from '../services/patientService';
import { logger } from '../config/logger';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { emailService } from '../services/emailService';
import { UserRole } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../config/database';

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

      // Get doctor ID from user ID
      const doctor = await prisma.doctor.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });

      if (!doctor) {
        res.status(404).json({
          success: false,
          message: 'Doctor profile not found',
        });
        return;
      }

      const { email, cnic, fullName, fatherName, contactNumber, whatsappNumber, address, assignedDoctorId, assignedModeratorId } = req.body;

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
      const patientData = {
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
        createdBy: {
          connect: { id: doctor.id },
        },
        ...(assignedDoctorId && {
          assignedDoctor: {
            connect: { id: assignedDoctorId },
          },
        }),
        ...(assignedModeratorId && {
          assignedModerator: {
            connect: { id: assignedModeratorId },
          },
        }),
      };

      const patient = await patientService.createPatient(patientData);

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

      // Get doctor ID for surgeons/doctors to filter their patients
      let createdById: string | undefined;
      let assignedModeratorId: string | undefined;
      
      if (req.user.role === UserRole.SURGEON || req.user.role === UserRole.DOCTOR) {
        const doctor = await prisma.doctor.findUnique({
          where: { userId: req.user.id },
          select: { id: true },
        });
        createdById = doctor?.id;
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
      const { fullName, fatherName, contactNumber, whatsappNumber, cnic } = req.body;

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

      const patient = await patientService.updatePatient(id, req.body);

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
}

export default new PatientController();
