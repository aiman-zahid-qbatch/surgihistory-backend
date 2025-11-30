import { Response, NextFunction } from 'express';
import privateNoteService from '../services/privateNoteService';
import { logger } from '../config/logger';
import { AuthRequest, UserRole } from '../middlewares/auth';
import { prisma } from '../config/database';

/**
 * Helper function to get creator information (ID, role, name)
 */
async function getCreatorInfo(userId: string, role: UserRole): Promise<{ id: string; role: UserRole; name: string } | null> {
  if (role === UserRole.SURGEON) {
    const surgeon = await prisma.surgeon.findUnique({
      where: { userId },
      select: { id: true, fullName: true },
    });
    return surgeon ? { id: surgeon.id, role, name: surgeon.fullName } : null;
  } else if (role === UserRole.MODERATOR) {
    const moderator = await prisma.moderator.findUnique({
      where: { userId },
      select: { id: true, fullName: true },
    });
    return moderator ? { id: moderator.id, role, name: moderator.fullName } : null;
  }
  return null;
}

export class PrivateNoteController {
  /**
   * Create new private note (accessible by doctors, surgeons, and moderators)
   */
  createPrivateNote = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Ensure only surgeons and moderators can create private notes
      if (req.user.role !== UserRole.SURGEON && req.user.role !== UserRole.MODERATOR) {
        res.status(403).json({
          success: false,
          message: 'Only surgeons and moderators can create private notes',
        });
        return;
      }

      // Get creator information
      const creatorInfo = await getCreatorInfo(req.user.id, req.user.role);
      if (!creatorInfo) {
        res.status(404).json({
          success: false,
          message: 'User profile not found. Please contact administrator.',
        });
        return;
      }

      const note = await privateNoteService.createPrivateNote({
        ...req.body,
        createdBy: creatorInfo.id,
        createdByRole: creatorInfo.role,
        createdByName: creatorInfo.name,
      });

      res.status(201).json({
        success: true,
        data: note,
      });
    } catch (error) {
      logger.error('Error in createPrivateNote controller:', error);
      next(error);
    }
  }

  /**
   * Get private note by ID (accessible by all moderators and surgeons)
   */
  getPrivateNote = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;
      const note = await privateNoteService.getPrivateNoteById(id);

      if (!note) {
        res.status(404).json({
          success: false,
          message: 'Private note not found',
        });
        return;
      }

      res.json({
        success: true,
        data: note,
      });
    } catch (error) {
      logger.error('Error in getPrivateNote controller:', error);
      next(error);
    }
  }

  /**
   * Get all private notes (accessible by all moderators and surgeons)
   */
  getMyPrivateNotes = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const notes = await privateNoteService.getAllPrivateNotes();

      res.json({
        success: true,
        data: notes,
      });
    } catch (error) {
      logger.error('Error in getMyPrivateNotes controller:', error);
      next(error);
    }
  }

  /**
   * Get private notes by follow-up (accessible by all moderators and surgeons)
   */
  getPrivateNotesByFollowUp = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { followUpId } = req.params;
      const notes = await privateNoteService.getPrivateNotesByFollowUp(followUpId);

      res.json({
        success: true,
        data: notes,
      });
    } catch (error) {
      logger.error('Error in getPrivateNotesByFollowUp controller:', error);
      next(error);
    }
  }

  /**
   * Get private notes by surgery (accessible by all moderators and surgeons)
   */
  getPrivateNotesBySurgery = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { surgeryId } = req.params;
      const notes = await privateNoteService.getPrivateNotesBySurgery(surgeryId);

      res.json({
        success: true,
        data: notes,
      });
    } catch (error) {
      logger.error('Error in getPrivateNotesBySurgery controller:', error);
      next(error);
    }
  }

  /**
   * Get private notes by patient (accessible by all moderators and surgeons)
   */
  getPrivateNotesByPatient = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { patientId } = req.params;
      const notes = await privateNoteService.getPrivateNotesByPatient(patientId);

      res.json({
        success: true,
        data: notes,
      });
    } catch (error) {
      logger.error('Error in getPrivateNotesByPatient controller:', error);
      next(error);
    }
  }

  /**
   * Update private note (only the creator can update)
   */
  updatePrivateNote = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Get creator information
      const creatorInfo = await getCreatorInfo(req.user.id, req.user.role);
      if (!creatorInfo) {
        res.status(404).json({
          success: false,
          message: 'User profile not found',
        });
        return;
      }

      const { id } = req.params;
      const note = await privateNoteService.updatePrivateNote(id, creatorInfo.id, req.body);

      res.json({
        success: true,
        data: note,
      });
    } catch (error) {
      logger.error('Error in updatePrivateNote controller:', error);
      next(error);
    }
  }

  /**
   * Add transcription to audio note (only the creator can add transcription)
   */
  addTranscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Get creator information
      const creatorInfo = await getCreatorInfo(req.user.id, req.user.role);
      if (!creatorInfo) {
        res.status(404).json({
          success: false,
          message: 'User profile not found',
        });
        return;
      }

      const { id } = req.params;
      const { transcriptionText } = req.body;

      if (!transcriptionText) {
        res.status(400).json({
          success: false,
          message: 'Transcription text is required',
        });
        return;
      }

      const note = await privateNoteService.addTranscription(id, creatorInfo.id, transcriptionText);

      res.json({
        success: true,
        data: note,
      });
    } catch (error) {
      logger.error('Error in addTranscription controller:', error);
      next(error);
    }
  }

  /**
   * Archive private note (soft delete) - only the creator can archive
   */
  archivePrivateNote = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Get creator information
      const creatorInfo = await getCreatorInfo(req.user.id, req.user.role);
      if (!creatorInfo) {
        res.status(404).json({
          success: false,
          message: 'User profile not found',
        });
        return;
      }

      const { id } = req.params;
      const note = await privateNoteService.archivePrivateNote(id, creatorInfo.id);

      res.json({
        success: true,
        message: 'Private note archived successfully',
        data: note,
      });
    } catch (error) {
      logger.error('Error in archivePrivateNote controller:', error);
      next(error);
    }
  }

  /**
   * Search private notes (accessible by all moderators and surgeons)
   */
  searchPrivateNotes = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Search query is required',
        });
        return;
      }

      const notes = await privateNoteService.searchPrivateNotes(q);

      res.json({
        success: true,
        data: notes,
      });
    } catch (error) {
      logger.error('Error in searchPrivateNotes controller:', error);
      next(error);
    }
  }

  /**
   * Get total private note count (accessible by all moderators and surgeons)
   */
  getPrivateNoteCount = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const count = await privateNoteService.getPrivateNoteCount();

      res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      logger.error('Error in getPrivateNoteCount controller:', error);
      next(error);
    }
  }
}

export default new PrivateNoteController();
