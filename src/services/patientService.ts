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
  async createPatient(data: CreatePatientData & { assignedModeratorIds?: string[]; assignedBy?: string; assignedByRole?: string }): Promise<Patient> {
    try {
      const { assignedModeratorIds, assignedBy, assignedByRole, ...patientData } = data;

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
        // Auto-accept if assigned by admin, otherwise set to PENDING for surgeon assignments
        const status = assignedByRole === 'ADMIN' ? 'ACCEPTED' : 'PENDING';
        
        await prisma.patientModerator.createMany({
          data: assignedModeratorIds.map(moderatorId => ({
            patientId: patient.id,
            moderatorId,
            assignedBy: assignedBy,
            status: status,
            ...(status === 'ACCEPTED' ? { respondedAt: new Date() } : {}),
          })),
        });

        // Get surgeon name for notification
        const surgeonName = (patient as any).createdBy?.fullName || (assignedByRole === 'ADMIN' ? 'Admin' : 'A surgeon');

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
            if (status === 'ACCEPTED') {
              // Notify moderator that they've been assigned (auto-accepted by admin)
              await notificationService.createNotification({
                recipientId: assignment.moderatorId,
                recipientRole: 'MODERATOR',
                type: 'ASSIGNMENT_ACCEPTED',
                title: 'Patient Assigned',
                message: `Admin has assigned patient "${patient.fullName}" to you. You now have access to their records.`,
                entityType: 'patient',
                entityId: patient.id,
                priority: 'normal',
                badgeColor: 'green',
                patientId: patient.id,
              });
            } else {
              // Regular assignment request notification (for surgeon assignments)
              await notificationService.notifyPatientAssignmentRequest(
                assignment.moderatorId,
                patient.fullName,
                patient.id,
                surgeonName,
                assignment.id
              );
            }
          } catch (notifError) {
            logger.error(`Error sending assignment notification to moderator ${assignment.moderatorId}:`, notifError);
          }
        }

        // If auto-accepted, also notify the patient
        if (status === 'ACCEPTED') {
          for (const moderatorId of assignedModeratorIds) {
            try {
              const moderator = await prisma.moderator.findUnique({
                where: { id: moderatorId },
                select: { fullName: true },
              });
              if (moderator) {
                await notificationService.notifyPatientModeratorAssigned(
                  patient.id,
                  moderator.fullName || 'A care coordinator'
                );
              }
            } catch (notifError) {
              logger.error(`Error sending patient notification:`, notifError);
            }
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

  async getAllPatients(createdById?: string, assignedModeratorId?: string, assignedSurgeonId?: string): Promise<Patient[]> {
    try {
      const whereClause: any = { isArchived: false };

      // For surgeons, show patients they created OR patients assigned to them
      if (createdById || assignedSurgeonId) {
        const surgeonConditions: any[] = [];
        if (createdById) {
          surgeonConditions.push({ createdById });
        }
        if (assignedSurgeonId) {
          surgeonConditions.push({ assignedSurgeonId });
        }
        if (surgeonConditions.length > 0) {
          whereClause.OR = surgeonConditions;
        }
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

  async updatePatient(id: string, data: UpdatePatientData & { assignedModeratorIds?: string[]; assignedBy?: string; assignedByRole?: string }): Promise<Patient> {
    try {
      const { assignedModeratorIds, assignedBy, assignedByRole, ...updateData } = data;

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

        // Auto-accept if assigned by admin, otherwise set to PENDING for surgeon assignments
        const status = assignedByRole === 'ADMIN' ? 'ACCEPTED' : 'PENDING';

        // Create new moderator assignments
        if (assignedModeratorIds.length > 0) {
          await prisma.patientModerator.createMany({
            data: assignedModeratorIds.map(moderatorId => ({
              patientId: id,
              moderatorId,
              assignedBy: assignedBy,
              status: status,
              ...(status === 'ACCEPTED' ? { respondedAt: new Date() } : {}),
            })),
          });

          // Send notifications only to newly assigned moderators
          if (newModeratorIds.length > 0) {
            const surgeonName = (patient as any).createdBy?.fullName || (assignedByRole === 'ADMIN' ? 'Admin' : 'A surgeon');
            
            // Get the created assignments for new moderators
            const newAssignments = await prisma.patientModerator.findMany({
              where: {
                patientId: id,
                moderatorId: { in: newModeratorIds },
              },
            });

            for (const assignment of newAssignments) {
              try {
                if (status === 'ACCEPTED') {
                  // Notify moderator that they've been assigned (auto-accepted by admin)
                  await notificationService.createNotification({
                    recipientId: assignment.moderatorId,
                    recipientRole: 'MODERATOR',
                    type: 'ASSIGNMENT_ACCEPTED',
                    title: 'Patient Assigned',
                    message: `Admin has assigned patient "${patient.fullName}" to you. You now have access to their records.`,
                    entityType: 'patient',
                    entityId: patient.id,
                    priority: 'normal',
                    badgeColor: 'green',
                    patientId: patient.id,
                  });

                  // Notify patient about the assignment
                  const moderator = await prisma.moderator.findUnique({
                    where: { id: assignment.moderatorId },
                    select: { fullName: true },
                  });
                  if (moderator) {
                    await notificationService.notifyPatientModeratorAssigned(
                      patient.id,
                      moderator.fullName || 'A care coordinator'
                    );
                  }
                } else {
                  // Regular assignment request notification (for surgeon assignments)
                  await notificationService.notifyPatientAssignmentRequest(
                    assignment.moderatorId,
                    patient.fullName,
                    patient.id,
                    surgeonName,
                    assignment.id
                  );
                }
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
