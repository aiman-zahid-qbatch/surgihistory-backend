import { prisma } from '../config/database';
import { logger } from '../config/logger';


export interface CreateAuditLogData {
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, any>;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  requestMethod?: string;
  requestPath?: string;
  success?: boolean;
  errorMessage?: string;
}

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface AuditLogStats {
  totalLogs: number;
  actionCounts: Record<string, number>;
  entityTypeCounts: Record<string, number>;
  successRate: number;
  recentActivity: {
    date: string;
    count: number;
  }[];
}

export class AuditLogService {
  /**
   * Create a new audit log entry
   */
  async createLog(data: CreateAuditLogData): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          changes: typeof data.changes === 'string' ? data.changes : JSON.stringify(data.changes),
          description: data.description,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          requestMethod: data.requestMethod,
          requestPath: data.requestPath,
          success: data.success ?? true,
          errorMessage: data.errorMessage,
        },
      });

      logger.debug(`Audit log created: ${data.action} on ${data.entityType}/${data.entityId}`);
    } catch (error) {
      // Don't throw error for audit logging failures - just log it
      logger.error('Failed to create audit log:', error);
    }
  }

  /**
   * Get all audit logs with pagination and filtering
   */
  async getLogs(
    filters: AuditLogFilters = {},
    pagination: PaginationParams = { page: 1, limit: 50 }
  ) {
    try {
      const { page, limit } = pagination;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      if (filters.userId) {
        where.userId = filters.userId;
      }

      if (filters.action) {
        where.action = filters.action;
      }

      if (filters.entityType) {
        where.entityType = filters.entityType;
      }

      if (filters.entityId) {
        where.entityId = filters.entityId;
      }

      if (filters.success !== undefined) {
        where.success = filters.success;
      }

      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) {
          where.createdAt.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.createdAt.lte = filters.endDate;
        }
      }

      if (filters.search) {
        where.OR = [
          { description: { contains: filters.search } },
          { entityId: { contains: filters.search } },
          { entityType: { contains: filters.search } },
        ];
      }

      // Get total count
      const total = await prisma.auditLog.count({ where });

      // Get paginated logs
      const logs = await prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      });

      return {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + logs.length < total,
        },
      };
    } catch (error) {
      logger.error('Error fetching audit logs:', error);
      throw error;
    }
  }

  /**
   * Get audit log by ID
   */
  async getLogById(id: string) {
    try {
      const log = await prisma.auditLog.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
        },
      });

      return log;
    } catch (error) {
      logger.error(`Error fetching audit log ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get audit logs for a specific entity
   */
  async getLogsByEntity(entityType: string, entityId: string) {
    try {
      const logs = await prisma.auditLog.findMany({
        where: {
          entityType,
          entityId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return logs;
    } catch (error) {
      logger.error(`Error fetching audit logs for ${entityType}/${entityId}:`, error);
      throw error;
    }
  }

  /**
   * Get audit logs for a specific user
   */
  async getLogsByUser(userId: string, pagination: PaginationParams = { page: 1, limit: 50 }) {
    try {
      const { page, limit } = pagination;
      const skip = (page - 1) * limit;

      const total = await prisma.auditLog.count({
        where: { userId },
      });

      const logs = await prisma.auditLog.findMany({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      });

      return {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + logs.length < total,
        },
      };
    } catch (error) {
      logger.error(`Error fetching audit logs for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get audit log statistics
   */
  async getStats(startDate?: Date, endDate?: Date): Promise<AuditLogStats> {
    try {
      const where: any = {};
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = startDate;
        }
        if (endDate) {
          where.createdAt.lte = endDate;
        }
      }

      // Get total logs
      const totalLogs = await prisma.auditLog.count({ where });

      // Get action counts
      const actionGroups = await prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: {
          action: true,
        },
      });

      const actionCounts: Record<string, number> = {};
      actionGroups.forEach((group) => {
        actionCounts[group.action] = group._count.action;
      });

      // Get entity type counts
      const entityTypeGroups = await prisma.auditLog.groupBy({
        by: ['entityType'],
        where,
        _count: {
          entityType: true,
        },
      });

      const entityTypeCounts: Record<string, number> = {};
      entityTypeGroups.forEach((group) => {
        entityTypeCounts[group.entityType] = group._count.entityType;
      });

      // Get success rate
      const successCount = await prisma.auditLog.count({
        where: { ...where, success: true },
      });
      const successRate = totalLogs > 0 ? (successCount / totalLogs) * 100 : 100;

      // Get recent activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentLogs = await prisma.auditLog.findMany({
        where: {
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
        select: {
          createdAt: true,
        },
      });

      // Group by date
      const activityByDate: Record<string, number> = {};
      recentLogs.forEach((log) => {
        const dateStr = log.createdAt.toISOString().split('T')[0];
        activityByDate[dateStr] = (activityByDate[dateStr] || 0) + 1;
      });

      const recentActivity = Object.entries(activityByDate)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        totalLogs,
        actionCounts,
        entityTypeCounts,
        successRate,
        recentActivity,
      };
    } catch (error) {
      logger.error('Error fetching audit log stats:', error);
      throw error;
    }
  }

  /**
   * Delete old audit logs (cleanup)
   */
  async deleteOldLogs(olderThanDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await prisma.auditLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      logger.info(`Deleted ${result.count} audit logs older than ${olderThanDays} days`);
      return result.count;
    } catch (error) {
      logger.error('Error deleting old audit logs:', error);
      throw error;
    }
  }

  /**
   * Export audit logs to JSON format
   */
  async exportLogs(filters: AuditLogFilters = {}) {
    try {
      const where: any = {};

      if (filters.userId) {
        where.userId = filters.userId;
      }

      if (filters.action) {
        where.action = filters.action;
      }

      if (filters.entityType) {
        where.entityType = filters.entityType;
      }

      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) {
          where.createdAt.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.createdAt.lte = filters.endDate;
        }
      }

      const logs = await prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return logs;
    } catch (error) {
      logger.error('Error exporting audit logs:', error);
      throw error;
    }
  }

  /**
   * Get unique entity types from audit logs
   */
  async getEntityTypes(): Promise<string[]> {
    try {
      const result = await prisma.auditLog.findMany({
        select: {
          entityType: true,
        },
        distinct: ['entityType'],
      });

      return result.map((r) => r.entityType);
    } catch (error) {
      logger.error('Error fetching entity types:', error);
      throw error;
    }
  }

  /**
   * Get all possible audit actions
   */
  getAuditActions(): string[] {
    return ['CREATE', 'UPDATE', 'VIEW', 'HIDE', 'ARCHIVE', 'DELETE', 'EXPORT', 'SHARE'];
  }
}

export const auditLogService = new AuditLogService();
