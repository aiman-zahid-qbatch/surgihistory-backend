import multer from 'multer';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Allowed file types with user-friendly message
const ALLOWED_TYPES = {
  images: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ],
  audio: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/m4a', 'audio/x-m4a'],
  video: ['video/mp4', 'video/mpeg', 'video/webm', 'video/ogg', 'video/quicktime'],
};

const allowedMimes = [
  ...ALLOWED_TYPES.images,
  ...ALLOWED_TYPES.documents,
  ...ALLOWED_TYPES.audio,
  ...ALLOWED_TYPES.video,
];

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
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error(
      `File type not allowed: ${file.mimetype}. Supported formats: Images (JPEG, PNG, GIF, WebP), Documents (PDF, Word, Excel, TXT), Audio (MP3, WAV, OGG, M4A), Video (MP4, WebM, OGG)`
    );
    cb(error);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
});

// Wrapper to handle multer errors properly
const handleUploadError = (uploadMiddleware: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    uploadMiddleware(req, res, (err: any) => {
      if (err) {
        // Handle file type errors
        if (err.message && err.message.includes('File type not allowed')) {
          return res.status(400).json({
            success: false,
            message: err.message,
          });
        }
        // Handle multer-specific errors
        if (err instanceof multer.MulterError) {
          let message = 'File upload error';
          if (err.code === 'LIMIT_FILE_SIZE') {
            message = 'File is too large. Maximum file size is 50MB';
          } else if (err.code === 'LIMIT_FILE_COUNT') {
            message = 'Too many files. Maximum is 10 files';
          } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            message = 'Unexpected file field';
          }
          return res.status(400).json({
            success: false,
            message,
          });
        }
        // Pass other errors to the error handler
        return next(err);
      }
      next();
    });
  };
};

// Single file upload middleware with error handling
export const uploadSingle = handleUploadError(upload.single('file'));

// Multiple files upload middleware (max 10 files) with error handling
export const uploadMultiple = handleUploadError(upload.array('files', 10));

// Fields upload middleware (for forms with multiple file inputs) with error handling
export const uploadFields = handleUploadError(upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
  { name: 'attachments', maxCount: 5 },
]));

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

const profileImageUpload = multer({
  storage: profileImageStorage,
  fileFilter: profileImageFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max for profile images
  },
});

export const uploadProfileImage = handleUploadError(profileImageUpload.single('profileImage'));
