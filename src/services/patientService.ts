import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { UserRole } from '@prisma/client';

interface Patient {
  id: string;
  userId: string;
  cnic: string;
  fullName: string;
  fatherName: string;
  contactNumber: string;
  address: string;
  assignedDoctorId?: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CreatePatientData {
  user: {
    create: {
      email: string;
      password: string;
      role: UserRole;
    };
  };
  patientId: string; // System-generated patient ID
  cnic: string;
  fullName: string;
  fatherName: string;
  contactNumber: string;
  whatsappNumber?: string;
  address: string;
  assignedDoctor?: {
    connect: { id: string };
  };
}

interface UpdatePatientData {
  fullName?: string;
  fatherName?: string;
  contactNumber?: string;
  address?: string;
  assignedDoctorId?: string;
}

interface PatientFilters {
  assignedDoctorId?: string;
  cnic?: string;
}

export class PatientService {
  async createPatient(data: CreatePatientData): Promise<Patient> {
    try {
      const patient = await prisma.patient.create({ 
        data,
        include: {
          user: { select: { email: true, role: true } },
          assignedDoctor: { include: { user: true } },
        },
      });
      logger.info(`Patient created: ${patient.id}`);
      return patient as unknown as Patient;
    } catch (error) {
      logger.error('Error creating patient:', error);
      throw error;
    }
  }

  async getPatientById(id: string): Promise<Patient | null> {
    try {
      const patient = await prisma.patient.findUnique({
        where: { id, isArchived: false },
        include: {
          user: { select: { email: true, role: true } },
          assignedDoctor: { include: { user: true } },
          surgeries: {
            where: { isArchived: false },
            orderBy: { surgeryDate: 'desc' },
          },
        },
      });
      return patient as unknown as Patient;
    } catch (error) {
      logger.error('Error fetching patient:', error);
      throw error;
    }
  }

  async getPatientByCnic(cnic: string): Promise<Patient | null> {
    try {
      const patient = await prisma.patient.findUnique({
        where: { cnic, isArchived: false },
      });
      return patient as unknown as Patient;
    } catch (error) {
      logger.error('Error fetching patient by CNIC:', error);
      throw error;
    }
  }

  async getAllPatients(filters?: PatientFilters): Promise<Patient[]> {
    try {
      const patients = await prisma.patient.findMany({
        where: { ...filters, isArchived: false },
        include: {
          user: { select: { email: true, role: true } },
          assignedDoctor: { include: { user: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return patients as unknown as Patient[];
    } catch (error) {
      logger.error('Error fetching patients:', error);
      throw error;
    }
  }

  async updatePatient(id: string, data: UpdatePatientData): Promise<Patient> {
    try {
      const patient = await prisma.patient.update({
        where: { id },
        data,
        include: {
          user: { select: { email: true, role: true } },
          assignedDoctor: { include: { user: true } },
        },
      });
      logger.info(`Patient updated: ${id}`);
      return patient as unknown as Patient;
    } catch (error) {
      logger.error('Error updating patient:', error);
      throw error;
    }
  }

  async archivePatient(id: string): Promise<Patient> {
    try {
      const patient = await prisma.patient.update({
        where: { id },
        data: { isArchived: true },
      });
      logger.info(`Patient archived: ${id}`);
      return patient as unknown as Patient;
    } catch (error) {
      logger.error('Error archiving patient:', error);
      throw error;
    }
  }

  async searchPatients(searchTerm: string): Promise<Patient[]> {
    try {
      const patients = await prisma.patient.findMany({
        where: {
          AND: [
            { isArchived: false },
            {
              OR: [
                { fullName: { contains: searchTerm, mode: 'insensitive' } },
                { cnic: { contains: searchTerm } },
                { contactNumber: { contains: searchTerm } },
              ],
            },
          ],
        },
        include: {
          user: { select: { email: true, role: true } },
          assignedDoctor: { include: { user: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return patients as unknown as Patient[];
    } catch (error) {
      logger.error('Error searching patients:', error);
      throw error;
    }
  }
}

export default new PatientService();
