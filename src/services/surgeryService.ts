import { prisma } from '../config/database';
import { logger } from '../config/logger';

export enum DoctorRole {
  PERFORMED = 'PERFORMED',
  ASSISTED = 'ASSISTED',
  SUPERVISED = 'SUPERVISED',
  OBSERVED = 'OBSERVED',
}

export enum RecordVisibility {
  PRIVATE = 'PRIVATE',
  PUBLIC = 'PUBLIC',
}

interface Surgery {
  id: string;
  patientId: string;
  doctorId: string;
  diagnosis: string;
  briefHistory: string;
  preOpFindings: string;
  procedureName: string;
  procedureDetails: string;
  doctorRole: DoctorRole;
  surgeryDate: Date;
  visibility: RecordVisibility;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

interface CreateSurgeryData {
  patient: { connect: { id: string } };
  doctor: { connect: { id: string } };
  diagnosis: string;
  briefHistory: string;
  preOpFindings: string;
  procedureName: string;
  procedureDetails: string;
  doctorRole: DoctorRole;
  surgeryDate: Date;
  visibility?: RecordVisibility;
}

interface UpdateSurgeryData {
  diagnosis?: string;
  briefHistory?: string;
  preOpFindings?: string;
  procedureName?: string;
  procedureDetails?: string;
  doctorRole?: DoctorRole;
  surgeryDate?: Date;
  visibility?: RecordVisibility;
}

export class SurgeryService {
  async createSurgery(data: CreateSurgeryData, createdBy: string): Promise<Surgery> {
    try {
      const surgery = await prisma.surgery.create({
        data: {
          ...data,
          createdBy,
        },
        include: {
          patient: true,
          doctor: true,
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
          doctor: {
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

  async getSurgeriesByPatient(patientId: string): Promise<Surgery[]> {
    try {
      const surgeries = await prisma.surgery.findMany({
        where: {
          patientId,
          isArchived: false,
        },
        include: {
          doctor: {
            include: {
              user: { select: { email: true, role: true } },
            },
          },
          followUps: {
            where: { isArchived: false },
            orderBy: { followUpDate: 'desc' },
          },
        },
        orderBy: { surgeryDate: 'desc' },
      });
      return surgeries as unknown as Surgery[];
    } catch (error) {
      logger.error('Error fetching surgeries by patient:', error);
      throw error;
    }
  }

  async getSurgeriesByDoctor(doctorId: string): Promise<Surgery[]> {
    try {
      const surgeries = await prisma.surgery.findMany({
        where: {
          doctorId,
          isArchived: false,
        },
        include: {
          patient: {
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
      logger.error('Error fetching surgeries by doctor:', error);
      throw error;
    }
  }

  async updateSurgery(id: string, data: UpdateSurgeryData): Promise<Surgery> {
    try {
      const surgery = await prisma.surgery.update({
        where: { id },
        data,
        include: {
          patient: true,
          doctor: true,
        },
      });
      logger.info(`Surgery updated: ${id}`);
      return surgery as unknown as Surgery;
    } catch (error) {
      logger.error('Error updating surgery:', error);
      throw error;
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
                { diagnosis: { contains: searchTerm, mode: 'insensitive' } },
                { procedureName: { contains: searchTerm, mode: 'insensitive' } },
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
          doctor: {
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
