import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import notificationService from './notificationService';

const prisma = new PrismaClient();

export class PatientModeratorService {
  /**
   * Get pending assignment requests for a moderator
   */
  async getPendingAssignments(moderatorId: string) {
    try {
      const assignments = await prisma.patientModerator.findMany({
        where: {
          moderatorId,
          status: 'PENDING',
        },
        include: {
          patient: {
            include: {
              assignedSurgeon: {
                select: {
                  id: true,
                  fullName: true,
                  specialization: true,
                },
              },
              createdBy: {
                select: {
                  id: true,
                  fullName: true,
                  specialization: true,
                },
              },
            },
          },
        },
        orderBy: {
          assignedAt: 'desc',
        },
      });

      return assignments;
    } catch (error) {
      logger.error('Error fetching pending assignments:', error);
      throw error;
    }
  }

  /**
   * Accept a patient assignment
   */
  async acceptAssignment(assignmentId: string, moderatorId: string) {
    try {
      // Verify the assignment belongs to this moderator
      const assignment = await prisma.patientModerator.findFirst({
        where: {
          id: assignmentId,
          moderatorId,
          status: 'PENDING',
        },
        include: {
          moderator: {
            select: { fullName: true },
          },
        },
      });

      if (!assignment) {
        throw new Error('Assignment not found or already processed');
      }

      const updatedAssignment = await prisma.patientModerator.update({
        where: { id: assignmentId },
        data: {
          status: 'ACCEPTED',
          respondedAt: new Date(),
        },
        include: {
          patient: {
            include: {
              assignedSurgeon: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
              createdBy: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
        },
      });

      // Notify the surgeon about the acceptance
      const surgeonId = updatedAssignment.patient.assignedSurgeon?.id || 
                        updatedAssignment.patient.createdBy?.id;
      
      if (surgeonId) {
        try {
          await notificationService.notifyAssignmentAccepted(
            surgeonId,
            assignment.moderator.fullName || 'A moderator',
            updatedAssignment.patient.fullName,
            updatedAssignment.patient.id
          );
        } catch (notifError) {
          logger.error('Error sending assignment accepted notification:', notifError);
        }
      }

      // Notify the patient that a moderator has been assigned
      try {
        await notificationService.notifyPatientModeratorAssigned(
          updatedAssignment.patient.id,
          assignment.moderator.fullName || 'A care coordinator'
        );
      } catch (notifError) {
        logger.error('Error sending patient moderator assigned notification:', notifError);
      }

      logger.info(`Assignment ${assignmentId} accepted by moderator ${moderatorId}`);
      return updatedAssignment;
    } catch (error) {
      logger.error('Error accepting assignment:', error);
      throw error;
    }
  }

  /**
   * Reject a patient assignment
   */
  async rejectAssignment(assignmentId: string, moderatorId: string) {
    try {
      // Verify the assignment belongs to this moderator
      const assignment = await prisma.patientModerator.findFirst({
        where: {
          id: assignmentId,
          moderatorId,
          status: 'PENDING',
        },
        include: {
          moderator: {
            select: { fullName: true },
          },
        },
      });

      if (!assignment) {
        throw new Error('Assignment not found or already processed');
      }

      const updatedAssignment = await prisma.patientModerator.update({
        where: { id: assignmentId },
        data: {
          status: 'REJECTED',
          respondedAt: new Date(),
        },
        include: {
          patient: {
            include: {
              assignedSurgeon: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
              createdBy: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
        },
      });

      // Notify the surgeon about the rejection
      const surgeonId = updatedAssignment.patient.assignedSurgeon?.id || 
                        updatedAssignment.patient.createdBy?.id;
      
      if (surgeonId) {
        try {
          await notificationService.notifyAssignmentRejected(
            surgeonId,
            assignment.moderator.fullName || 'A moderator',
            updatedAssignment.patient.fullName,
            updatedAssignment.patient.id
          );
        } catch (notifError) {
          logger.error('Error sending assignment rejected notification:', notifError);
        }
      }

      logger.info(`Assignment ${assignmentId} rejected by moderator ${moderatorId}`);
      return updatedAssignment;
    } catch (error) {
      logger.error('Error rejecting assignment:', error);
      throw error;
    }
  }

  /**
   * Get all assignments for a moderator (with status filter)
   */
  async getAssignmentsByModerator(moderatorId: string, status?: string) {
    try {
      const assignments = await prisma.patientModerator.findMany({
        where: {
          moderatorId,
          ...(status && { status }),
        },
        include: {
          patient: {
            include: {
              assignedSurgeon: {
                select: {
                  id: true,
                  fullName: true,
                  specialization: true,
                },
              },
              createdBy: {
                select: {
                  id: true,
                  fullName: true,
                  specialization: true,
                },
              },
            },
          },
        },
        orderBy: {
          assignedAt: 'desc',
        },
      });

      return assignments;
    } catch (error) {
      logger.error('Error fetching assignments:', error);
      throw error;
    }
  }

  /**
   * Get assignment count by status for a moderator
   */
  async getAssignmentCounts(moderatorId: string) {
    try {
      const [pending, accepted, rejected] = await Promise.all([
        prisma.patientModerator.count({
          where: { moderatorId, status: 'PENDING' },
        }),
        prisma.patientModerator.count({
          where: { moderatorId, status: 'ACCEPTED' },
        }),
        prisma.patientModerator.count({
          where: { moderatorId, status: 'REJECTED' },
        }),
      ]);

      return {
        pending,
        accepted,
        rejected,
        total: pending + accepted + rejected,
      };
    } catch (error) {
      logger.error('Error fetching assignment counts:', error);
      throw error;
    }
  }

  /**
   * Get all moderator assignments for a specific patient
   */
  async getPatientModerators(patientId: string) {
    try {
      const assignments = await prisma.patientModerator.findMany({
        where: {
          patientId,
        },
        include: {
          moderator: {
            select: {
              id: true,
              fullName: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  isActive: true,
                },
              },
            },
          },
        },
        orderBy: {
          assignedAt: 'desc',
        },
      });

      return assignments;
    } catch (error) {
      logger.error('Error fetching patient moderators:', error);
      throw error;
    }
  }
}

export default new PatientModeratorService();
