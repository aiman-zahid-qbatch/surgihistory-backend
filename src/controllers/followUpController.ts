import { Response, NextFunction } from 'express';
import followUpService from '../services/followUpService';
import { logger } from '../config/logger';
import { AuthRequest } from '../middlewares/auth';

import { prisma } from '../config/database';
import notificationService from '../services/notificationService';

export class FollowUpController {
  /**
   * Create new follow-up
   */
  async createFollowUp(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Fetch surgeon profile for authenticated user
      const surgeon = await prisma.surgeon.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });

      if (!surgeon) {
        res.status(404).json({
          success: false,
          message: 'Surgeon profile not found. Only surgeons can create follow-ups.',
        });
        return;
      }

      // Use the surgeon's ID from their profile
      const followUpData = {
        ...req.body,
        surgeonId: surgeon.id, // Override with correct surgeon ID
      };

      const followUp = await followUpService.createFollowUp(followUpData, req.user.id);

      // Create notification for patient about new follow-up
      try {
        const surgery = await prisma.surgery.findUnique({
          where: { id: followUpData.surgeryId },
          include: {
            patient: {
              select: { id: true, fullName: true },
            },
          },
        });

        if (surgery?.patient) {
          const followUpDate = new Date(followUpData.followUpDate).toLocaleDateString();
          await notificationService.createNotification({
            recipientId: surgery.patient.id,
            recipientRole: 'PATIENT',
            type: 'FOLLOW_UP_REMINDER',
            title: 'New Follow-up Scheduled',
            message: `A follow-up appointment has been scheduled for ${followUpDate}`,
            entityType: 'follow_up',
            entityId: followUp.id,
            priority: 'high',
            badgeColor: 'yellow',
            patientId: surgery.patient.id,
            surgeonId: surgeon.id,
          });
        }
      } catch (notifError) {
        logger.error('Error creating follow-up notification:', notifError);
        // Don't fail the follow-up creation if notification fails
      }

      res.status(201).json({
        success: true,
        data: followUp,
      });
    } catch (error) {
      logger.error('Error in createFollowUp controller:', error);
      next(error);
    }
  }

  /**
   * Get follow-up by ID
   */
  async getFollowUp(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const followUp = await followUpService.getFollowUpById(id);

      if (!followUp) {
        res.status(404).json({
          success: false,
          message: 'Follow-up not found',
        });
        return;
      }

      // Check if patient is trying to access private follow-up
      if (req.user?.role === 'PATIENT' && followUp.visibility === 'PRIVATE') {
        // Verify patient owns this follow-up
        if (followUp.surgery.patientId !== req.user.id) {
          res.status(403).json({
            success: false,
            message: 'Access denied',
          });
          return;
        }
      }

      res.json({
        success: true,
        data: followUp,
      });
    } catch (error) {
      logger.error('Error in getFollowUp controller:', error);
      next(error);
    }
  }

  /**
   * Get follow-ups by surgery
   */
  async getFollowUpsBySurgery(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { surgeryId } = req.params;
      const followUps = await followUpService.getFollowUpsBySurgery(surgeryId);

      res.json({
        success: true,
        data: followUps,
      });
    } catch (error) {
      logger.error('Error in getFollowUpsBySurgery controller:', error);
      next(error);
    }
  }

  /**
   * Get follow-ups by surgeon
   */
  async getFollowUpsBySurgeon(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { surgeonId } = req.params;
      const { status, page = '1', limit = '20', search, sortBy = 'followUpDate', order = 'desc' } = req.query;

      const result = await followUpService.getFollowUpsBySurgeon(
        surgeonId,
        status as string | undefined,
        {
          page: parseInt(page as string, 10),
          limit: parseInt(limit as string, 10),
          search: search as string,
          sortBy: sortBy as string,
          order: order as 'asc' | 'desc',
        }
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Error in getFollowUpsBySurgeon controller:', error);
      next(error);
    }
  }

  /**
   * Get follow-ups by moderator (assigned patients only)
   */
  async getFollowUpsByModerator(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { moderatorId } = req.params;
      const { status, page = '1', limit = '20', search, sortBy = 'followUpDate', order = 'desc' } = req.query;

      const result = await followUpService.getFollowUpsByModerator(
        moderatorId,
        status as string | undefined,
        {
          page: parseInt(page as string, 10),
          limit: parseInt(limit as string, 10),
          search: search as string,
          sortBy: sortBy as string,
          order: order as 'asc' | 'desc',
        }
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Error in getFollowUpsByModerator controller:', error);
      next(error);
    }
  }

  /**
   * Get follow-ups by patient
   */
  async getFollowUpsByPatient(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { patientId } = req.params;
      const { status, page = '1', limit = '20', sortBy = 'followUpDate', order = 'desc' } = req.query;

      // If patient role, verify they can only access their own follow-ups
      if (req.user?.role === 'PATIENT') {
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

      const result = await followUpService.getFollowUpsByPatient(patientId, {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        status: status as string | undefined,
        sortBy: sortBy as string,
        order: order as 'asc' | 'desc',
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Error in getFollowUpsByPatient controller:', error);
      next(error);
    }
  }

  /**
   * Get all follow-ups (Admin only)
   */
  async getAllFollowUps(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.query;
      const followUps = await followUpService.getAllFollowUps(
        status as string | undefined
      );

      res.json({
        success: true,
        data: followUps,
      });
    } catch (error) {
      logger.error('Error in getAllFollowUps controller:', error);
      next(error);
    }
  }

  /**
   * Update follow-up
   */
  async updateFollowUp(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;
      const isDoctor = ['SURGEON', 'ADMIN'].includes(req.user.role);

      const followUp = await followUpService.updateFollowUp(
        id,
        req.body,
        req.user.id,
        isDoctor
      );

      // Notify patient about the follow-up update
      try {
        const followUpWithDetails = await prisma.followUp.findUnique({
          where: { id },
          include: {
            surgery: {
              include: {
                patient: { select: { id: true } },
              },
            },
            surgeon: { select: { fullName: true } },
          },
        });

        if (followUpWithDetails?.surgery?.patient && followUpWithDetails.surgeon) {
          await notificationService.notifyPatientFollowUpUpdated(
            followUpWithDetails.surgery.patient.id,
            id,
            followUpWithDetails.surgeon.fullName,
            'updated'
          );
        }
      } catch (notifError) {
        logger.error('Error sending follow-up update notification:', notifError);
        // Don't fail the update if notification fails
      }

      res.json({
        success: true,
        data: followUp,
      });
    } catch (error) {
      logger.error('Error in updateFollowUp controller:', error);
      next(error);
    }
  }

  /**
   * Update follow-up status
   */
  async updateFollowUpStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;
      const { status } = req.body;

      if (!status || typeof status !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Valid status is required',
        });
        return;
      }

      const followUp = await followUpService.updateFollowUpStatus(
        id,
        status,
        req.user.id
      );

      // Notify patient of status update
      try {
        const followUpWithDetails = await prisma.followUp.findUnique({
          where: { id },
          include: {
            surgery: {
              include: {
                patient: {
                  select: { id: true, fullName: true },
                },
              },
            },
            surgeon: {
              select: { id: true, fullName: true },
            },
          },
        });

        if (followUpWithDetails?.surgery?.patient) {
          let statusMessage = '';
          let priority: 'low' | 'normal' | 'high' = 'normal';
          let badgeColor = 'blue';

          if (status === 'COMPLETED') {
            statusMessage = 'Your follow-up appointment has been marked as completed';
            priority = 'low';
            badgeColor = 'green';
          } else if (status === 'MISSED') {
            statusMessage = 'Your follow-up appointment was marked as missed. Please contact your surgeon to reschedule';
            priority = 'high';
            badgeColor = 'red';
          }

          if (statusMessage) {
            await notificationService.createNotification({
              recipientId: followUpWithDetails.surgery.patient.id,
              recipientRole: 'PATIENT',
              type: 'RECORD_UPDATE',
              title: 'Follow-up Status Updated',
              message: statusMessage,
              entityType: 'follow_up',
              entityId: id,
              priority,
              badgeColor,
              patientId: followUpWithDetails.surgery.patient.id,
              surgeonId: followUpWithDetails.surgeon?.id,
            });
          }
        }
      } catch (notifError) {
        logger.error('Error creating follow-up status notification:', notifError);
      }

      res.json({
        success: true,
        data: followUp,
      });
    } catch (error) {
      logger.error('Error in updateFollowUpStatus controller:', error);
      next(error);
    }
  }

  /**
   * Archive follow-up (soft delete)
   */
  async archiveFollowUp(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;
      const followUp = await followUpService.archiveFollowUp(id, req.user.id);

      res.json({
        success: true,
        message: 'Follow-up archived successfully',
        data: followUp,
      });
    } catch (error) {
      logger.error('Error in archiveFollowUp controller:', error);
      next(error);
    }
  }

  /**
   * Get upcoming follow-ups
   */
  async getUpcomingFollowUps(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { days } = req.query;
      const daysAhead = days ? parseInt(days as string) : 7;

      const followUps = await followUpService.getUpcomingFollowUps(daysAhead);

      res.json({
        success: true,
        data: followUps,
      });
    } catch (error) {
      logger.error('Error in getUpcomingFollowUps controller:', error);
      next(error);
    }
  }

  /**
   * Search follow-ups
   */
  async searchFollowUps(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Search query is required',
        });
        return;
      }

      const followUps = await followUpService.searchFollowUps(q);

      res.json({
        success: true,
        data: followUps,
      });
    } catch (error) {
      logger.error('Error in searchFollowUps controller:', error);
      next(error);
    }
  }
}

export default new FollowUpController();
