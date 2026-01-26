import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';
import http from 'http';
import { logger } from './config/logger';
import { errorHandler } from './middlewares/errorHandler';
import routes from './routes';
import { connectDatabase, disconnectDatabase } from './config/database';

import { authService } from './services/authService';
import { initializeSocket } from './config/socket';
import reminderService from './services/reminderService';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true, // Allow cookies
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Parse cookies

// Serve static files (uploaded images)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes - mounted under /api namespace
app.use('/api', routes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Shutting down gracefully...');
  await disconnectDatabase();

  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server and connect to database
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();


    // Initialize Socket.IO
    initializeSocket(httpServer);

    // Schedule cleanup of expired tokens (runs every hour)
    setInterval(async () => {
      try {
        await authService.cleanupExpiredTokens();
      } catch (error) {
        logger.error('Error in token cleanup task:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    // Schedule reminder processing (runs every minute)
    setInterval(async () => {
      try {
        const results = await reminderService.processPendingReminders();
        if (results.length > 0) {
          logger.info(`Processed ${results.length} reminders`);
        }
      } catch (error) {
        logger.error('Error in reminder processing task:', error);
      }
    }, 60 * 1000); // 1 minute

    // Run initial cleanup
    await authService.cleanupExpiredTokens();

    // Run initial reminder processing
    logger.info('Starting initial reminder processing...');
    try {
      const initialResults = await reminderService.processPendingReminders();
      if (initialResults.length > 0) {
        logger.info(`Processed ${initialResults.length} initial reminders`);
      }
    } catch (error) {
      logger.error('Error in initial reminder processing:', error);
    }

    // Start listening
    httpServer.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`Socket.IO enabled for real-time notifications`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
