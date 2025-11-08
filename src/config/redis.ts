import { createClient } from 'redis';
import { logger } from './logger';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis: Too many reconnection attempts, stopping');
        return new Error('Too many retries');
      }
      return retries * 100;
    },
  },
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  logger.info('Redis Client Connected');
});

redisClient.on('reconnecting', () => {
  logger.warn('Redis Client Reconnecting');
});

redisClient.on('ready', () => {
  logger.info('Redis Client Ready');
});

export const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.connect();
    logger.info('Redis connected successfully');
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
};

export const disconnectRedis = async (): Promise<void> => {
  try {
    await redisClient.quit();
    logger.info('Redis disconnected successfully');
  } catch (error) {
    logger.error('Failed to disconnect from Redis:', error);
  }
};

// Session management functions
export const setSession = async (
  sessionId: string,
  userId: string,
  ttl: number = 7 * 24 * 60 * 60 // 7 days default
): Promise<void> => {
  try {
    await redisClient.setEx(`session:${sessionId}`, ttl, userId);
  } catch (error) {
    logger.error('Failed to set session:', error);
    throw error;
  }
};

export const getSession = async (sessionId: string): Promise<string | null> => {
  try {
    return await redisClient.get(`session:${sessionId}`);
  } catch (error) {
    logger.error('Failed to get session:', error);
    return null;
  }
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  try {
    await redisClient.del(`session:${sessionId}`);
  } catch (error) {
    logger.error('Failed to delete session:', error);
  }
};

// Refresh token management
export const setRefreshToken = async (
  userId: string,
  refreshToken: string,
  ttl: number = 30 * 24 * 60 * 60 // 30 days default
): Promise<void> => {
  try {
    await redisClient.setEx(`refresh:${userId}`, ttl, refreshToken);
  } catch (error) {
    logger.error('Failed to set refresh token:', error);
    throw error;
  }
};

export const getRefreshToken = async (userId: string): Promise<string | null> => {
  try {
    return await redisClient.get(`refresh:${userId}`);
  } catch (error) {
    logger.error('Failed to get refresh token:', error);
    return null;
  }
};

export const deleteRefreshToken = async (userId: string): Promise<void> => {
  try {
    await redisClient.del(`refresh:${userId}`);
  } catch (error) {
    logger.error('Failed to delete refresh token:', error);
  }
};

// Blacklist token (for logout)
export const blacklistToken = async (
  token: string,
  ttl: number = 15 * 60 // 15 minutes (access token expiry)
): Promise<void> => {
  try {
    await redisClient.setEx(`blacklist:${token}`, ttl, 'true');
  } catch (error) {
    logger.error('Failed to blacklist token:', error);
    throw error;
  }
};

export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  try {
    const result = await redisClient.get(`blacklist:${token}`);
    return result !== null;
  } catch (error) {
    logger.error('Failed to check token blacklist:', error);
    return false;
  }
};

export { redisClient };
