import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { DocumentRequestStatus, NotificationType, UserRole } from '@prisma/client';
import notificationService from './notificationService';

interface CreateDocumentRequestData {
  patientId: string;
  surgeonId?: string;
  followUpId?: string;
  title: string;
  description?: string;
  category?: string;
}

class DocumentRequestService {
  /**
   * Create a new document request
   */
  async createDocumentRequest(data: CreateDocumentRequestData) {
    try {
      const createData: any = {
        patientId: data.patientId,
        followUpId: data.followUpId,
        title: data.title,
        description: data.description,
        category: data.category,
        status: DocumentRequestStatus.PENDING,
      };

      // Only include surgeonId if provided
      if (data.surgeonId) {
        createData.surgeonId = data.surgeonId;
      }

      const documentRequest = await prisma.documentRequest.create({
        data: createData,
        include: {
          patient: {
            select: {
              id: true,
              fullName: true,
              userId: true,
            },
          },
          surgeon: {
            select: {
              id: true,
              fullName: true,
            },
          },
          followUp: {
            select: {
              id: true,
              followUpDate: true,
            },
          },
        },
      });

      logger.info(`Document request created: ${documentRequest.id}`);

      // Send notification to patient
      const notificationData: any = {
        recipientId: data.patientId,
        recipientRole: UserRole.PATIENT,
        type: NotificationType.DOCUMENT_REQUESTED,
        title: data.surgeonId ? 'Document Request from Your Doctor' : 'Document Request',
        message: data.surgeonId ? `Your doctor has requested: ${data.title}` : `Document requested: ${data.title}`,
        entityType: 'document_request',
        entityId: documentRequest.id,
        priority: 'high',
        badgeColor: 'blue',
        patientId: data.patientId,
      };

      if (data.surgeonId) {
        notificationData.surgeonId = data.surgeonId;
      }

      await notificationService.createNotification(notificationData);

      return documentRequest;
    } catch (error) {
      logger.error('Error creating document request:', error);
      throw error;
    }
  }

  /**
   * Get document requests by patient
   */
  async getDocumentRequestsByPatient(patientId: string) {
    try {
      const requests = await prisma.documentRequest.findMany({
        where: {
          patientId,
        },
        include: {
          surgeon: {
            select: {
              id: true,
              fullName: true,
            },
          },
          followUp: {
            select: {
              id: true,
              followUpDate: true,
            },
          },
          uploadedMedia: true,
        },
        orderBy: {
          requestedAt: 'desc',
        },
      });

      return requests;
    } catch (error) {
      logger.error('Error getting document requests by patient:', error);
      throw error;
    }
  }

  /**
   * Get document requests by surgeon
   */
  async getDocumentRequestsBySurgeon(surgeonId: string) {
    try {
      const requests = await prisma.documentRequest.findMany({
        where: {
          surgeonId,
        },
        include: {
          patient: {
            select: {
              id: true,
              fullName: true,
              patientId: true,
            },
          },
          followUp: {
            select: {
              id: true,
              followUpDate: true,
            },
          },
          uploadedMedia: true,
        },
        orderBy: {
          requestedAt: 'desc',
        },
      });

      return requests;
    } catch (error) {
      logger.error('Error getting document requests by surgeon:', error);
      throw error;
    }
  }

  /**
   * Get document requests for a specific patient (surgeon/moderator view)
   */
  async getDocumentRequestsForPatient(patientId: string, surgeonId?: string) {
    try {
      const whereClause: any = {
        patientId,
      };

      // Only filter by surgeonId if provided (for surgeons)
      if (surgeonId) {
        whereClause.surgeonId = surgeonId;
      }

      const requests = await prisma.documentRequest.findMany({
        where: whereClause,
        include: {
          followUp: {
            select: {
              id: true,
              followUpDate: true,
            },
          },
          uploadedMedia: true,
        },
        orderBy: {
          requestedAt: 'desc',
        },
      });

      return requests;
    } catch (error) {
      logger.error('Error getting document requests for patient:', error);
      throw error;
    }
  }

  /**
   * Mark document request as uploaded
   */
  async markAsUploaded(requestId: string, mediaId: string) {
    try {
      const documentRequest = await prisma.documentRequest.update({
        where: { id: requestId },
        data: {
          status: DocumentRequestStatus.UPLOADED,
          uploadedMediaId: mediaId,
          uploadedAt: new Date(),
        },
        include: {
          patient: {
            select: {
              id: true,
              fullName: true,
            },
          },
          surgeon: {
            select: {
              id: true,
              fullName: true,
              userId: true,
            },
          },
          uploadedMedia: true,
        },
      });

      logger.info(`Document request ${requestId} marked as uploaded`);

      // Send notification to surgeon (only if surgeon exists)
      if (documentRequest.surgeonId) {
        await notificationService.createNotification({
          recipientId: documentRequest.surgeonId,
          recipientRole: UserRole.SURGEON,
          type: NotificationType.DOCUMENT_UPLOADED,
          title: 'Document Request Fulfilled',
          message: `${documentRequest.patient.fullName} has uploaded the requested document: ${documentRequest.title}`,
          entityType: 'document_request',
          entityId: requestId,
          priority: 'normal',
          badgeColor: 'green',
          patientId: documentRequest.patientId,
          surgeonId: documentRequest.surgeonId,
        });
      }

      return documentRequest;
    } catch (error) {
      logger.error('Error marking document request as uploaded:', error);
      throw error;
    }
  }

  /**
   * Delete a document request
   */
  async deleteDocumentRequest(requestId: string) {
    try {
      await prisma.documentRequest.delete({
        where: { id: requestId },
      });

      logger.info(`Document request ${requestId} deleted`);
    } catch (error) {
      logger.error('Error deleting document request:', error);
      throw error;
    }
  }
}

export default new DocumentRequestService();
