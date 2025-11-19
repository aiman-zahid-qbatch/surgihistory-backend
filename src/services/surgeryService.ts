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
  customDiagnosis?: string;
  briefHistory: string;
  preOpFindings: string;
  procedureName: string;
  customProcedure?: string;
  procedureDetails: string;
  doctorRole: DoctorRole;
  surgeryDate: Date;
  surgeryTime?: string;
  visibility: RecordVisibility;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastModifiedBy?: string;
}

interface CreateSurgeryData {
  patientId: string;
  doctorId: string;
  diagnosis: string;
  customDiagnosis?: string;
  briefHistory: string;
  preOpFindings: string;
  procedureName: string;
  customProcedure?: string;
  procedureDetails: string;
  doctorRole: DoctorRole;
  surgeryDate: Date;
  surgeryTime?: string;
  visibility?: RecordVisibility;
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
  doctorRole?: DoctorRole;
  surgeryDate?: Date;
  surgeryTime?: string;
  visibility?: RecordVisibility;
  lastModifiedBy?: string;
}

export class SurgeryService {
  async createSurgery(data: CreateSurgeryData): Promise<Surgery> {
    try {
      const surgery = await prisma.surgery.create({
        data: {
          patient: { connect: { id: data.patientId } },
          doctor: { connect: { id: data.doctorId } },
          diagnosis: data.diagnosis,
          customDiagnosis: data.customDiagnosis,
          briefHistory: data.briefHistory,
          preOpFindings: data.preOpFindings,
          procedureName: data.procedureName,
          customProcedure: data.customProcedure,
          procedureDetails: data.procedureDetails,
          doctorRole: data.doctorRole,
          surgeryDate: data.surgeryDate,
          surgeryTime: data.surgeryTime,
          visibility: data.visibility || RecordVisibility.PUBLIC,
          createdBy: data.createdBy,
        },
        include: {
          patient: {
            include: {
              user: { select: { email: true, role: true, name: true } },
            },
          },
          doctor: {
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

  async updateSurgery(id: string, data: UpdateSurgeryData, userId: string): Promise<Surgery> {
    try {
      // First check if surgery exists and get createdBy
      const existingSurgery = await prisma.surgery.findUnique({
        where: { id },
        include: {
          patient: {
            include: {
              assignedDoctor: true,
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
          doctor: {
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

  // Check if user can edit surgery (creator or assigned moderator)
  async canEditSurgery(surgeryId: string, userId: string): Promise<boolean> {
    try {
      const surgery = await prisma.surgery.findUnique({
        where: { id: surgeryId },
        include: {
          patient: {
            include: {
              assignedDoctor: true,
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

      // Assigned moderator/doctor can edit
      if (surgery.patient.assignedDoctorId) {
        const assignedDoctor = await prisma.doctor.findUnique({
          where: { id: surgery.patient.assignedDoctorId },
        });
        
        if (assignedDoctor && assignedDoctor.userId === userId) {
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
