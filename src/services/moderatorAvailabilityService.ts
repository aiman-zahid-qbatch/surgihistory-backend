import { prisma } from '../config/database';
import { logger } from '../config/logger';

export interface CreateAvailabilityData {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface UpdateAvailabilityData {
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
}

export class ModeratorAvailabilityService {
  /**
   * Set availability for a moderator (replaces all existing availability)
   */
  async setModeratorAvailability(moderatorId: string, availabilities: CreateAvailabilityData[]) {
    try {
      // Delete existing availability
      await prisma.moderatorAvailability.deleteMany({
        where: { moderatorId },
      });

      // Create new availability slots
      const created = await prisma.moderatorAvailability.createMany({
        data: availabilities.map(av => ({
          moderatorId,
          dayOfWeek: av.dayOfWeek,
          startTime: av.startTime,
          endTime: av.endTime,
          isActive: true,
        })),
      });

      logger.info(`Set availability for moderator ${moderatorId}: ${created.count} slots`);

      return this.getModeratorAvailability(moderatorId);
    } catch (error) {
      logger.error('Error setting moderator availability:', error);
      throw error;
    }
  }

  /**
   * Get availability for a specific moderator
   */
  async getModeratorAvailability(moderatorId: string) {
    try {
      return await prisma.moderatorAvailability.findMany({
        where: { moderatorId },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      });
    } catch (error) {
      logger.error('Error getting moderator availability:', error);
      throw error;
    }
  }

  /**
   * Update a specific availability slot
   */
  async updateAvailability(id: string, data: UpdateAvailabilityData) {
    try {
      return await prisma.moderatorAvailability.update({
        where: { id },
        data,
      });
    } catch (error) {
      logger.error('Error updating availability:', error);
      throw error;
    }
  }

  /**
   * Delete a specific availability slot
   */
  async deleteAvailability(id: string) {
    try {
      return await prisma.moderatorAvailability.delete({
        where: { id },
      });
    } catch (error) {
      logger.error('Error deleting availability:', error);
      throw error;
    }
  }

  /**
   * Check if moderator is available at a specific time
   */
  async isModeratorAvailable(moderatorId: string, dayOfWeek: number, time: string): Promise<boolean> {
    try {
      const availability = await prisma.moderatorAvailability.findFirst({
        where: {
          moderatorId,
          dayOfWeek,
          isActive: true,
          startTime: { lte: time },
          endTime: { gte: time },
        },
      });

      return !!availability;
    } catch (error) {
      logger.error('Error checking moderator availability:', error);
      throw error;
    }
  }

  /**
   * Get all moderators with their availability status at a specific time
   */
  async getModeratorsAvailabilityAtTime(dayOfWeek: number, time: string) {
    try {
      const moderators = await prisma.moderator.findMany({
        where: {
          isArchived: false,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              isActive: true,
            },
          },
          availability: {
            where: {
              dayOfWeek,
              isActive: true,
              startTime: { lte: time },
              endTime: { gte: time },
            },
          },
          assignedPatients: {
            select: {
              id: true,
            },
          },
        },
      });

      return moderators.map(moderator => ({
        id: moderator.id,
        userId: moderator.user.id,
        fullName: moderator.fullName,
        email: moderator.user.email,
        contactNumber: moderator.contactNumber,
        isActive: moderator.user.isActive,
        isAvailable: moderator.availability.length > 0,
        assignedPatientsCount: moderator.assignedPatients.length,
        createdAt: moderator.createdAt,
      }));
    } catch (error) {
      logger.error('Error getting moderators availability at time:', error);
      throw error;
    }
  }

  /**
   * Get all moderators with their full availability schedule
   */
  async getAllModeratorsWithAvailability() {
    try {
      const moderators = await prisma.moderator.findMany({
        where: {
          isArchived: false,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              isActive: true,
            },
          },
          availability: {
            where: { isActive: true },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
          },
          assignedPatients: {
            select: {
              id: true,
            },
          },
        },
      });

      return moderators.map(moderator => ({
        id: moderator.id,
        userId: moderator.user.id,
        fullName: moderator.fullName,
        email: moderator.user.email,
        contactNumber: moderator.contactNumber,
        isActive: moderator.user.isActive,
        availability: moderator.availability,
        assignedPatientsCount: moderator.assignedPatients.length,
        createdAt: moderator.createdAt,
      }));
    } catch (error) {
      logger.error('Error getting all moderators with availability:', error);
      throw error;
    }
  }
}

export default new ModeratorAvailabilityService();
