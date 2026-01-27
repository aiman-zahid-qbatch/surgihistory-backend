import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { Prisma } from '@prisma/client';
import multer from 'multer';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: ApiError | Prisma.PrismaClientKnownRequestError | multer.MulterError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let statusCode = (err as ApiError).statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle Multer errors (file upload errors)
  if (err instanceof multer.MulterError) {
    statusCode = 400;
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File is too large. Maximum file size is 50MB';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files. Maximum is 10 files';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
      default:
        message = `File upload error: ${err.message}`;
    }
  }

  // Handle custom file filter errors (e.g., unsupported file type)
  if (err.message && err.message.includes('File type not allowed')) {
    statusCode = 400;
  }

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': // Unique constraint violation
        statusCode = 409;
        const target = (err.meta?.target as string[])?.join(', ') || 'field';
        message = `A record with this ${target} already exists`;
        break;
      case 'P2025': // Record not found
        statusCode = 404;
        message = 'Record not found';
        break;
      case 'P2003': // Foreign key constraint
        statusCode = 400;
        message = 'Related record not found';
        break;
      default:
        statusCode = 400;
        message = 'Database operation failed';
    }
  }

  logger.error(`Error: ${message}`, {
    statusCode,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
