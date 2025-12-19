import { prisma } from '../config/database';
import { logger } from '../config/logger';


interface Surgery {
  id: string;
  patientId: string;
  surgeonId: string;
  diagnosis: string;
  customDiagnosis?: string;
  briefHistory: string;
  preOpFindings: string;
  procedureName: string;
  customProcedure?: string;
  procedureDetails: string;
  surgeryRole: string;
  surgeryDate: Date;
  surgeryTime?: string;
  visibility: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastModifiedBy?: string;
}

interface CreateSurgeryData {
  patientId: string;
  surgeonId: string;
  diagnosis: string;
  customDiagnosis?: string;
  briefHistory: string;
  preOpFindings: string;
  procedureName: string;
  customProcedure?: string;
  procedureDetails: string;
  surgeryRole: string;
  surgeryDate: Date;
  surgeryTime?: string;
  visibility?: string;
  createdBy: string;
}

interface UpdateSurgeryData {
  diagnosis?: string;
  customDiagnosis?: string;
  briefHistory?: string;
  preOpFindings?: string;
  procedureName?: string;
  customProcedure?: string;
  procedureDetails?: string;
  surgeryRole?: string;
  surgeryDate?: Date;
  surgeryTime?: string;
  visibility?: string;
  lastModifiedBy?: string;
}

export class SurgeryService {
  async createSurgery(data: CreateSurgeryData): Promise<Surgery> {
    try {
      const surgery = await prisma.surgery.create({
        data: {
          patient: { connect: { id: data.patientId } },
          surgeon: { connect: { id: data.surgeonId } },
          diagnosis: data.diagnosis,
          customDiagnosis: data.customDiagnosis,
          briefHistory: data.briefHistory,
          preOpFindings: data.preOpFindings,
          procedureName: data.procedureName,
          customProcedure: data.customProcedure,
          procedureDetails: data.procedureDetails,
          surgeryRole: data.surgeryRole,
          surgeryDate: data.surgeryDate,
          surgeryTime: data.surgeryTime,
          visibility: data.visibility || 'PUBLIC',
          createdBy: data.createdBy,
        },
        include: {
          patient: {
            include: {
              user: { select: { email: true, role: true, name: true } },
            },
          },
          surgeon: {
            include: {
              user: { select: { email: true, role: true, name: true } },
            },
          },
        },
      });
      logger.info(`Surgery created: ${surgery.id}`);
      return surgery as unknown as Surgery;
    } catch (error) {
      logger.error('Error creating surgery:', error);
      throw error;
    }
  }

  async getSurgeryById(id: string): Promise<Surgery | null> {
    try {
      const surgery = await prisma.surgery.findUnique({
        where: { id, isArchived: false },
        include: {
          patient: {
            include: {
              user: { select: { email: true, role: true } },
            },
          },
          surgeon: {
            include: {
              user: { select: { email: true, role: true } },
            },
          },
          followUps: {
            where: { isArchived: false },
            orderBy: { followUpDate: 'desc' },
            include: {
              media: true,
            },
          },
        },
      });
      return surgery as unknown as Surgery;
    } catch (error) {
      logger.error('Error fetching surgery:', error);
      throw error;
    }
  }

  async getSurgeriesByPatient(patientId: string, options?: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
  }): Promise<{ data: Surgery[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const skip = (page - 1) * limit;
      const sortBy = options?.sortBy || 'surgeryDate';
      const order = options?.order || 'desc';

      const whereClause: any = {
        patientId,
        isArchived: false,
      };

      if (options?.search) {
        whereClause.OR = [
          { diagnosis: { contains: options.search } },
          { procedureName: { contains: options.search } },
        ];
      }

      const [surgeries, total] = await Promise.all([
        prisma.surgery.findMany({
          where: whereClause,
          include: {
            surgeon: {
              include: {
                user: { select: { email: true, role: true } },
              },
            },
            _count: {
              select: { followUps: { where: { isArchived: false } } },
            },
          },
          orderBy: { [sortBy]: order },
          skip,
          take: limit,
        }),
        prisma.surgery.count({ where: whereClause }),
      ]);

      return {
        data: surgeries as unknown as Surgery[],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Error fetching surgeries by patient:', error);
      throw error;
    }
  }

  async getSurgeriesBySurgeon(surgeonId: string, options?: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
  }): Promise<{ data: Surgery[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const skip = (page - 1) * limit;
      const sortBy = options?.sortBy || 'surgeryDate';
      const order = options?.order || 'desc';

      const whereClause: any = {
        surgeonId,
        isArchived: false,
      };

      if (options?.search) {
        whereClause.OR = [
          { diagnosis: { contains: options.search } },
          { procedureName: { contains: options.search } },
          { patient: { fullName: { contains: options.search } } },
        ];
      }

      const [surgeries, total] = await Promise.all([
        prisma.surgery.findMany({
          where: whereClause,
          include: {
            patient: {
              include: {
                user: { select: { email: true, role: true } },
              },
            },
            _count: {
              select: { followUps: { where: { isArchived: false } } },
            },
          },
          orderBy: { [sortBy]: order },
          skip,
          take: limit,
        }),
        prisma.surgery.count({ where: whereClause }),
      ]);

      return {
        data: surgeries as unknown as Surgery[],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Error fetching surgeries by doctor:', error);
      throw error;
    }
  }

  async getAllSurgeries(): Promise<Surgery[]> {
    try {
      const surgeries = await prisma.surgery.findMany({
        where: {
          isArchived: false,
        },
        include: {
          patient: {
            include: {
              user: { select: { email: true, role: true } },
            },
          },
          surgeon: {
            include: {
              user: { select: { email: true, role: true } },
            },
          },
          followUps: {
            where: { isArchived: false },
          },
        },
        orderBy: { surgeryDate: 'desc' },
      });
      return surgeries as unknown as Surgery[];
    } catch (error) {
      logger.error('Error fetching all surgeries:', error);
      throw error;
    }
  }

  async updateSurgery(id: string, data: UpdateSurgeryData, userId: string): Promise<Surgery> {
    try {
      // First check if surgery exists and get createdBy
      const existingSurgery = await prisma.surgery.findUnique({
        where: { id },
        include: {
          patient: {
            include: {
              assignedSurgeon: true,
            },
          },
        },
      });

      if (!existingSurgery) {
        throw new Error('Surgery not found');
      }

      const surgery = await prisma.surgery.update({
        where: { id },
        data: {
          ...data,
          lastModifiedBy: userId,
        },
        include: {
          patient: {
            include: {
              user: { select: { email: true, role: true, name: true } },
            },
          },
          surgeon: {
            include: {
              user: { select: { email: true, role: true, name: true } },
            },
          },
        },
      });
      logger.info(`Surgery updated: ${id} by user: ${userId}`);
      return surgery as unknown as Surgery;
    } catch (error) {
      logger.error('Error updating surgery:', error);
      throw error;
    }
  }

  // Get surgeon profile by user ID
  async getSurgeonByUserId(userId: string): Promise<{ id: string } | null> {
    try {
      const surgeon = await prisma.surgeon.findUnique({
        where: { userId },
        select: { id: true },
      });
      return surgeon;
    } catch (error) {
      logger.error('Error getting surgeon by user ID:', error);
      return null;
    }
  }

  // Check if user can edit surgery (creator or assigned moderator)
  async canEditSurgery(surgeryId: string, userId: string): Promise<boolean> {
    try {
      const surgery = await prisma.surgery.findUnique({
        where: { id: surgeryId },
        include: {
          patient: {
            include: {
              assignedSurgeon: true,
            },
          },
        },
      });

      if (!surgery) {
        return false;
      }

      // Creator can always edit
      if (surgery.createdBy === userId) {
        return true;
      }

      // Assigned surgeon can edit
      if (surgery.patient.assignedSurgeonId) {
        const assignedSurgeon = await prisma.surgeon.findUnique({
          where: { id: surgery.patient.assignedSurgeonId },
        });

        if (assignedSurgeon && assignedSurgeon.userId === userId) {
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Error checking edit permission:', error);
      return false;
    }
  }

  async archiveSurgery(id: string): Promise<Surgery> {
    try {
      const surgery = await prisma.surgery.update({
        where: { id },
        data: { isArchived: true },
      });
      logger.info(`Surgery archived: ${id}`);
      return surgery as unknown as Surgery;
    } catch (error) {
      logger.error('Error archiving surgery:', error);
      throw error;
    }
  }

  async searchSurgeries(searchTerm: string): Promise<Surgery[]> {
    try {
      const surgeries = await prisma.surgery.findMany({
        where: {
          AND: [
            { isArchived: false },
            {
              OR: [
                { diagnosis: { contains: searchTerm } },
                { procedureName: { contains: searchTerm } },
              ],
            },
          ],
        },
        include: {
          patient: {
            include: {
              user: { select: { email: true, role: true } },
            },
          },
          surgeon: {
            include: {
              user: { select: { email: true, role: true } },
            },
          },
        },
        orderBy: { surgeryDate: 'desc' },
      });
      return surgeries as unknown as Surgery[];
    } catch (error) {
      logger.error('Error searching surgeries:', error);
      throw error;
    }
  }
}

export default new SurgeryService();
