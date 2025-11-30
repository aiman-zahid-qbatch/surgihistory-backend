import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import patientModeratorService from '../services/patientModeratorService';
import { logger } from '../config/logger';
import { PrismaClient, AssignmentStatus } from '@prisma/client';

const prisma = new PrismaClient();

export class PatientModeratorController {
  /**
   * Get pending assignment requests for the current moderator
   */
  async getPendingRequests(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Get moderator profile
      const moderator = await prisma.moderator.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });

      if (!moderator) {
        res.status(404).json({
          success: false,
          message: 'Moderator profile not found',
        });
        return;
      }

      const assignments = await patientModeratorService.getPendingAssignments(moderator.id);

      res.status(200).json({
        success: true,
        data: assignments,
      });
    } catch (error) {
      logger.error('Error in getPendingRequests controller:', error);
      next(error);
    }
  }

  /**
   * Accept a patient assignment
   */
  async acceptAssignment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;

      // Get moderator profile
      const moderator = await prisma.moderator.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });

      if (!moderator) {
        res.status(404).json({
          success: false,
          message: 'Moderator profile not found',
        });
        return;
      }

      const assignment = await patientModeratorService.acceptAssignment(id, moderator.id);

      res.status(200).json({
        success: true,
        message: 'Assignment accepted successfully',
        data: assignment,
      });
    } catch (error) {
      logger.error('Error in acceptAssignment controller:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Reject a patient assignment
   */
  async rejectAssignment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;

      // Get moderator profile
      const moderator = await prisma.moderator.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });

      if (!moderator) {
        res.status(404).json({
          success: false,
          message: 'Moderator profile not found',
        });
        return;
      }

      const assignment = await patientModeratorService.rejectAssignment(id, moderator.id);

      res.status(200).json({
        success: true,
        message: 'Assignment rejected successfully',
        data: assignment,
      });
    } catch (error) {
      logger.error('Error in rejectAssignment controller:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Get all assignments for the current moderator
   */
  async getMyAssignments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Get moderator profile
      const moderator = await prisma.moderator.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });

      if (!moderator) {
        res.status(404).json({
          success: false,
          message: 'Moderator profile not found',
        });
        return;
      }

      // Get status filter from query
      const status = req.query.status as AssignmentStatus | undefined;

      const assignments = await patientModeratorService.getAssignmentsByModerator(
        moderator.id,
        status
      );

      res.status(200).json({
        success: true,
        data: assignments,
      });
    } catch (error) {
      logger.error('Error in getMyAssignments controller:', error);
      next(error);
    }
  }

  /**
   * Get assignment counts for the current moderator
   */
  async getAssignmentCounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Get moderator profile
      const moderator = await prisma.moderator.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });

      if (!moderator) {
        res.status(404).json({
          success: false,
          message: 'Moderator profile not found',
        });
        return;
      }

      const counts = await patientModeratorService.getAssignmentCounts(moderator.id);

      res.status(200).json({
        success: true,
        data: counts,
      });
    } catch (error) {
      logger.error('Error in getAssignmentCounts controller:', error);
      next(error);
    }
  }

  /**
   * Get all moderators assigned to a specific patient
   */
  async getPatientModerators(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;

      if (!patientId) {
        res.status(400).json({
          success: false,
          message: 'Patient ID is required',
        });
        return;
      }

      const assignments = await patientModeratorService.getPatientModerators(patientId);

      res.status(200).json({
        success: true,
        data: assignments,
      });
    } catch (error) {
      logger.error('Error in getPatientModerators controller:', error);
      next(error);
    }
  }
}

export default new PatientModeratorController();
