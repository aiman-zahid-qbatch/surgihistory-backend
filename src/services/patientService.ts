import { prisma } from '../config/database';
import { logger } from '../config/logger';

import notificationService from './notificationService';

interface Patient {
  id: string;
  userId: string;
  cnic: string;
  fullName: string;
  fatherName: string;
  contactNumber: string;
  address: string;
  assignedSurgeonId?: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CreatePatientData {
  user: {
    create: {
      email: string;
      password: string;
      role: string;
    };
  };
  patientId: string; // System-generated patient ID
  cnic: string;
  fullName: string;
  fatherName: string;
  contactNumber: string;
  whatsappNumber?: string;
  address: string;
  createdBy: {
    connect: { id: string };
  };
  assignedSurgeon?: {
    connect: { id: string };
  };
}

interface UpdatePatientData {
  fullName?: string;
  fatherName?: string;
  contactNumber?: string;
  whatsappNumber?: string;
  address?: string;
  cnic?: string;
  assignedSurgeonId?: string;
  assignedModeratorId?: string; // DEPRECATED - kept for backward compatibility
  assignedModeratorIds?: string[]; // New field for multiple moderators
}

export class PatientService {
  async createPatient(data: CreatePatientData & { assignedModeratorIds?: string[]; assignedBy?: string }): Promise<Patient> {
    try {
      const { assignedModeratorIds, assignedBy, ...patientData } = data;

      // Check if patient with this CNIC already exists
      if (patientData.cnic) {
        const existingPatient = await prisma.patient.findUnique({
          where: { cnic: patientData.cnic },
        });
        if (existingPatient) {
          throw new Error('Patient with this CNIC already exists');
        }
      }

      const patient = await prisma.patient.create({
        data: patientData,
        include: {
          user: { select: { email: true, role: true } },
          assignedSurgeon: { include: { user: true } },
          createdBy: { include: { user: true } },
        },
      });

      // If multiple moderators are provided, create the relationships and send notifications
      if (assignedModeratorIds && assignedModeratorIds.length > 0) {
        await prisma.patientModerator.createMany({
          data: assignedModeratorIds.map(moderatorId => ({
            patientId: patient.id,
            moderatorId,
            assignedBy: assignedBy,
            status: 'ASSIGNED',
          })),
        });

        // Get surgeon name for notification
        const surgeonName = (patient as any).createdBy?.fullName || 'A surgeon';

        // Get the created assignments to get their IDs
        const createdAssignments = await prisma.patientModerator.findMany({
          where: {
            patientId: patient.id,
            moderatorId: { in: assignedModeratorIds },
          },
        });

        // Send notification to each moderator
        for (const assignment of createdAssignments) {
          try {
            await notificationService.notifyPatientAssignmentRequest(
              assignment.moderatorId,
              patient.fullName,
              patient.id,
              surgeonName,
              assignment.id
            );
          } catch (notifError) {
            logger.error(`Error sending assignment notification to moderator ${assignment.moderatorId}:`, notifError);
          }
        }
      }

      logger.info(`Patient created: ${patient.id} with ${assignedModeratorIds?.length || 0} moderators`);
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
          assignedSurgeon: { include: { user: true } },
          createdBy: { include: { user: true } },
          surgeries: {
            where: { isArchived: false },
            orderBy: { surgeryDate: 'desc' },
          },
          assignedModerators: {
            include: {
              moderator: {
                select: {
                  id: true,
                  fullName: true,
                  user: { select: { email: true, isActive: true } },
                },
              },
            },
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

  async getAllPatients(createdById?: string, assignedModeratorId?: string): Promise<Patient[]> {
    try {
      const whereClause: any = { isArchived: false };

      // If createdById is provided, filter by it (for surgeons/doctors)
      if (createdById) {
        whereClause.createdById = createdById;
      }

      // If assignedModeratorId is provided, filter by accepted assignments (for moderators)
      if (assignedModeratorId) {
        whereClause.assignedModerators = {
          some: {
            moderatorId: assignedModeratorId,
            status: 'ACCEPTED', // Only show patients with accepted assignments
          },
        };
      }

      const patients = await prisma.patient.findMany({
        where: whereClause,
        include: {
          user: { select: { email: true, role: true } },
          assignedSurgeon: { include: { user: true } },
          createdBy: { include: { user: true } },
          assignedModerators: {
            include: {
              moderator: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return patients as unknown as Patient[];
    } catch (error) {
      logger.error('Error fetching patients:', error);
      throw error;
    }
  }

  async updatePatient(id: string, data: UpdatePatientData & { assignedModeratorIds?: string[]; assignedBy?: string }): Promise<Patient> {
    try {
      const { assignedModeratorIds, assignedBy, ...updateData } = data;

      // Get existing moderator IDs before update
      const existingAssignments = await prisma.patientModerator.findMany({
        where: { patientId: id },
        select: { moderatorId: true },
      });
      const existingModeratorIds = existingAssignments.map(a => a.moderatorId);

      const patient = await prisma.patient.update({
        where: { id },
        data: updateData,
        include: {
          user: { select: { email: true, role: true } },
          assignedSurgeon: { include: { user: true } },
          createdBy: { include: { user: true } },
        },
      });

      // If assignedModeratorIds is provided, update moderator assignments
      if (assignedModeratorIds !== undefined) {
        // Find new moderators (not in existing list)
        const newModeratorIds = assignedModeratorIds.filter(
          modId => !existingModeratorIds.includes(modId)
        );

        // Delete existing moderator assignments
        await prisma.patientModerator.deleteMany({
          where: { patientId: id },
        });

        // Create new moderator assignments
        if (assignedModeratorIds.length > 0) {
          await prisma.patientModerator.createMany({
            data: assignedModeratorIds.map(moderatorId => ({
              patientId: id,
              moderatorId,
              assignedBy: assignedBy,
              status: 'ASSIGNED',
            })),
          });

          // Send notifications only to newly assigned moderators
          if (newModeratorIds.length > 0) {
            const surgeonName = (patient as any).createdBy?.fullName || 'A surgeon';
            
            // Get the created assignments for new moderators
            const newAssignments = await prisma.patientModerator.findMany({
              where: {
                patientId: id,
                moderatorId: { in: newModeratorIds },
              },
            });

            for (const assignment of newAssignments) {
              try {
                await notificationService.notifyPatientAssignmentRequest(
                  assignment.moderatorId,
                  patient.fullName,
                  patient.id,
                  surgeonName,
                  assignment.id
                );
              } catch (notifError) {
                logger.error(`Error sending assignment notification to moderator ${assignment.moderatorId}:`, notifError);
              }
            }
          }
        }
      }

      logger.info(`Patient updated: ${id}`);
      return patient as unknown as Patient;
    } catch (error) {
      logger.error('Error updating patient:', error);
      throw error;
    }
  }

  /**
   * Get assigned moderators for a patient
   */
  async getPatientModerators(patientId: string) {
    try {
      return await prisma.patientModerator.findMany({
        where: { patientId },
        include: {
          moderator: {
            include: {
              user: {
                select: {
                  email: true,
                  name: true,
                  isActive: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching patient moderators:', error);
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
                { fullName: { contains: searchTerm } },
                { cnic: { contains: searchTerm } },
                { contactNumber: { contains: searchTerm } },
              ],
            },
          ],
        },
        include: {
          user: { select: { email: true, role: true } },
          assignedSurgeon: { include: { user: true } },
          createdBy: { include: { user: true } },
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
