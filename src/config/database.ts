import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});

prisma.$on('warn' as never, (e: unknown) => {
  logger.warn('Prisma Warning:', e);
});

prisma.$on('error' as never, (e: unknown) => {
  logger.error('Prisma Error:', e);
});

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
  logger.info('Database disconnected');
};

export { prisma };
