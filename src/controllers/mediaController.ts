import { Response, NextFunction } from 'express';
import mediaService from '../services/mediaService';
import notificationService from '../services/notificationService';
import { logger } from '../config/logger';
import { AuthRequest } from '../middlewares/auth';

import path from 'path';
import { prisma } from '../config/database';

export class MediaController {
  /**
   * Upload media file
   */
  async uploadMedia(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded',
        });
        return;
      }

      const { followUpId, patientId, visibility, includeInExport } = req.body;

      if (!followUpId && !patientId) {
        res.status(400).json({
          success: false,
          message: 'Either Follow-up ID or Patient ID is required',
        });
        return;
      }

      // Determine file type from mimetype
      let fileType: string;
      if (req.file.mimetype.startsWith('image/')) {
        fileType = 'IMAGE';
      } else if (req.file.mimetype.startsWith('audio/')) {
        fileType = 'AUDIO';
      } else if (req.file.mimetype.startsWith('video/')) {
        fileType = 'VIDEO';
      } else if (req.file.mimetype === 'application/pdf') {
        fileType = 'PDF';
      } else {
        fileType = 'DOCUMENT';
      }

      const media = await mediaService.createMedia({
        followUpId: followUpId || undefined,
        patientId: patientId || undefined,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileType,
        mimeType: req.file.mimetype,
        fileUrl: `/uploads/${req.file.filename}`,
        fileSize: req.file.size,
        uploadedBy: req.user.id,
        uploadedByRole: req.user.role,
        uploadedByName: req.user.email,
        visibility: visibility || 'PUBLIC',
        includeInExport: includeInExport !== undefined ? includeInExport === 'true' : true,
      });

      // Create notification for patient if surgeon uploaded the file and it's PUBLIC
      if (req.user.role === 'SURGEON' && (visibility === 'PUBLIC' || !visibility)) {
        try {
          let targetPatientId = patientId;
          let surgeonId: string | undefined;

          // If followUpId is provided, get patient from follow-up
          if (followUpId) {
            const followUp = await prisma.followUp.findUnique({
              where: { id: followUpId },
              include: {
                surgery: {
                  include: {
                    patient: true,
                  },
                },
              },
            });

            if (followUp?.surgery?.patient) {
              targetPatientId = followUp.surgery.patient.id;
              surgeonId = followUp.surgeonId;
            }
          } else if (patientId) {
            // Get surgeon ID from user
            const surgeon = await prisma.surgeon.findUnique({
              where: { userId: req.user.id },
              select: { id: true },
            });
            surgeonId = surgeon?.id;
          }

          if (targetPatientId) {
            await notificationService.createNotification({
              recipientId: targetPatientId,
              recipientRole: 'PATIENT',
              type: 'DOCUMENT_UPLOADED',
              title: 'New Document Uploaded',
              message: `Your doctor has uploaded a new document: ${req.file.originalname}`,
              entityType: 'MEDIA',
              entityId: media.id,
              priority: 'normal',
              badgeColor: 'blue',
              patientId: targetPatientId,
              surgeonId,
            });
          }
        } catch (notifError) {
          logger.error('Error creating notification for media upload:', notifError);
          // Don't fail the upload if notification fails
        }
      }

      res.status(201).json({
        success: true,
        data: media,
      });
    } catch (error) {
      logger.error('Error in uploadMedia controller:', error);
      next(error);
    }
  }

  /**
   * Upload multiple media files
   */
  async uploadMultipleMedia(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        res.status(400).json({
          success: false,
          message: 'No files uploaded',
        });
        return;
      }

      const { followUpId, patientId, visibility, includeInExport } = req.body;

      if (!followUpId && !patientId) {
        res.status(400).json({
          success: false,
          message: 'Either Follow-up ID or Patient ID is required',
        });
        return;
      }

      const uploadedMedia = [];

      for (const file of req.files) {
        // Determine file type from mimetype
        let fileType: string;
        if (file.mimetype.startsWith('image/')) {
          fileType = 'IMAGE';
        } else if (file.mimetype.startsWith('audio/')) {
          fileType = 'AUDIO';
        } else if (file.mimetype.startsWith('video/')) {
          fileType = 'VIDEO';
        } else if (file.mimetype === 'application/pdf') {
          fileType = 'PDF';
        } else {
          fileType = 'DOCUMENT';
        }

        const media = await mediaService.createMedia({
          followUpId: followUpId || undefined,
          patientId: patientId || undefined,
          fileName: file.filename,
          originalName: file.originalname,
          fileType,
          mimeType: file.mimetype,
          fileUrl: `/uploads/${file.filename}`,
          fileSize: file.size,
          uploadedBy: req.user.id,
          uploadedByRole: req.user.role,
          uploadedByName: req.user.email,
          visibility: visibility || 'PUBLIC',
          includeInExport: includeInExport !== undefined ? includeInExport === 'true' : true,
        });

        uploadedMedia.push(media);
      }

      // Create notification for patient if surgeon uploaded files and they're PUBLIC
      if (req.user.role === 'SURGEON' && (visibility === 'PUBLIC' || !visibility) && uploadedMedia.length > 0) {
        try {
          let targetPatientId = patientId;
          let surgeonId: string | undefined;

          // If followUpId is provided, get patient from follow-up
          if (followUpId) {
            const followUp = await prisma.followUp.findUnique({
              where: { id: followUpId },
              include: {
                surgery: {
                  include: {
                    patient: true,
                  },
                },
              },
            });

            if (followUp?.surgery?.patient) {
              targetPatientId = followUp.surgery.patient.id;
              surgeonId = followUp.surgeonId;
            }
          } else if (patientId) {
            // Get surgeon ID from user
            const surgeon = await prisma.surgeon.findUnique({
              where: { userId: req.user.id },
              select: { id: true },
            });
            surgeonId = surgeon?.id;
          }

          if (targetPatientId) {
            const fileCount = uploadedMedia.length;
            await notificationService.createNotification({
              recipientId: targetPatientId,
              recipientRole: 'PATIENT',
              type: 'DOCUMENT_UPLOADED',
              title: 'New Documents Uploaded',
              message: `Your doctor has uploaded ${fileCount} new document${fileCount > 1 ? 's' : ''}`,
              entityType: 'MEDIA',
              entityId: uploadedMedia[0].id,
              priority: 'normal',
              badgeColor: 'blue',
              patientId: targetPatientId,
              surgeonId,
            });
          }
        } catch (notifError) {
          logger.error('Error creating notification for media upload:', notifError);
          // Don't fail the upload if notification fails
        }
      }

      res.status(201).json({
        success: true,
        data: uploadedMedia,
      });
    } catch (error) {
      logger.error('Error in uploadMultipleMedia controller:', error);
      next(error);
    }
  }

  /**
   * Get media by ID
   */
  async getMedia(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const media = await mediaService.getMediaById(id);

      if (!media) {
        res.status(404).json({
          success: false,
          message: 'Media not found',
        });
        return;
      }

      // Check visibility for patients
      if (req.user?.role === 'PATIENT' && media.visibility === 'PRIVATE') {
        res.status(403).json({
          success: false,
          message: 'Access denied',
        });
        return;
      }

      res.json({
        success: true,
        data: media,
      });
    } catch (error) {
      logger.error('Error in getMedia controller:', error);
      next(error);
    }
  }

  /**
   * Get media for a follow-up
   */
  async getMediaByFollowUp(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { followUpId } = req.params;
      const includePrivate = req.user?.role !== 'PATIENT';

      const media = await mediaService.getMediaByFollowUp(followUpId, includePrivate);

      res.json({
        success: true,
        data: media,
      });
    } catch (error) {
      logger.error('Error in getMediaByFollowUp controller:', error);
      next(error);
    }
  }

  /**
   * Get media by patient with pagination
   */
  async getMediaByPatient(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { patientId } = req.params;
      const { page = '1', limit = '50', fileType, sortBy = 'createdAt', order = 'desc' } = req.query;
      const includePrivate = req.user?.role !== 'PATIENT';

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const media = await mediaService.getMediaByPatient(
        patientId,
        includePrivate,
        {
          skip,
          take: limitNum,
          fileType: fileType as string,
          sortBy: sortBy as string,
          order: order as 'asc' | 'desc',
        }
      );

      const totalCount = await mediaService.getMediaCountByPatient(
        patientId,
        includePrivate,
        fileType as string
      );

      res.json({
        success: true,
        data: media,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum),
        },
      });
    } catch (error) {
      logger.error('Error in getMediaByPatient controller:', error);
      next(error);
    }
  }

  /**
   * Get media by uploader
   */
  async getMediaByUploader(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uploaderId } = req.params;
      const media = await mediaService.getMediaByUploader(uploaderId);

      res.json({
        success: true,
        data: media,
      });
    } catch (error) {
      logger.error('Error in getMediaByUploader controller:', error);
      next(error);
    }
  }

  /**
   * Update media
   */
  async updateMedia(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const media = await mediaService.updateMedia(id, req.body);

      res.json({
        success: true,
        data: media,
      });
    } catch (error) {
      logger.error('Error in updateMedia controller:', error);
      next(error);
    }
  }

  /**
   * Add transcription to media
   */
  async addTranscription(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { transcriptionText } = req.body;

      if (!transcriptionText) {
        res.status(400).json({
          success: false,
          message: 'Transcription text is required',
        });
        return;
      }

      const media = await mediaService.addTranscription(id, transcriptionText);

      res.json({
        success: true,
        data: media,
      });
    } catch (error) {
      logger.error('Error in addTranscription controller:', error);
      next(error);
    }
  }

  /**
   * Archive media (soft delete)
   */
  async archiveMedia(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const media = await mediaService.archiveMedia(id);

      res.json({
        success: true,
        message: 'Media archived successfully',
        data: media,
      });
    } catch (error) {
      logger.error('Error in archiveMedia controller:', error);
      next(error);
    }
  }

  /**
   * Get media statistics
   */
  async getMediaStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { followUpId } = req.params;
      const stats = await mediaService.getMediaStats(followUpId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error in getMediaStats controller:', error);
      next(error);
    }
  }

  /**
   * Get all media (Admin only)
   */
  async getAllMedia(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = '1', limit = '20', fileType, uploadedByRole, search, sortBy, order } = req.query;
      
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const { media, total } = await mediaService.getAllMedia({
        skip,
        take: limitNum,
        fileType: fileType as string,
        uploadedByRole: uploadedByRole as string,
        search: search as string,
        sortBy: sortBy as string,
        order: order as 'asc' | 'desc',
      });

      res.json({
        success: true,
        data: media,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      logger.error('Error in getAllMedia controller:', error);
      next(error);
    }
  }

  /**
   * Search media
   */
  async searchMedia(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Search query is required',
        });
        return;
      }

      const media = await mediaService.searchMedia(q);

      res.json({
        success: true,
        data: media,
      });
    } catch (error) {
      logger.error('Error in searchMedia controller:', error);
      next(error);
    }
  }

  /**
   * Get all media for moderator's assigned patients
   */
  async getModeratorAssignedMedia(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Get moderator profile
      const moderator = await prisma.moderator.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });

      if (!moderator) {
        res.status(404).json({
          success: false,
          message: 'Moderator profile not found',
        });
        return;
      }

      // Get assigned patient IDs
      const assignedPatients = await prisma.patientModerator.findMany({
        where: {
          moderatorId: moderator.id,
          status: 'ACCEPTED',
        },
        select: { patientId: true },
      });

      const patientIds = assignedPatients.map((p) => p.patientId);

      if (patientIds.length === 0) {
        res.json({
          success: true,
          data: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
          },
        });
        return;
      }

      const { page = '1', limit = '20', fileType, search, sortBy = 'createdAt', order = 'desc' } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Ensure fileType is a string (not array or object)
      let fileTypeValue: string | undefined = undefined;
      if (typeof fileType === 'string') fileTypeValue = fileType;
      // Build filters
      const fileTypeFilter = fileTypeValue ? { fileType: fileTypeValue as any } : {};
      const searchFilter = search ? {
        OR: [
          { originalName: { contains: search as string, mode: 'insensitive' as const } },
          { uploadedByName: { contains: search as string, mode: 'insensitive' as const } },
        ],
      } : {};

      // Get media for all assigned patients
      const [media, total] = await Promise.all([
        prisma.media.findMany({
          where: {
            OR: [
              // Media linked to follow-ups for assigned patients
              {
                followUp: {
                  surgery: {
                    patientId: { in: patientIds },
                  },
                },
              },
              // Standalone media directly linked to assigned patients
              {
                patientId: { in: patientIds },
              },
            ],
            isArchived: false,
            ...fileTypeFilter,
            ...searchFilter,
          },
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
                    patient: {
                      select: {
                        id: true,
                        fullName: true,
                        patientId: true,
                      },
                    },
                  },
                },
              },
            },
            patient: {
              select: {
                id: true,
                fullName: true,
                patientId: true,
              },
            },
          },
          orderBy: { [sortBy as string]: order as 'asc' | 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.media.count({
          where: {
            OR: [
              {
                followUp: {
                  surgery: {
                    patientId: { in: patientIds },
                  },
                },
              },
              {
                patientId: { in: patientIds },
              },
            ],
            isArchived: false,
            ...fileTypeFilter,
            ...searchFilter,
          },
        }),
      ]);

      res.json({
        success: true,
        data: media,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      logger.error('Error in getModeratorAssignedMedia controller:', error);
      next(error);
    }
  }

  /**
   * Download media file
   */
  async downloadMedia(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const media = await mediaService.getMediaById(id);

      if (!media) {
        res.status(404).json({
          success: false,
          message: 'Media not found',
        });
        return;
      }

      // Check visibility for patients
      if (req.user?.role === 'PATIENT' && media.visibility === 'PRIVATE') {
        res.status(403).json({
          success: false,
          message: 'Access denied',
        });
        return;
      }

      const filePath = path.join(process.cwd(), 'uploads', media.fileName);
      res.download(filePath, media.originalName);
    } catch (error) {
      logger.error('Error in downloadMedia controller:', error);
      next(error);
    }
  }
}

export default new MediaController();
