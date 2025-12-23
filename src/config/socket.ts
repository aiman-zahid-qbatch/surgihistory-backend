import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from './logger';
import { UserRole } from '../middlewares/auth';

let io: SocketIOServer;

interface SocketSession {
  socketId: string;
  userId: string;
  userRole: string;
  userEmail: string;
  connectedAt: string;
  lastPing: string;
}

// Socket session management (In-memory)
// Note: This works for single-server deployments. For multi-server, use a shared store.
const socketSessions = new Map<string, SocketSession>();

// Store socket session in memory
const storeSocketSession = async (userId: string, session: SocketSession): Promise<void> => {
  try {
    socketSessions.set(userId, session);
  } catch (error) {
    logger.error('Failed to store socket session:', error);
  }
};

// Get socket session from memory
const getSocketSession = async (userId: string): Promise<SocketSession | null> => {
  try {
    return socketSessions.get(userId) || null;
  } catch (error) {
    logger.error('Failed to get socket session:', error);
    return null;
  }
};

// Remove socket session from memory
const removeSocketSession = async (userId: string): Promise<void> => {
  try {
    socketSessions.delete(userId);
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

    // Store session
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
        // Session will be replaced by new connection
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

  logger.info('Socket.IO server initialized with In-memory session support');
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

    // Check if user has a socket session
    const session = await getSocketSession(userId);

    if (session) {
      // Emit to specific room for user
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
    return Array.from(socketSessions.values());
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
