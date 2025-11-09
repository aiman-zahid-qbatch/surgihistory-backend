import { Response, NextFunction } from 'express';
import privateNoteService from '../services/privateNoteService';
import { logger } from '../config/logger';
import { AuthRequest, UserRole } from '../middlewares/auth';
import { prisma } from '../config/database';

/**
 * Helper function to get doctor ID from user ID
 */
async function getDoctorId(userId: string): Promise<string | null> {
  const doctor = await prisma.doctor.findUnique({
    where: { userId },
    select: { id: true },
  });
  return doctor?.id || null;
}

export class PrivateNoteController {
  /**
   * Create new private note (doctor-only)
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

      // Ensure only doctors and surgeons can create private notes
      if (req.user.role !== UserRole.DOCTOR && req.user.role !== UserRole.SURGEON) {
        res.status(403).json({
          success: false,
          message: 'Only doctors and surgeons can create private notes',
        });
        return;
      }

      // Get doctor ID from user ID
      const doctorId = await getDoctorId(req.user.id);
      if (!doctorId) {
        res.status(404).json({
          success: false,
          message: 'Doctor profile not found. Please contact administrator.',
        });
        return;
      }

      const note = await privateNoteService.createPrivateNote({
        ...req.body,
        doctorId,
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
   * Get private note by ID (doctor-only, own notes)
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
      const note = await privateNoteService.getPrivateNoteById(id, req.user.id);

      if (!note) {
        res.status(404).json({
          success: false,
          message: 'Private note not found or access denied',
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
   * Get all private notes for current doctor
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

      const notes = await privateNoteService.getPrivateNotesByDoctor(req.user.id);

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
   * Get private notes by follow-up
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
      const notes = await privateNoteService.getPrivateNotesByFollowUp(followUpId, req.user.id);

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
   * Get private notes by surgery
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
      const notes = await privateNoteService.getPrivateNotesBySurgery(surgeryId, req.user.id);

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
   * Get private notes by patient
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
      
      // Get doctor ID from user ID
      const doctorId = await getDoctorId(req.user.id);
      if (!doctorId) {
        res.status(404).json({
          success: false,
          message: 'Doctor profile not found',
        });
        return;
      }

      const notes = await privateNoteService.getPrivateNotesByPatient(patientId, doctorId);

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
   * Update private note
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

      const { id } = req.params;
      const note = await privateNoteService.updatePrivateNote(id, req.user.id, req.body);

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
   * Add transcription to audio note
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

      const { id } = req.params;
      const { transcriptionText } = req.body;

      if (!transcriptionText) {
        res.status(400).json({
          success: false,
          message: 'Transcription text is required',
        });
        return;
      }

      const note = await privateNoteService.addTranscription(id, req.user.id, transcriptionText);

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
   * Archive private note (soft delete)
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

      const { id } = req.params;
      const note = await privateNoteService.archivePrivateNote(id, req.user.id);

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
   * Search private notes (own notes only)
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

      const notes = await privateNoteService.searchPrivateNotes(q, req.user.id);

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
   * Get private note count for current doctor
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

      const count = await privateNoteService.getPrivateNoteCount(req.user.id);

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
