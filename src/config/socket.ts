import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from './logger';
import { UserRole } from '../middlewares/auth';
import { redisClient } from './redis';

let io: SocketIOServer;

// Socket session management with Redis
const SOCKET_SESSION_PREFIX = 'socket:session:';
const SOCKET_SESSION_TTL = 24 * 60 * 60; // 24 hours

interface SocketSession {
  socketId: string;
  userId: string;
  userRole: string;
  userEmail: string;
  connectedAt: string;
  lastPing: string;
}

// Store socket session in Redis
const storeSocketSession = async (userId: string, session: SocketSession): Promise<void> => {
  try {
    await redisClient.setEx(
      `${SOCKET_SESSION_PREFIX}${userId}`,
      SOCKET_SESSION_TTL,
      JSON.stringify(session)
    );
  } catch (error) {
    logger.error('Failed to store socket session:', error);
  }
};

// Get socket session from Redis
const getSocketSession = async (userId: string): Promise<SocketSession | null> => {
  try {
    const session = await redisClient.get(`${SOCKET_SESSION_PREFIX}${userId}`);
    return session ? JSON.parse(session) : null;
  } catch (error) {
    logger.error('Failed to get socket session:', error);
    return null;
  }
};

// Remove socket session from Redis
const removeSocketSession = async (userId: string): Promise<void> => {
  try {
    await redisClient.del(`${SOCKET_SESSION_PREFIX}${userId}`);
  } catch (error) {
    logger.error('Failed to remove socket session:', error);
  }
};

// Update last ping time
const updateSessionPing = async (userId: string): Promise<void> => {
  try {
    const session = await getSocketSession(userId);
    if (session) {
      session.lastPing = new Date().toISOString();
      await storeSocketSession(userId, session);
    }
  } catch (error) {
    logger.error('Failed to update session ping:', error);
  }
};

export const initializeSocket = (httpServer: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Connection settings
    pingTimeout: 60000,
    pingInterval: 25000,
    // Transport settings
    transports: ['websocket', 'polling'],
    // Allow upgrades from polling to websocket
    allowUpgrades: true,
    // Connection state recovery (socket.io v4.6+)
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: false,
    },
  });

  // Authentication middleware
  io.use(async (socket: any, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      logger.warn('Socket connection attempt without token');
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        id: string;
        role: UserRole;
        email: string;
      };

      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      socket.userEmail = decoded.email;

      // Check for existing session
      const existingSession = await getSocketSession(decoded.id);
      if (existingSession && existingSession.socketId !== socket.id) {
        logger.info(`User ${decoded.email} reconnecting, previous socket: ${existingSession.socketId}`);
        // Disconnect old socket if it exists
        const oldSocket = io.sockets.sockets.get(existingSession.socketId);
        if (oldSocket) {
          logger.info(`Disconnecting old socket for user ${decoded.email}`);
          oldSocket.disconnect(true);
        }
      }

      logger.info(`Socket authenticated: ${decoded.email} (${decoded.role})`);
      next();
    } catch (error: any) {
      logger.error('Socket authentication failed:', error.message);
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', async (socket: any) => {
    const userId = socket.userId;
    const userEmail = socket.userEmail;
    const userRole = socket.userRole;

    logger.info(`Client connected: ${userId} (${userEmail}), Socket ID: ${socket.id}`);

    // Store session in Redis
    await storeSocketSession(userId, {
      socketId: socket.id,
      userId,
      userRole,
      userEmail,
      connectedAt: new Date().toISOString(),
      lastPing: new Date().toISOString(),
    });

    // Join user-specific room
    socket.join(`user:${userId}`);
    socket.join(`role:${userRole}`);

    // Handle ping for keepalive tracking
    socket.on('ping', async () => {
      await updateSessionPing(userId);
      socket.emit('pong');
    });

    // Handle explicit reconnection request
    socket.on('reconnect_request', async () => {
      logger.info(`Reconnection request from ${userEmail}`);
      socket.emit('reconnect_ack', { success: true });
    });

    // Handle disconnection
    socket.on('disconnect', async (reason: string) => {
      logger.info(`Client disconnected: ${userId} (${userEmail}), Reason: ${reason}`);
      
      // Only remove session if this is the current socket
      const session = await getSocketSession(userId);
      if (session && session.socketId === socket.id) {
        // Don't immediately remove - allow for reconnection
        // Session will expire naturally or be replaced by new connection
        if (reason === 'client namespace disconnect' || reason === 'server namespace disconnect') {
          await removeSocketSession(userId);
        }
      }
    });

    // Handle errors
    socket.on('error', (error: Error) => {
      logger.error(`Socket error for ${userEmail}:`, error);
    });

    // Acknowledge connection
    socket.emit('connected', {
      message: 'Successfully connected to notification server',
      userId,
      role: userRole,
      socketId: socket.id,
    });
  });

  logger.info('Socket.IO server initialized with Redis session support');
  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

export const emitNotification = async (userId: string, notification: any) => {
  try {
    const io = getIO();
    
    // Get user's socket session from Redis
    const session = await getSocketSession(userId);
    
    if (session) {
      // Emit to specific socket if session exists
      io.to(`user:${userId}`).emit('notification', notification);
      logger.info(`Notification emitted to user ${userId}: ${notification.title}`);
    } else {
      // User not connected, notification will be fetched on next connect
      logger.info(`User ${userId} not connected, notification stored for later`);
    }
  } catch (error) {
    logger.error('Error emitting notification:', error);
  }
};

export const emitToRole = (role: UserRole, event: string, data: any) => {
  try {
    const io = getIO();
    io.to(`role:${role}`).emit(event, data);
    logger.info(`Event ${event} emitted to role ${role}`);
  } catch (error) {
    logger.error('Error emitting to role:', error);
  }
};

// Get all connected users (for debugging/admin)
export const getConnectedUsers = async (): Promise<SocketSession[]> => {
  try {
    const keys = await redisClient.keys(`${SOCKET_SESSION_PREFIX}*`);
    const sessions: SocketSession[] = [];
    
    for (const key of keys) {
      const session = await redisClient.get(key);
      if (session) {
        sessions.push(JSON.parse(session));
      }
    }
    
    return sessions;
  } catch (error) {
    logger.error('Failed to get connected users:', error);
    return [];
  }
};

// Check if user is online
export const isUserOnline = async (userId: string): Promise<boolean> => {
  const session = await getSocketSession(userId);
  return session !== null;
};
