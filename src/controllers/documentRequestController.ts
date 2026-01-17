import { Response } from 'express';
import documentRequestService from '../services/documentRequestService';
import notificationService from '../services/notificationService';
import { logger } from '../config/logger';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../config/database';

export const createDocumentRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const { patientId, followUpId, title, description, category } = req.body;

    // Determine surgeonId based on role
    let surgeonId: string | undefined;

    if (req.user.role === 'SURGEON') {
      const surgeon = await prisma.surgeon.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });

      if (!surgeon) {
        res.status(403).json({ message: 'Surgeon profile not found' });
        return;
      }
      surgeonId = surgeon.id;
    } else if (req.user.role === 'MODERATOR') {
      // Moderators can create requests without a surgeonId
      surgeonId = undefined;
    } else {
      res.status(403).json({ message: 'Only surgeons and moderators can create document requests' });
      return;
    }

    if (!patientId || !title) {
      res.status(400).json({ message: 'Patient ID and title are required' });
      return;
    }

    const documentRequest = await documentRequestService.createDocumentRequest({
      patientId,
      surgeonId,
      followUpId,
      title,
      description,
      category,
    });

    // Notify patient about the document request
    try {
      await notificationService.notifyPatientDocumentRequest(
        patientId,
        documentRequest.id,
        title,
        req.user.email,
        req.user.role
      );
    } catch (notifError) {
      logger.error('Error sending document request notification:', notifError);
      // Don't fail the request creation if notification fails
    }

    res.status(201).json(documentRequest);
  } catch (error) {
    logger.error('Error in createDocumentRequest:', error);
    res.status(500).json({ message: 'Failed to create document request' });
  }
};

export const getDocumentRequestsByPatient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    // Fetch patient profile for authenticated user
    const patient = await prisma.patient.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!patient) {
      res.status(403).json({ message: 'Only patients can access this endpoint' });
      return;
    }

    const requests = await documentRequestService.getDocumentRequestsByPatient(patient.id);
    res.json(requests);
  } catch (error) {
    logger.error('Error in getDocumentRequestsByPatient:', error);
    res.status(500).json({ message: 'Failed to get document requests' });
  }
};

export const getDocumentRequestsBySurgeon = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    // Fetch surgeon profile for authenticated user
    const surgeon = await prisma.surgeon.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!surgeon) {
      res.status(403).json({ message: 'Only surgeons can access this endpoint' });
      return;
    }

    const requests = await documentRequestService.getDocumentRequestsBySurgeon(surgeon.id);
    res.json(requests);
  } catch (error) {
    logger.error('Error in getDocumentRequestsBySurgeon:', error);
    res.status(500).json({ message: 'Failed to get document requests' });
  }
};

export const getDocumentRequestsForPatient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const { patientId } = req.params;

    // Allow both surgeons and moderators to view document requests
    let surgeonId: string | undefined;

    if (req.user.role === 'SURGEON') {
      // Fetch surgeon profile for authenticated user
      const surgeon = await prisma.surgeon.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });

      if (!surgeon) {
        res.status(403).json({ message: 'Surgeon profile not found' });
        return;
      }
      surgeonId = surgeon.id;
    } else if (req.user.role === 'MODERATOR') {
      // Moderators can view all document requests for their assigned patients
      // No surgeonId filter needed
      surgeonId = undefined;
    } else {
      res.status(403).json({ message: 'Only surgeons and moderators can access this endpoint' });
      return;
    }

    const requests = await documentRequestService.getDocumentRequestsForPatient(
      patientId,
      surgeonId
    );
    res.json(requests);
  } catch (error) {
    logger.error('Error in getDocumentRequestsForPatient:', error);
    res.status(500).json({ message: 'Failed to get document requests' });
  }
};

export const markDocumentRequestAsUploaded = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { requestId } = req.params;
    const { mediaId } = req.body;

    if (!mediaId) {
      res.status(400).json({ message: 'Media ID is required' });
      return;
    }

    const documentRequest = await documentRequestService.markAsUploaded(requestId, mediaId);
    res.json(documentRequest);
  } catch (error) {
    logger.error('Error in markDocumentRequestAsUploaded:', error);
    res.status(500).json({ message: 'Failed to update document request' });
  }
};

export const uploadDocumentForRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    const { requestId } = req.params;

    // Get document request
    const docRequest = await prisma.documentRequest.findUnique({
      where: { id: requestId },
      include: { patient: true },
    });

    if (!docRequest) {
      res.status(404).json({ message: 'Document request not found' });
      return;
    }

    // Verify patient owns this request
    const patient = await prisma.patient.findUnique({
      where: { userId: req.user.id },
    });

    if (!patient || patient.id !== docRequest.patientId) {
      res.status(403).json({ message: 'Unauthorized to upload for this request' });
      return;
    }

    // Determine file type
    let fileType: 'IMAGE' | 'PDF' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' = 'DOCUMENT';
    if (req.file.mimetype.startsWith('image/')) {
      fileType = 'IMAGE';
    } else if (req.file.mimetype === 'application/pdf') {
      fileType = 'PDF';
    } else if (req.file.mimetype.startsWith('audio/')) {
      fileType = 'AUDIO';
    } else if (req.file.mimetype.startsWith('video/')) {
      fileType = 'VIDEO';
    }

    // Create media record (without followUpId since it's optional now)
    const media = await prisma.media.create({
      data: {
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileType: fileType,
        mimeType: req.file.mimetype,
        fileUrl: `/uploads/${req.file.filename}`,
        fileSize: req.file.size,
        uploadedBy: req.user.id,
        uploadedByRole: req.user.role as any,
        uploadedByName: req.user.email,
        visibility: 'PUBLIC',
        includeInExport: true,
        hasTranscription: false,
      },
    });

    // Mark document request as uploaded
    const updatedRequest = await documentRequestService.markAsUploaded(requestId, media.id);

    // Notify surgeon/moderator that the document request has been fulfilled
    try {
      // Get assigned moderators for this patient
      const assignedModerators = await prisma.patientModerator.findMany({
        where: { 
          patientId: patient.id,
          status: 'ACCEPTED',
        },
        select: { moderatorId: true },
      });

      const moderatorIds = assignedModerators.map(am => am.moderatorId);

      await notificationService.notifyDocumentRequestFulfilled(
        requestId,
        patient.fullName,
        patient.id,
        docRequest.surgeonId || undefined,
        moderatorIds.length > 0 ? moderatorIds[0] : undefined
      );
    } catch (notifError) {
      logger.error('Error sending document fulfilled notification:', notifError);
      // Don't fail if notification fails
    }

    res.json({
      success: true,
      data: {
        media,
        documentRequest: updatedRequest,
      },
    });
  } catch (error) {
    logger.error('Error in uploadDocumentForRequest:', error);
    res.status(500).json({ message: 'Failed to upload document' });
  }
};

export const deleteDocumentRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const { requestId } = req.params;

    // Fetch surgeon profile for authenticated user
    const surgeon = await prisma.surgeon.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!surgeon) {
      res.status(403).json({ message: 'Only surgeons can delete document requests' });
      return;
    }

    await documentRequestService.deleteDocumentRequest(requestId);
    res.json({ message: 'Document request deleted successfully' });
  } catch (error) {
    logger.error('Error in deleteDocumentRequest:', error);
    res.status(500).json({ message: 'Failed to delete document request' });
  }
};
