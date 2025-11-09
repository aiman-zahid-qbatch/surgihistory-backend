import { PrismaClient, MediaType, UserRole, RecordVisibility } from '@prisma/client';
import { logger } from '../config/logger';
import path from 'path';
import fs from 'fs/promises';

const prisma = new PrismaClient();

interface CreateMediaData {
  followUpId: string;
  fileName: string;
  originalName: string;
  fileType: MediaType;
  mimeType: string;
  fileUrl: string;
  thumbnailUrl?: string;
  fileSize: number;
  duration?: number;
  uploadedBy: string;
  uploadedByRole: UserRole;
  uploadedByName?: string;
  visibility?: RecordVisibility;
  includeInExport?: boolean;
}

interface UpdateMediaData {
  visibility?: RecordVisibility;
  includeInExport?: boolean;
  transcriptionText?: string;
  hasTranscription?: boolean;
}

export class MediaService {
  /**
   * Create new media record
   */
  async createMedia(data: CreateMediaData) {
    try {
      const media = await prisma.media.create({
        data: {
          followUpId: data.followUpId,
          fileName: data.fileName,
          originalName: data.originalName,
          fileType: data.fileType,
          mimeType: data.mimeType,
          fileUrl: data.fileUrl,
          thumbnailUrl: data.thumbnailUrl,
          fileSize: data.fileSize,
          duration: data.duration,
          uploadedBy: data.uploadedBy,
          uploadedByRole: data.uploadedByRole,
          uploadedByName: data.uploadedByName,
          visibility: data.visibility || RecordVisibility.PUBLIC,
          includeInExport: data.includeInExport !== undefined ? data.includeInExport : true,
        },
        include: {
          followUp: {
            include: {
              surgery: {
                include: {
                  patient: {
                    select: {
                      id: true,
                      fullName: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      logger.info(`Media created: ${media.id} for follow-up: ${data.followUpId}`);
      return media;
    } catch (error) {
      logger.error('Error creating media:', error);
      throw error;
    }
  }

  /**
   * Get media by ID
   */
  async getMediaById(id: string) {
    try {
      const media = await prisma.media.findFirst({
        where: {
          id,
          isArchived: false,
        },
        include: {
          followUp: {
            include: {
              surgery: {
                include: {
                  patient: true,
                  doctor: true,
                },
              },
            },
          },
        },
      });

      return media;
    } catch (error) {
      logger.error(`Error fetching media ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get all media for a follow-up
   */
  async getMediaByFollowUp(followUpId: string, includePrivate: boolean = false) {
    try {
      const whereClause: any = {
        followUpId,
        isArchived: false,
      };

      if (!includePrivate) {
        whereClause.visibility = RecordVisibility.PUBLIC;
      }

      const media = await prisma.media.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
      });

      return media;
    } catch (error) {
      logger.error(`Error fetching media for follow-up ${followUpId}:`, error);
      throw error;
    }
  }

  /**
   * Get media by type
   */
  async getMediaByType(followUpId: string, fileType: MediaType) {
    try {
      const media = await prisma.media.findMany({
        where: {
          followUpId,
          fileType,
          isArchived: false,
        },
        orderBy: { createdAt: 'desc' },
      });

      return media;
    } catch (error) {
      logger.error(`Error fetching media by type for follow-up ${followUpId}:`, error);
      throw error;
    }
  }

  /**
   * Get media uploaded by user
   */
  async getMediaByUploader(uploadedBy: string) {
    try {
      const media = await prisma.media.findMany({
        where: {
          uploadedBy,
          isArchived: false,
        },
        include: {
          followUp: {
            select: {
              id: true,
              followUpDate: true,
              surgery: {
                select: {
                  id: true,
                  patient: {
                    select: {
                      fullName: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return media;
    } catch (error) {
      logger.error(`Error fetching media by uploader ${uploadedBy}:`, error);
      throw error;
    }
  }

  /**
   * Get all media for a patient (across all follow-ups)
   */
  async getMediaByPatient(patientId: string, includePrivate: boolean = false) {
    try {
      const whereClause: any = {
        followUp: {
          surgery: {
            patientId,
          },
        },
        isArchived: false,
      };

      if (!includePrivate) {
        whereClause.visibility = RecordVisibility.PUBLIC;
      }

      const media = await prisma.media.findMany({
        where: whereClause,
        include: {
          followUp: {
            select: {
              id: true,
              followUpDate: true,
              surgery: {
                select: {
                  id: true,
                  diagnosis: true,
                  procedureName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return media;
    } catch (error) {
      logger.error(`Error fetching media for patient ${patientId}:`, error);
      throw error;
    }
  }

  /**
   * Update media
   */
  async updateMedia(id: string, data: UpdateMediaData) {
    try {
      const media = await prisma.media.update({
        where: { id },
        data,
        include: {
          followUp: {
            include: {
              surgery: {
                include: {
                  patient: true,
                },
              },
            },
          },
        },
      });

      logger.info(`Media updated: ${id}`);
      return media;
    } catch (error) {
      logger.error(`Error updating media ${id}:`, error);
      throw error;
    }
  }

  /**
   * Add transcription to audio/video media
   */
  async addTranscription(id: string, transcriptionText: string) {
    try {
      const media = await prisma.media.update({
        where: { id },
        data: {
          hasTranscription: true,
          transcriptionText,
        },
      });

      logger.info(`Transcription added to media: ${id}`);
      return media;
    } catch (error) {
      logger.error(`Error adding transcription to media ${id}:`, error);
      throw error;
    }
  }

  /**
   * Archive media (soft delete)
   */
  async archiveMedia(id: string) {
    try {
      const media = await prisma.media.update({
        where: { id },
        data: {
          isArchived: true,
          archivedAt: new Date(),
        },
      });

      logger.info(`Media archived: ${id}`);
      return media;
    } catch (error) {
      logger.error(`Error archiving media ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete media file from storage
   */
  async deleteMediaFile(fileUrl: string, thumbnailUrl?: string) {
    try {
      // Extract file path from URL (assuming local storage)
      const uploadsDir = path.join(process.cwd(), 'uploads');

      if (fileUrl) {
        const filePath = path.join(uploadsDir, path.basename(fileUrl));
        try {
          await fs.unlink(filePath);
          logger.info(`Deleted file: ${filePath}`);
        } catch (error) {
          logger.warn(`Could not delete file ${filePath}:`, error);
        }
      }

      if (thumbnailUrl) {
        const thumbPath = path.join(uploadsDir, 'thumbnails', path.basename(thumbnailUrl));
        try {
          await fs.unlink(thumbPath);
          logger.info(`Deleted thumbnail: ${thumbPath}`);
        } catch (error) {
          logger.warn(`Could not delete thumbnail ${thumbPath}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error deleting media files:', error);
      throw error;
    }
  }

  /**
   * Get media statistics for a follow-up
   */
  async getMediaStats(followUpId: string) {
    try {
      const stats = await prisma.media.groupBy({
        by: ['fileType'],
        where: {
          followUpId,
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
      logger.error(`Error fetching media stats for follow-up ${followUpId}:`, error);
      throw error;
    }
  }

  /**
   * Search media by original name
   */
  async searchMedia(query: string) {
    try {
      const media = await prisma.media.findMany({
        where: {
          isArchived: false,
          OR: [
            {
              originalName: {
                contains: query,
                mode: 'insensitive',
              },
            },
            {
              transcriptionText: {
                contains: query,
                mode: 'insensitive',
              },
            },
          ],
        },
        include: {
          followUp: {
            select: {
              id: true,
              followUpDate: true,
              surgery: {
                select: {
                  patient: {
                    select: {
                      fullName: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return media;
    } catch (error) {
      logger.error('Error searching media:', error);
      throw error;
    }
  }
}

export default new MediaService();
