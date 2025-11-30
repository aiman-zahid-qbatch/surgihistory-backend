import express from 'express';
import {
  createDocumentRequest,
  getDocumentRequestsByPatient,
  getDocumentRequestsBySurgeon,
  getDocumentRequestsForPatient,
  markDocumentRequestAsUploaded,
  uploadDocumentForRequest,
  deleteDocumentRequest,
} from '../controllers/documentRequestController';
import { authenticate, authorize, UserRole } from '../middlewares/auth';
import { uploadSingle } from '../middlewares/upload';

const router = express.Router();

// All document request routes require authentication
router.use(authenticate);

// Create a new document request (surgeon and moderator)
router.post(
  '/',
  authorize(UserRole.SURGEON, UserRole.MODERATOR),
  createDocumentRequest
);

// Get all document requests by surgeon
router.get(
  '/surgeon',
  authorize(UserRole.SURGEON),
  getDocumentRequestsBySurgeon
);

// Get document requests for a specific patient (surgeon view)
router.get(
  '/patient/:patientId',
  authorize(UserRole.SURGEON, UserRole.PATIENT, UserRole.MODERATOR),
  getDocumentRequestsForPatient
);

// Get document requests by patient (patient view)
router.get(
  '/my-requests',
  authorize(UserRole.PATIENT),
  getDocumentRequestsByPatient
);

// Upload document for a request (patient only)
router.post(
  '/:requestId/upload',
  authorize(UserRole.PATIENT),
  uploadSingle,
  uploadDocumentForRequest
);

// Mark document request as uploaded
router.patch(
  '/:requestId/uploaded',
  authorize(UserRole.PATIENT, UserRole.MODERATOR),
  markDocumentRequestAsUploaded
);

// Delete a document request
router.delete(
  '/:requestId',
  authorize(UserRole.SURGEON),
  deleteDocumentRequest
);

export default router;
