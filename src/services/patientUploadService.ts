import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

interface CreatePatientUploadData {
  patientId: string;
  fileName: string;
  originalName: string;
  fileType: string;
  mimeType: string;
  fileUrl: string;
  thumbnailUrl?: string;
  fileSize: number;
  description?: string;
  category?: string;
}

interface ReviewPatientUploadData {
  reviewedBy: string;
  reviewedByName: string;
  reviewComment?: string;
}

export class PatientUploadService {
  /**
   * Create new patient upload
   */
  async createPatientUpload(data: CreatePatientUploadData) {
    try {
      const upload = await prisma.patientUpload.create({
        data: {
          patientId: data.patientId,
          fileName: data.fileName,
          originalName: data.originalName,
          fileType: data.fileType,
          mimeType: data.mimeType,
          fileUrl: data.fileUrl,
          thumbnailUrl: data.thumbnailUrl,
          fileSize: data.fileSize,
          description: data.description,
          category: data.category,
          notificationSent: true, // Mark as needing notification
        },
        include: {
          patient: {
            select: {
              id: true,
              patientId: true,
              fullName: true,
              assignedSurgeon: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
        },
      });

      logger.info(`Patient upload created: ${upload.id} for patient: ${data.patientId}`);
      return upload;
    } catch (error) {
      logger.error('Error creating patient upload:', error);
      throw error;
    }
  }

  /**
   * Get patient upload by ID
   */
  async getPatientUploadById(id: string) {
    try {
      const upload = await prisma.patientUpload.findFirst({
        where: {
          id,
          isArchived: false,
        },
        include: {
          patient: {
            select: {
              id: true,
              patientId: true,
              fullName: true,
              assignedSurgeon: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
        },
      });

      return upload;
    } catch (error) {
      logger.error(`Error fetching patient upload ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get all uploads for a patient with pagination
   */
  async getPatientUploadsByPatient(
    patientId: string,
    options?: {
      skip?: number;
      take?: number;
      category?: string;
      sortBy?: string;
      order?: 'asc' | 'desc';
    }
  ) {
    try {
      const categoryFilter = options?.category ? { category: options.category } : {};

      const uploads = await prisma.patientUpload.findMany({
        where: {
          patientId,
          isArchived: false,
          ...categoryFilter,
        },
        orderBy: { [options?.sortBy || 'createdAt']: options?.order || 'desc' },
        skip: options?.skip,
        take: options?.take,
      });

      return uploads;
    } catch (error) {
      logger.error(`Error fetching uploads for patient ${patientId}:`, error);
      throw error;
    }
  }

  /**
   * Get count of uploads for a patient
   */
  async getPatientUploadsCount(patientId: string, category?: string) {
    try {
      const categoryFilter = category ? { category } : {};

      const count = await prisma.patientUpload.count({
        where: {
          patientId,
          isArchived: false,
          ...categoryFilter,
        },
      });

      return count;
    } catch (error) {
      logger.error(`Error counting uploads for patient ${patientId}:`, error);
      throw error;
    }
  }

  /**
   * Get unreviewed uploads (for doctor/moderator)
   */
  async getUnreviewedUploads(assignedSurgeonId?: string) {
    try {
      const whereClause: any = {
        isReviewed: false,
        isArchived: false,
      };

      if (assignedSurgeonId) {
        whereClause.patient = {
          assignedSurgeonId,
        };
      }

      const uploads = await prisma.patientUpload.findMany({
        where: whereClause,
        include: {
          patient: {
            select: {
              id: true,
              patientId: true,
              fullName: true,
              assignedSurgeon: {
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

      return uploads;
    } catch (error) {
      logger.error('Error fetching unreviewed uploads:', error);
      throw error;
    }
  }

  /**
   * Get reviewed uploads
   */
  async getReviewedUploads(assignedSurgeonId?: string) {
    try {
      const whereClause: any = {
        isReviewed: true,
        isArchived: false,
      };

      if (assignedSurgeonId) {
        whereClause.patient = {
          assignedSurgeonId,
        };
      }

      const uploads = await prisma.patientUpload.findMany({
        where: whereClause,
        include: {
          patient: {
            select: {
              id: true,
              patientId: true,
              fullName: true,
              assignedSurgeon: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
        },
        orderBy: { reviewedAt: 'desc' },
      });

      return uploads;
    } catch (error) {
      logger.error('Error fetching reviewed uploads:', error);
      throw error;
    }
  }

  /**
   * Get uploads by category
   */
  async getUploadsByCategory(category: string, patientId?: string) {
    try {
      const whereClause: any = {
        category,
        isArchived: false,
      };

      if (patientId) {
        whereClause.patientId = patientId;
      }

      const uploads = await prisma.patientUpload.findMany({
        where: whereClause,
        include: {
          patient: {
            select: {
              id: true,
              patientId: true,
              fullName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return uploads;
    } catch (error) {
      logger.error(`Error fetching uploads by category ${category}:`, error);
      throw error;
    }
  }

  /**
   * Review patient upload
   */
  async reviewPatientUpload(id: string, data: ReviewPatientUploadData) {
    try {
      const upload = await prisma.patientUpload.update({
        where: { id },
        data: {
          isReviewed: true,
          reviewedBy: data.reviewedBy,
          reviewedByName: data.reviewedByName,
          reviewedAt: new Date(),
          reviewComment: data.reviewComment,
        },
        include: {
          patient: {
            select: {
              id: true,
              patientId: true,
              fullName: true,
            },
          },
        },
      });

      logger.info(`Patient upload reviewed: ${id} by ${data.reviewedByName}`);
      return upload;
    } catch (error) {
      logger.error(`Error reviewing patient upload ${id}:`, error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(id: string) {
    try {
      const upload = await prisma.patientUpload.update({
        where: { id },
        data: {
          notificationReadAt: new Date(),
        },
      });

      logger.info(`Notification read for upload: ${id}`);
      return upload;
    } catch (error) {
      logger.error(`Error marking notification read for upload ${id}:`, error);
      throw error;
    }
  }

  /**
   * Archive patient upload (soft delete)
   */
  async archivePatientUpload(id: string) {
    try {
      const upload = await prisma.patientUpload.update({
        where: { id },
        data: {
          isArchived: true,
          archivedAt: new Date(),
        },
      });

      logger.info(`Patient upload archived: ${id}`);
      return upload;
    } catch (error) {
      logger.error(`Error archiving patient upload ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get unread upload notifications count
   */
  async getUnreadNotificationCount(doctorId?: string) {
    try {
      const whereClause: any = {
        isReviewed: false,
        isArchived: false,
        notificationSent: true,
      };

      if (doctorId) {
        whereClause.patient = {
          assignedSurgeonId: doctorId,
        };
      }

      const count = await prisma.patientUpload.count({
        where: whereClause,
      });

      return count;
    } catch (error) {
      logger.error('Error getting unread notification count:', error);
      throw error;
    }
  }

  /**
   * Search patient uploads
   */
  async searchPatientUploads(query: string, patientId?: string) {
    try {
      const whereClause: any = {
        isArchived: false,
        OR: [
          {
            originalName: {
              contains: query,
            },
          },
          {
            description: {
              contains: query,
            },
          },
          {
            category: {
              contains: query,
            },
          },
        ],
      };

      if (patientId) {
        whereClause.patientId = patientId;
      }

      const uploads = await prisma.patientUpload.findMany({
        where: whereClause,
        include: {
          patient: {
            select: {
              id: true,
              patientId: true,
              fullName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return uploads;
    } catch (error) {
      logger.error('Error searching patient uploads:', error);
      throw error;
    }
  }

  /**
   * Get upload statistics for a patient
   */
  async getUploadStats(patientId: string) {
    try {
      const stats = await prisma.patientUpload.groupBy({
        by: ['fileType', 'isReviewed'],
        where: {
          patientId,
          isArchived: false,
        },
        _count: {
          id: true,
        },
        _sum: {
          fileSize: true,
        },
      });

      return stats;
    } catch (error) {
      logger.error(`Error fetching upload stats for patient ${patientId}:`, error);
      throw error;
    }
  }
}

export default new PatientUploadService();
