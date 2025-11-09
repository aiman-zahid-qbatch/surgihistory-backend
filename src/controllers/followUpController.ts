import { Response, NextFunction } from 'express';
import followUpService from '../services/followUpService';
import { logger } from '../config/logger';
import { AuthRequest, UserRole } from '../middlewares/auth';
import { FollowUpStatus } from '@prisma/client';

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

      const followUp = await followUpService.createFollowUp(req.body, req.user.id);
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
      if (req.user?.role === UserRole.PATIENT && followUp.visibility === 'PRIVATE') {
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
   * Get follow-ups by doctor
   */
  async getFollowUpsByDoctor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { doctorId } = req.params;
      const { status } = req.query;

      const followUps = await followUpService.getFollowUpsByDoctor(
        doctorId,
        status as FollowUpStatus | undefined
      );

      res.json({
        success: true,
        data: followUps,
      });
    } catch (error) {
      logger.error('Error in getFollowUpsByDoctor controller:', error);
      next(error);
    }
  }

  /**
   * Get follow-ups by patient
   */
  async getFollowUpsByPatient(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { patientId } = req.params;

      // If patient role, verify they can only access their own follow-ups
      if (req.user?.role === UserRole.PATIENT && req.user.id !== patientId) {
        res.status(403).json({
          success: false,
          message: 'Access denied',
        });
        return;
      }

      const followUps = await followUpService.getFollowUpsByPatient(patientId);

      res.json({
        success: true,
        data: followUps,
      });
    } catch (error) {
      logger.error('Error in getFollowUpsByPatient controller:', error);
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
      const isDoctor = [UserRole.DOCTOR, UserRole.ADMIN].includes(req.user.role);

      const followUp = await followUpService.updateFollowUp(
        id,
        req.body,
        req.user.id,
        isDoctor
      );

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

      if (!status || !Object.values(FollowUpStatus).includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Valid status is required',
        });
        return;
      }

      const followUp = await followUpService.updateFollowUpStatus(
        id,
        status as FollowUpStatus,
        req.user.id
      );

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
