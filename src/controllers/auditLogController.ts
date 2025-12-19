import { Request, Response, NextFunction } from 'express';
import { auditLogService, AuditLogFilters } from '../services/auditLogService';
import { logger } from '../config/logger';
import { AuthRequest } from '../middlewares/auth';


export class AuditLogController {
  /**
   * Get all audit logs with pagination and filtering
   */
  async getLogs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        page = '1',
        limit = '50',
        userId,
        action,
        entityType,
        entityId,
        success,
        startDate,
        endDate,
        search,
      } = req.query;

      const filters: AuditLogFilters = {};

      if (userId) {
        filters.userId = userId as string;
      }

      if (action) {
        filters.action = action as string;
      }

      if (entityType) {
        filters.entityType = entityType as string;
      }

      if (entityId) {
        filters.entityId = entityId as string;
      }

      if (success !== undefined) {
        filters.success = success === 'true';
      }

      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }

      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }

      if (search) {
        filters.search = search as string;
      }

      const result = await auditLogService.getLogs(filters, {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
      });

      res.json({
        success: true,
        data: result.logs,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Error in getLogs:', error);
      next(error);
    }
  }

  /**
   * Get audit log by ID
   */
  async getLogById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const log = await auditLogService.getLogById(id);

      if (!log) {
        res.status(404).json({
          success: false,
          message: 'Audit log not found',
        });
        return;
      }

      res.json({
        success: true,
        data: log,
      });
    } catch (error) {
      logger.error('Error in getLogById:', error);
      next(error);
    }
  }

  /**
   * Get audit logs for a specific entity
   */
  async getLogsByEntity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entityType, entityId } = req.params;

      const logs = await auditLogService.getLogsByEntity(entityType, entityId);

      res.json({
        success: true,
        data: logs,
      });
    } catch (error) {
      logger.error('Error in getLogsByEntity:', error);
      next(error);
    }
  }

  /**
   * Get audit logs for a specific user
   */
  async getLogsByUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { page = '1', limit = '50' } = req.query;

      const result = await auditLogService.getLogsByUser(userId, {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
      });

      res.json({
        success: true,
        data: result.logs,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Error in getLogsByUser:', error);
      next(error);
    }
  }

  /**
   * Get audit log statistics
   */
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      const stats = await auditLogService.getStats(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error in getStats:', error);
      next(error);
    }
  }

  /**
   * Export audit logs
   */
  async exportLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, action, entityType, startDate, endDate } = req.query;

      const filters: AuditLogFilters = {};

      if (userId) {
        filters.userId = userId as string;
      }

      if (action) {
        filters.action = action as string;
      }

      if (entityType) {
        filters.entityType = entityType as string;
      }

      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }

      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }

      const logs = await auditLogService.exportLogs(filters);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${new Date().toISOString()}.json`);

      res.json({
        exportedAt: new Date().toISOString(),
        filters,
        totalRecords: logs.length,
        data: logs,
      });
    } catch (error) {
      logger.error('Error in exportLogs:', error);
      next(error);
    }
  }

  /**
   * Delete old audit logs (cleanup)
   */
  async deleteOldLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { days = '90' } = req.query;
      const olderThanDays = parseInt(days as string, 10);

      if (isNaN(olderThanDays) || olderThanDays < 30) {
        res.status(400).json({
          success: false,
          message: 'Days must be a number greater than or equal to 30',
        });
        return;
      }

      const deletedCount = await auditLogService.deleteOldLogs(olderThanDays);

      res.json({
        success: true,
        message: `Deleted ${deletedCount} audit logs older than ${olderThanDays} days`,
        deletedCount,
      });
    } catch (error) {
      logger.error('Error in deleteOldLogs:', error);
      next(error);
    }
  }

  /**
   * Get available entity types
   */
  async getEntityTypes(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entityTypes = await auditLogService.getEntityTypes();

      res.json({
        success: true,
        data: entityTypes,
      });
    } catch (error) {
      logger.error('Error in getEntityTypes:', error);
      next(error);
    }
  }

  /**
   * Get available audit actions
   */
  async getAuditActions(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    const actions = auditLogService.getAuditActions();

    res.json({
      success: true,
      data: actions,
    });
  }
}

export const auditLogController = new AuditLogController();
