import { Response, NextFunction } from 'express';
import surgeryService from '../services/surgeryService';
import { logger } from '../config/logger';
import { AuthRequest, UserRole } from '../middlewares/auth';
import { prisma } from '../config/database';
import notificationService from '../services/notificationService';


export class SurgeryController {
  async createSurgery(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Validate required fields
      const {
        patientId,
        diagnosis,
        briefHistory,
        preOpFindings,
        procedureName,
        procedureDetails,
        surgeryRole,
        surgeryDate,
      } = req.body;

      if (!patientId || !diagnosis || !briefHistory || !preOpFindings ||
          !procedureName || !procedureDetails || !surgeryRole || !surgeryDate) {
        res.status(400).json({
          success: false,
          message: 'All required fields must be provided',
        });
        return;
      }

      // Get the surgeon profile ID from the user ID
      const surgeon = await surgeryService.getSurgeonByUserId(req.user.id);
      if (!surgeon) {
        res.status(403).json({
          success: false,
          message: 'Surgeon profile not found. Only surgeons can create surgery records.',
        });
        return;
      }

      const surgeryData = {
        ...req.body,
        surgeonId: surgeon.id,
        createdBy: req.user.id,
        surgeryDate: new Date(surgeryDate),
      };

      const surgery = await surgeryService.createSurgery(surgeryData);

      // Create notification for patient about new surgery record
      try {
        const patient = await prisma.patient.findUnique({
          where: { id: patientId },
          select: { id: true, fullName: true },
        });

        if (patient) {
          await notificationService.createNotification({
            recipientId: patient.id,
            recipientRole: UserRole.PATIENT,
            type: 'RECORD_UPDATE',
            title: 'New Surgery Record Added',
            message: `A new surgery record for ${procedureName} has been added to your medical history`,
            entityType: 'surgery',
            entityId: surgery.id,
            priority: 'normal',
            badgeColor: 'blue',
            patientId: patient.id,
            surgeonId: surgeon.id,
          });
        }
      } catch (notifError) {
        logger.error('Error creating surgery notification:', notifError);
        // Don't fail the surgery creation if notification fails
      }

      res.status(201).json({
        success: true,
        data: surgery,
        message: 'Surgery record created successfully',
      });
    } catch (error) {
      logger.error('Error in createSurgery controller:', error);
      next(error);
    }
  }

  async getSurgery(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const surgery = await surgeryService.getSurgeryById(id);

      if (!surgery) {
        res.status(404).json({
          success: false,
          message: 'Surgery not found',
        });
        return;
      }

      res.json({
        success: true,
        data: surgery,
      });
    } catch (error) {
      logger.error('Error in getSurgery controller:', error);
      next(error);
    }
  }

  async getSurgeriesByPatient(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { patientId } = req.params;
      const { page = '1', limit = '20', search, sortBy = 'surgeryDate', order = 'desc' } = req.query;

      // If patient role, verify they can only access their own surgeries
      if (req.user?.role === UserRole.PATIENT) {
        // Get the patient profile ID for this user
        const patientProfile = await prisma.patient.findUnique({
          where: { userId: req.user.id },
          select: { id: true },
        });

        if (!patientProfile || patientProfile.id !== patientId) {
          res.status(403).json({
            success: false,
            message: 'Access denied',
          });
          return;
        }
      }

      const result = await surgeryService.getSurgeriesByPatient(patientId, {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        search: search as string,
        sortBy: sortBy as string,
        order: order as 'asc' | 'desc',
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Error in getSurgeriesByPatient controller:', error);
      next(error);
    }
  }

  async getSurgeriesBySurgeon(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { surgeonId } = req.params;
      const { page = '1', limit = '20', search, sortBy = 'surgeryDate', order = 'desc' } = req.query;

      const result = await surgeryService.getSurgeriesBySurgeon(surgeonId, {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        search: search as string,
        sortBy: sortBy as string,
        order: order as 'asc' | 'desc',
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Error in getSurgeriesBySurgeon controller:', error);
      next(error);
    }
  }

  async getAllSurgeries(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const surgeries = await surgeryService.getAllSurgeries();

      res.json({
        success: true,
        data: surgeries,
      });
    } catch (error) {
      logger.error('Error in getAllSurgeries controller:', error);
      next(error);
    }
  }

  async updateSurgery(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;

      // Check if user can edit this surgery
      const canEdit = await surgeryService.canEditSurgery(id, req.user.id);
      
      if (!canEdit) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to edit this surgery record',
        });
        return;
      }

      const updateData = {
        ...req.body,
        surgeryDate: req.body.surgeryDate ? new Date(req.body.surgeryDate) : undefined,
      };

      const surgery = await surgeryService.updateSurgery(id, updateData, req.user.id);

      // Notify patient about surgery record update
      try {
        const surgeryWithDetails = await prisma.surgery.findUnique({
          where: { id },
          include: {
            patient: { select: { id: true } },
          },
        });

        if (surgeryWithDetails?.patient) {
          await notificationService.notifyPatientSurgeryUpdated(
            surgeryWithDetails.patient.id,
            id,
            surgery.procedureName
          );
        }
      } catch (notifError) {
        logger.error('Error sending surgery update notification:', notifError);
        // Don't fail the update if notification fails
      }

      res.json({
        success: true,
        data: surgery,
        message: 'Surgery record updated successfully',
      });
    } catch (error) {
      logger.error('Error in updateSurgery controller:', error);
      next(error);
    }
  }

  async archiveSurgery(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const surgery = await surgeryService.archiveSurgery(id);

      res.json({
        success: true,
        message: 'Surgery archived successfully',
        data: surgery,
      });
    } catch (error) {
      logger.error('Error in archiveSurgery controller:', error);
      next(error);
    }
  }

  async searchSurgeries(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q } = req.query;
      
      if (!q || typeof q !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Search query is required',
        });
        return;
      }

      const surgeries = await surgeryService.searchSurgeries(q);
      res.json({
        success: true,
        data: surgeries,
      });
    } catch (error) {
      logger.error('Error in searchSurgeries controller:', error);
      next(error);
    }
  }
}

export default new SurgeryController();
