import { Response, NextFunction } from 'express';
import moderatorAvailabilityService from '../services/moderatorAvailabilityService';
import { logger } from '../config/logger';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../config/database';

export class ModeratorAvailabilityController {
  /**
   * Set availability for current moderator
   */
  async setMyAvailability(req: AuthRequest, res: Response, next: NextFunction) {
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
      });

      if (!moderator) {
        res.status(404).json({
          success: false,
          message: 'Moderator profile not found',
        });
        return;
      }

      const { availabilities } = req.body;

      if (!Array.isArray(availabilities)) {
        res.status(400).json({
          success: false,
          message: 'Availabilities must be an array',
        });
        return;
      }

      // Validate each availability slot
      for (const av of availabilities) {
        if (typeof av.dayOfWeek !== 'number' || av.dayOfWeek < 0 || av.dayOfWeek > 6) {
          res.status(400).json({
            success: false,
            message: 'Invalid dayOfWeek. Must be between 0 (Sunday) and 6 (Saturday)',
          });
          return;
        }

        if (!av.startTime || !av.endTime) {
          res.status(400).json({
            success: false,
            message: 'startTime and endTime are required',
          });
          return;
        }

        // Validate time format (HH:MM)
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(av.startTime) || !timeRegex.test(av.endTime)) {
          res.status(400).json({
            success: false,
            message: 'Invalid time format. Use HH:MM (24-hour format)',
          });
          return;
        }
      }

      const result = await moderatorAvailabilityService.setModeratorAvailability(
        moderator.id,
        availabilities
      );

      res.json({
        success: true,
        message: 'Availability updated successfully',
        data: result,
      });
    } catch (error) {
      logger.error('Error in setMyAvailability controller:', error);
      next(error);
    }
  }

  /**
   * Get availability for current moderator
   */
  async getMyAvailability(req: AuthRequest, res: Response, next: NextFunction) {
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
      });

      if (!moderator) {
        res.status(404).json({
          success: false,
          message: 'Moderator profile not found',
        });
        return;
      }

      const availability = await moderatorAvailabilityService.getModeratorAvailability(moderator.id);

      res.json({
        success: true,
        data: availability,
      });
    } catch (error) {
      logger.error('Error in getMyAvailability controller:', error);
      next(error);
    }
  }

  /**
   * Check moderators availability at specific time (for surgeons)
   */
  async getModeratorsAvailability(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { dayOfWeek, time } = req.query;

      if (dayOfWeek !== undefined && time) {
        // Get availability at specific time
        const day = parseInt(dayOfWeek as string);
        if (isNaN(day) || day < 0 || day > 6) {
          res.status(400).json({
            success: false,
            message: 'Invalid dayOfWeek. Must be between 0 and 6',
          });
          return;
        }

        const moderators = await moderatorAvailabilityService.getModeratorsAvailabilityAtTime(
          day,
          time as string
        );

        res.json({
          success: true,
          data: moderators,
        });
      } else {
        // Get all moderators with their full availability schedule
        const moderators = await moderatorAvailabilityService.getAllModeratorsWithAvailability();

        res.json({
          success: true,
          data: moderators,
        });
      }
    } catch (error) {
      logger.error('Error in getModeratorsAvailability controller:', error);
      next(error);
    }
  }

  /**
   * Update a specific availability slot
   */
  async updateAvailability(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;
      const updateData = req.body;

      // Verify the availability belongs to the current moderator
      const availability = await prisma.moderatorAvailability.findUnique({
        where: { id },
        include: { moderator: { include: { user: true } } },
      });

      if (!availability) {
        res.status(404).json({
          success: false,
          message: 'Availability not found',
        });
        return;
      }

      if (availability.moderator.userId !== req.user.id) {
        res.status(403).json({
          success: false,
          message: 'Access denied',
        });
        return;
      }

      const updated = await moderatorAvailabilityService.updateAvailability(id, updateData);

      res.json({
        success: true,
        message: 'Availability updated successfully',
        data: updated,
      });
    } catch (error) {
      logger.error('Error in updateAvailability controller:', error);
      next(error);
    }
  }

  /**
   * Delete a specific availability slot
   */
  async deleteAvailability(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;

      // Verify the availability belongs to the current moderator
      const availability = await prisma.moderatorAvailability.findUnique({
        where: { id },
        include: { moderator: { include: { user: true } } },
      });

      if (!availability) {
        res.status(404).json({
          success: false,
          message: 'Availability not found',
        });
        return;
      }

      if (availability.moderator.userId !== req.user.id) {
        res.status(403).json({
          success: false,
          message: 'Access denied',
        });
        return;
      }

      await moderatorAvailabilityService.deleteAvailability(id);

      res.json({
        success: true,
        message: 'Availability deleted successfully',
      });
    } catch (error) {
      logger.error('Error in deleteAvailability controller:', error);
      next(error);
    }
  }
}

export default new ModeratorAvailabilityController();
