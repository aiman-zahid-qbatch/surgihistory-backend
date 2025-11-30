import { PrismaClient, FollowUpStatus, RecordVisibility } from '@prisma/client';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

interface CreateFollowUpData {
  surgeryId: string;
  surgeonId: string;
  followUpDate: Date | string;
  scheduledTime?: string;
  description: string;
  observations?: string;
  status?: FollowUpStatus;
  visibility?: RecordVisibility;
}

interface UpdateFollowUpData {
  followUpDate?: Date | string;
  scheduledTime?: string;
  description?: string;
  observations?: string;
  status?: FollowUpStatus;
  visibility?: RecordVisibility;
  lastDoctorUpdate?: Date;
  lastPatientUpdate?: Date;
}

export class FollowUpService {
  /**
   * Create a new follow-up record
   */
  async createFollowUp(data: CreateFollowUpData, createdBy: string) {
    try {
      const followUp = await prisma.followUp.create({
        data: {
          surgeryId: data.surgeryId,
          surgeonId: data.surgeonId,
          followUpDate: new Date(data.followUpDate),
          scheduledTime: data.scheduledTime,
          description: data.description,
          observations: data.observations,
          status: data.status || FollowUpStatus.PENDING,
          visibility: data.visibility || RecordVisibility.PUBLIC,
          createdBy,
          lastDoctorUpdate: new Date(),
        },
        include: {
          surgery: {
            include: {
              patient: true,
            },
          },
          surgeon: true,
          media: true,
        },
      });

      logger.info(`Follow-up created: ${followUp.id} for surgery: ${data.surgeryId}`);
      return followUp;
    } catch (error) {
      logger.error('Error creating follow-up:', error);
      throw error;
    }
  }

  /**
   * Get follow-up by ID
   */
  async getFollowUpById(id: string) {
    try {
      const followUp = await prisma.followUp.findFirst({
        where: {
          id,
          isArchived: false,
        },
        include: {
          surgery: {
            include: {
              patient: true,
            },
          },
          surgeon: true,
          media: {
            where: { isArchived: false },
            orderBy: { createdAt: 'desc' },
          },
          privateNotes: {
            orderBy: { createdAt: 'desc' },
          },
          reminders: {
            orderBy: { scheduledFor: 'asc' },
          },
        },
      });

      return followUp;
    } catch (error) {
      logger.error(`Error fetching follow-up ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get all follow-ups for a surgery
   */
  async getFollowUpsBySurgery(surgeryId: string) {
    try {
      const followUps = await prisma.followUp.findMany({
        where: {
          surgeryId,
          isArchived: false,
        },
        include: {
          surgery: {
            include: {
              patient: true,
            },
          },
          surgeon: true,
          media: {
            where: { isArchived: false },
            select: {
              id: true,
              fileName: true,
              fileType: true,
              thumbnailUrl: true,
              createdAt: true,
            },
          },
        },
        orderBy: { followUpDate: 'desc' },
      });

      return followUps;
    } catch (error) {
      logger.error(`Error fetching follow-ups for surgery ${surgeryId}:`, error);
      throw error;
    }
  }

  /**
   * Get all follow-ups for a surgeon
   */
  async getFollowUpsBySurgeon(surgeonId: string, status?: FollowUpStatus, options?: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
  }) {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const skip = (page - 1) * limit;
      const sortBy = options?.sortBy || 'followUpDate';
      const order = options?.order || 'desc';

      const whereClause: any = {
        surgeonId,
        isArchived: false,
        ...(status && { status }),
      };

      if (options?.search) {
        whereClause.OR = [
          { description: { contains: options.search, mode: 'insensitive' } },
          { observations: { contains: options.search, mode: 'insensitive' } },
          { surgery: { patient: { fullName: { contains: options.search, mode: 'insensitive' } } } },
        ];
      }

      const [followUps, total] = await Promise.all([
        prisma.followUp.findMany({
          where: whereClause,
          include: {
            surgery: {
              include: {
                patient: {
                  select: {
                    id: true,
                    patientId: true,
                    fullName: true,
                    contactNumber: true,
                  },
                },
              },
            },
            media: {
              where: { isArchived: false },
              select: {
                id: true,
                fileType: true,
              },
            },
            reminders: {
              orderBy: { scheduledFor: 'asc' },
            },
          },
          orderBy: { [sortBy]: order },
          skip,
          take: limit,
        }),
        prisma.followUp.count({ where: whereClause }),
      ]);

      return {
        data: followUps,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error(`Error fetching follow-ups for surgeon ${surgeonId}:`, error);
      throw error;
    }
  }

  /**
   * Get all follow-ups for assigned patients (moderator view)
   */
  async getFollowUpsByModerator(moderatorId: string, status?: FollowUpStatus, options?: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
  }) {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const skip = (page - 1) * limit;
      const sortBy = options?.sortBy || 'followUpDate';
      const order = options?.order || 'desc';

      // First, get all patients assigned to this moderator via PatientModerator join table
      const assignedPatients = await prisma.patientModerator.findMany({
        where: {
          moderatorId,
          status: 'ACCEPTED', // Only accepted assignments
        },
        select: {
          patientId: true,
        },
      });

      const patientIds = assignedPatients.map(p => p.patientId);

      // If no patients assigned, return empty result
      if (patientIds.length === 0) {
        return {
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        };
      }

      const whereClause: any = {
        surgery: {
          patientId: {
            in: patientIds,
          },
        },
        isArchived: false,
        ...(status && { status }),
      };

      if (options?.search) {
        whereClause.OR = [
          { description: { contains: options.search, mode: 'insensitive' } },
          { observations: { contains: options.search, mode: 'insensitive' } },
          { surgery: { patient: { fullName: { contains: options.search, mode: 'insensitive' } } } },
        ];
      }

      const [followUps, total] = await Promise.all([
        prisma.followUp.findMany({
          where: whereClause,
          include: {
            surgery: {
              include: {
                patient: {
                  select: {
                    id: true,
                    patientId: true,
                    fullName: true,
                    contactNumber: true,
                  },
                },
              },
            },
            surgeon: {
              select: {
                id: true,
                fullName: true,
                specialization: true,
              },
            },
            media: {
              where: { isArchived: false },
              select: {
                id: true,
                fileType: true,
              },
            },
            reminders: {
              orderBy: { scheduledFor: 'asc' },
            },
          },
          orderBy: { [sortBy]: order },
          skip,
          take: limit,
        }),
        prisma.followUp.count({ where: whereClause }),
      ]);

      return {
        data: followUps,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error(`Error fetching follow-ups for moderator ${moderatorId}:`, error);
      throw error;
    }
  }

  /**
   * Get all follow-ups for a patient
   */
  async getFollowUpsByPatient(patientId: string, options?: {
    page?: number;
    limit?: number;
    status?: FollowUpStatus;
    sortBy?: string;
    order?: 'asc' | 'desc';
  }) {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const skip = (page - 1) * limit;
      const sortBy = options?.sortBy || 'followUpDate';
      const order = options?.order || 'desc';

      const whereClause: any = {
        surgery: {
          patientId,
        },
        isArchived: false,
        visibility: RecordVisibility.PUBLIC, // Only public follow-ups for patients
        ...(options?.status && { status: options.status }),
      };

      const [followUps, total] = await Promise.all([
        prisma.followUp.findMany({
          where: whereClause,
          include: {
            surgery: {
              select: {
                id: true,
                diagnosis: true,
                procedureName: true,
                surgeryDate: true,
              },
            },
            surgeon: {
              select: {
                id: true,
                fullName: true,
                specialization: true,
              },
            },
            media: {
              where: {
                isArchived: false,
                visibility: RecordVisibility.PUBLIC,
              },
              select: {
                id: true,
                fileName: true,
                fileType: true,
                thumbnailUrl: true,
                createdAt: true,
              },
            },
          },
          orderBy: { [sortBy]: order },
          skip,
          take: limit,
        }),
        prisma.followUp.count({ where: whereClause }),
      ]);

      return {
        data: followUps,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error(`Error fetching follow-ups for patient ${patientId}:`, error);
      throw error;
    }
  }

  /**
   * Get all follow-ups (Admin only)
   */
  async getAllFollowUps(status?: FollowUpStatus) {
    try {
      const followUps = await prisma.followUp.findMany({
        where: {
          isArchived: false,
          ...(status && { status }),
        },
        include: {
          surgery: {
            include: {
              patient: {
                select: {
                  id: true,
                  patientId: true,
                  fullName: true,
                  contactNumber: true,
                },
              },
            },
          },
          surgeon: {
            select: {
              id: true,
              fullName: true,
              specialization: true,
            },
          },
          media: {
            where: { isArchived: false },
            select: {
              id: true,
              fileType: true,
            },
          },
          reminders: {
            orderBy: { scheduledFor: 'asc' },
          },
        },
        orderBy: { followUpDate: 'desc' },
      });

      return followUps;
    } catch (error) {
      logger.error('Error fetching all follow-ups:', error);
      throw error;
    }
  }

  /**
   * Update follow-up
   */
  async updateFollowUp(id: string, data: UpdateFollowUpData, modifiedBy: string, isDoctor: boolean = true) {
    try {
      const updateData: any = {
        ...data,
        lastModifiedBy: modifiedBy,
      };

      // Track updates from doctor vs patient
      if (isDoctor) {
        updateData.lastDoctorUpdate = new Date();
      } else {
        updateData.lastPatientUpdate = new Date();
      }

      // Convert date if provided
      if (data.followUpDate) {
        updateData.followUpDate = new Date(data.followUpDate);
      }

      const followUp = await prisma.followUp.update({
        where: { id },
        data: updateData,
        include: {
          surgery: {
            include: {
              patient: true,
            },
          },
          surgeon: true,
          media: {
            where: { isArchived: false },
          },
        },
      });

      logger.info(`Follow-up updated: ${id} by ${modifiedBy}`);
      return followUp;
    } catch (error) {
      logger.error(`Error updating follow-up ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update follow-up status
   */
  async updateFollowUpStatus(id: string, status: FollowUpStatus, modifiedBy: string) {
    try {
      const followUp = await prisma.followUp.update({
        where: { id },
        data: {
          status,
          lastModifiedBy: modifiedBy,
          lastDoctorUpdate: new Date(),
        },
        include: {
          surgery: {
            include: {
              patient: true,
            },
          },
          surgeon: true,
        },
      });

      logger.info(`Follow-up status updated: ${id} to ${status}`);
      return followUp;
    } catch (error) {
      logger.error(`Error updating follow-up status ${id}:`, error);
      throw error;
    }
  }

  /**
   * Archive follow-up (soft delete)
   */
  async archiveFollowUp(id: string, archivedBy: string) {
    try {
      const followUp = await prisma.followUp.update({
        where: { id },
        data: {
          isArchived: true,
          archivedAt: new Date(),
          archivedBy,
        },
      });

      logger.info(`Follow-up archived: ${id} by ${archivedBy}`);
      return followUp;
    } catch (error) {
      logger.error(`Error archiving follow-up ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get upcoming follow-ups (for reminders)
   */
  async getUpcomingFollowUps(daysAhead: number = 7) {
    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + daysAhead);

      const followUps = await prisma.followUp.findMany({
        where: {
          followUpDate: {
            gte: today,
            lte: futureDate,
          },
          status: FollowUpStatus.PENDING,
          isArchived: false,
        },
        include: {
          surgery: {
            include: {
              patient: {
                select: {
                  id: true,
                  fullName: true,
                  contactNumber: true,
                  whatsappNumber: true,
                },
              },
            },
          },
          surgeon: {
            select: {
              id: true,
              fullName: true,
              contactNumber: true,
              whatsappNumber: true,
            },
          },
        },
        orderBy: { followUpDate: 'asc' },
      });

      return followUps;
    } catch (error) {
      logger.error('Error fetching upcoming follow-ups:', error);
      throw error;
    }
  }

  /**
   * Search follow-ups
   */
  async searchFollowUps(query: string) {
    try {
      const followUps = await prisma.followUp.findMany({
        where: {
          isArchived: false,
          OR: [
            {
              description: {
                contains: query,
                mode: 'insensitive',
              },
            },
            {
              observations: {
                contains: query,
                mode: 'insensitive',
              },
            },
            {
              surgery: {
                patient: {
                  fullName: {
                    contains: query,
                    mode: 'insensitive',
                  },
                },
              },
            },
          ],
        },
        include: {
          surgery: {
            include: {
              patient: {
                select: {
                  id: true,
                  patientId: true,
                  fullName: true,
                },
              },
            },
          },
          surgeon: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
        orderBy: { followUpDate: 'desc' },
        take: 50,
      });

      return followUps;
    } catch (error) {
      logger.error('Error searching follow-ups:', error);
      throw error;
    }
  }
}

export default new FollowUpService();
