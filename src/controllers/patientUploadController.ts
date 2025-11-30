import { Response, NextFunction } from 'express';
import patientUploadService from '../services/patientUploadService';
import notificationService from '../services/notificationService';
import { logger } from '../config/logger';
import { AuthRequest, UserRole } from '../middlewares/auth';
import { MediaType } from '@prisma/client';
import { prisma } from '../config/database';
import path from 'path';

export class PatientUploadController {
  /**
   * Upload file by patient
   */
  async uploadFile(req: AuthRequest, res: Response, next: NextFunction) {
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

      const { patientId, description, category } = req.body;

      if (!patientId) {
        res.status(400).json({
          success: false,
          message: 'Patient ID is required',
        });
        return;
      }

      // Patients can only upload for themselves
      if (req.user.role === UserRole.PATIENT && req.user.id !== patientId) {
        res.status(403).json({
          success: false,
          message: 'Patients can only upload files for themselves',
        });
        return;
      }

      // Determine file type from mimetype
      let fileType: MediaType;
      if (req.file.mimetype.startsWith('image/')) {
        fileType = MediaType.IMAGE;
      } else if (req.file.mimetype.startsWith('audio/')) {
        fileType = MediaType.AUDIO;
      } else if (req.file.mimetype.startsWith('video/')) {
        fileType = MediaType.VIDEO;
      } else if (req.file.mimetype === 'application/pdf') {
        fileType = MediaType.PDF;
      } else {
        fileType = MediaType.DOCUMENT;
      }

      const upload = await patientUploadService.createPatientUpload({
        patientId,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileType,
        mimeType: req.file.mimetype,
        fileUrl: `/uploads/${req.file.filename}`,
        fileSize: req.file.size,
        description,
        category,
      });

      // Notify assigned moderators when patient uploads media
      try {
        // Get patient info and their assigned moderators
        const patient = await prisma.patient.findUnique({
          where: { id: patientId },
          select: {
            fullName: true,
            assignedModerators: {
              where: { status: 'ACCEPTED' },
              select: { moderatorId: true },
            },
          },
        });

        if (patient && patient.assignedModerators.length > 0) {
          // Notify each assigned moderator
          for (const assignment of patient.assignedModerators) {
            await notificationService.notifyModeratorPatientUpload(
              assignment.moderatorId,
              patient.fullName,
              patientId,
              upload.id,
              req.file.originalname
            );
          }
        }
      } catch (notifError) {
        logger.error('Error sending upload notification to moderators:', notifError);
        // Don't fail the upload if notification fails
      }

      res.status(201).json({
        success: true,
        data: upload,
      });
    } catch (error) {
      logger.error('Error in uploadFile controller:', error);
      next(error);
    }
  }

  /**
   * Get patient upload by ID
   */
  async getPatientUpload(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const upload = await patientUploadService.getPatientUploadById(id);

      if (!upload) {
        res.status(404).json({
          success: false,
          message: 'Upload not found',
        });
        return;
      }

      // Patients can only view their own uploads
      if (req.user?.role === UserRole.PATIENT && upload.patientId !== req.user.id) {
        res.status(403).json({
          success: false,
          message: 'Access denied',
        });
        return;
      }

      res.json({
        success: true,
        data: upload,
      });
    } catch (error) {
      logger.error('Error in getPatientUpload controller:', error);
      next(error);
    }
  }

  /**
   * Get uploads for a patient with pagination
   */
  async getUploadsByPatient(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { patientId } = req.params;
      const { page = '1', limit = '50', category, sortBy = 'uploadedAt', order = 'desc' } = req.query;

      // Patients can only view their own uploads
      if (req.user?.role === UserRole.PATIENT && patientId !== req.user.id) {
        res.status(403).json({
          success: false,
          message: 'Access denied',
        });
        return;
      }

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const uploads = await patientUploadService.getPatientUploadsByPatient(
        patientId,
        {
          skip,
          take: limitNum,
          category: category as string,
          sortBy: sortBy as string,
          order: order as 'asc' | 'desc',
        }
      );

      const totalCount = await patientUploadService.getPatientUploadsCount(patientId, category as string);

      res.json({
        success: true,
        data: uploads,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum),
        },
      });
    } catch (error) {
      logger.error('Error in getUploadsByPatient controller:', error);
      next(error);
    }
  }

  /**
   * Get unreviewed uploads (for doctors/moderators)
   */
  async getUnreviewedUploads(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { doctorId } = req.query;

      const uploads = await patientUploadService.getUnreviewedUploads(
        doctorId as string | undefined
      );

      res.json({
        success: true,
        data: uploads,
      });
    } catch (error) {
      logger.error('Error in getUnreviewedUploads controller:', error);
      next(error);
    }
  }

  /**
   * Get reviewed uploads
   */
  async getReviewedUploads(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { doctorId } = req.query;

      const uploads = await patientUploadService.getReviewedUploads(
        doctorId as string | undefined
      );

      res.json({
        success: true,
        data: uploads,
      });
    } catch (error) {
      logger.error('Error in getReviewedUploads controller:', error);
      next(error);
    }
  }

  /**
   * Get uploads by category
   */
  async getUploadsByCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category } = req.params;
      const { patientId } = req.query;

      const uploads = await patientUploadService.getUploadsByCategory(
        category,
        patientId as string | undefined
      );

      res.json({
        success: true,
        data: uploads,
      });
    } catch (error) {
      logger.error('Error in getUploadsByCategory controller:', error);
      next(error);
    }
  }

  /**
   * Review patient upload (doctor/moderator)
   */
  async reviewUpload(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;
      const { reviewComment } = req.body;

      const upload = await patientUploadService.reviewPatientUpload(id, {
        reviewedBy: req.user.id,
        reviewedByName: req.user.email,
        reviewComment,
      });

      res.json({
        success: true,
        message: 'Upload reviewed successfully',
        data: upload,
      });
    } catch (error) {
      logger.error('Error in reviewUpload controller:', error);
      next(error);
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const upload = await patientUploadService.markNotificationRead(id);

      res.json({
        success: true,
        data: upload,
      });
    } catch (error) {
      logger.error('Error in markNotificationRead controller:', error);
      next(error);
    }
  }

  /**
   * Archive patient upload (soft delete)
   */
  async archiveUpload(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const upload = await patientUploadService.archivePatientUpload(id);

      res.json({
        success: true,
        message: 'Upload archived successfully',
        data: upload,
      });
    } catch (error) {
      logger.error('Error in archiveUpload controller:', error);
      next(error);
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadNotificationCount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { doctorId } = req.query;

      const count = await patientUploadService.getUnreadNotificationCount(
        doctorId as string | undefined
      );

      res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      logger.error('Error in getUnreadNotificationCount controller:', error);
      next(error);
    }
  }

  /**
   * Search patient uploads
   */
  async searchUploads(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q, patientId } = req.query;

      if (!q || typeof q !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Search query is required',
        });
        return;
      }

      const uploads = await patientUploadService.searchPatientUploads(
        q,
        patientId as string | undefined
      );

      res.json({
        success: true,
        data: uploads,
      });
    } catch (error) {
      logger.error('Error in searchUploads controller:', error);
      next(error);
    }
  }

  /**
   * Get upload statistics
   */
  async getUploadStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { patientId } = req.params;

      const stats = await patientUploadService.getUploadStats(patientId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error in getUploadStats controller:', error);
      next(error);
    }
  }

  /**
   * Download patient upload
   */
  async downloadUpload(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const upload = await patientUploadService.getPatientUploadById(id);

      if (!upload) {
        res.status(404).json({
          success: false,
          message: 'Upload not found',
        });
        return;
      }

      // Patients can only download their own uploads
      if (req.user?.role === UserRole.PATIENT && upload.patientId !== req.user.id) {
        res.status(403).json({
          success: false,
          message: 'Access denied',
        });
        return;
      }

      const filePath = path.join(process.cwd(), 'uploads', upload.fileName);
      res.download(filePath, upload.originalName);
    } catch (error) {
      logger.error('Error in downloadUpload controller:', error);
      next(error);
    }
  }
}

export default new PatientUploadController();
