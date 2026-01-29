import multer from 'multer';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import { logger } from '../config/logger';

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (_req, file, cb) {
    // Generate unique filename: timestamp-randomstring-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, nameWithoutExt + '-' + uniqueSuffix + ext);
  },
});

// File filter function
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed file types
  const allowedMimes = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    // PDF
    'application/pdf',
    // Audio
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'audio/m4a',
    // Video
    'video/mp4',
    'video/mpeg',
    'video/webm',
    'video/ogg',
    // Documents
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}. Allowed types: images, PDF, audio, video, documents`));
  }
};

// Configure multer
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
});

// Wrapper to handle multer errors with better error messages
const handleMulterError = (err: any, _req: Request, res: Response, next: NextFunction): void => {
  if (err instanceof multer.MulterError) {
    logger.error('Multer error during file upload:', { code: err.code, message: err.message, field: err.field });

    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        res.status(413).json({
          success: false,
          message: 'File too large. Maximum size is 50MB',
        });
        return;
      case 'LIMIT_FILE_COUNT':
        res.status(400).json({
          success: false,
          message: 'Too many files. Maximum is 10 files',
        });
        return;
      case 'LIMIT_UNEXPECTED_FILE':
        res.status(400).json({
          success: false,
          message: `Unexpected field: ${err.field}`,
        });
        return;
      default:
        res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`,
        });
        return;
    }
  } else if (err) {
    logger.error('Error during file upload:', err);
    res.status(400).json({
      success: false,
      message: err.message || 'Error uploading file',
    });
    return;
  }
  next();
};

// Single file upload middleware with error handling
export const uploadSingle = (req: Request, res: Response, next: NextFunction): void => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      handleMulterError(err, req, res, next);
      return;
    }
    next();
  });
};

// Multiple files upload middleware (max 10 files) with error handling
export const uploadMultiple = (req: Request, res: Response, next: NextFunction): void => {
  upload.array('files', 10)(req, res, (err) => {
    if (err) {
      handleMulterError(err, req, res, next);
      return;
    }
    next();
  });
};

// Fields upload middleware (for forms with multiple file inputs) with error handling
export const uploadFields = (req: Request, res: Response, next: NextFunction): void => {
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
    { name: 'attachments', maxCount: 5 },
  ])(req, res, (err) => {
    if (err) {
      handleMulterError(err, req, res, next);
      return;
    }
    next();
  });
};

// Profile image upload middleware with stricter limits
const profileImageStorage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    const profileUploadsDir = path.join(uploadsDir, 'profiles');
    if (!fs.existsSync(profileUploadsDir)) {
      fs.mkdirSync(profileUploadsDir, { recursive: true });
    }
    cb(null, profileUploadsDir);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + ext);
  },
});

const profileImageFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed for profile pictures'));
  }
};

export const uploadProfileImage = multer({
  storage: profileImageStorage,
  fileFilter: profileImageFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max for profile images
  },
}).single('profileImage');
