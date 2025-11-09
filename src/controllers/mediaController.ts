import { Response, NextFunction } from 'express';
import mediaService from '../services/mediaService';
import { logger } from '../config/logger';
import { AuthRequest, UserRole } from '../middlewares/auth';
import { MediaType } from '@prisma/client';
import path from 'path';

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

      const { followUpId, visibility, includeInExport } = req.body;

      if (!followUpId) {
        res.status(400).json({
          success: false,
          message: 'Follow-up ID is required',
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

      const media = await mediaService.createMedia({
        followUpId,
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

      const { followUpId, visibility, includeInExport } = req.body;

      if (!followUpId) {
        res.status(400).json({
          success: false,
          message: 'Follow-up ID is required',
        });
        return;
      }

      const uploadedMedia = [];

      for (const file of req.files) {
        // Determine file type from mimetype
        let fileType: MediaType;
        if (file.mimetype.startsWith('image/')) {
          fileType = MediaType.IMAGE;
        } else if (file.mimetype.startsWith('audio/')) {
          fileType = MediaType.AUDIO;
        } else if (file.mimetype.startsWith('video/')) {
          fileType = MediaType.VIDEO;
        } else if (file.mimetype === 'application/pdf') {
          fileType = MediaType.PDF;
        } else {
          fileType = MediaType.DOCUMENT;
        }

        const media = await mediaService.createMedia({
          followUpId,
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
      if (req.user?.role === UserRole.PATIENT && media.visibility === 'PRIVATE') {
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
      const includePrivate = req.user?.role !== UserRole.PATIENT;

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
   * Get media by patient
   */
  async getMediaByPatient(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { patientId } = req.params;
      const includePrivate = req.user?.role !== UserRole.PATIENT;

      const media = await mediaService.getMediaByPatient(patientId, includePrivate);

      res.json({
        success: true,
        data: media,
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
      if (req.user?.role === UserRole.PATIENT && media.visibility === 'PRIVATE') {
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
