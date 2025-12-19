import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { auditLogService, CreateAuditLogData } from '../services/auditLogService';


/**
 * Middleware to create audit logs for specific actions
 * Use this as a middleware wrapper for routes that need audit logging
 */
export const createAuditLog = (
  action: string,
  entityType: string,
  getEntityId: (req: AuthRequest) => string,
  getDescription?: (req: AuthRequest) => string,
  getChanges?: (req: AuthRequest) => Record<string, any> | undefined
) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    // Store original json function to intercept response
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      // Log audit after response is determined
      const logData: CreateAuditLogData = {
        userId: req.user?.id,
        action,
        entityType,
        entityId: getEntityId(req),
        description: getDescription ? getDescription(req) : undefined,
        changes: getChanges ? getChanges(req) : undefined,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        requestMethod: req.method,
        requestPath: req.originalUrl,
        success: res.statusCode >= 200 && res.statusCode < 400,
        errorMessage: res.statusCode >= 400 ? body?.message : undefined,
      };

      // Log asynchronously - don't block response
      auditLogService.createLog(logData).catch(() => {});

      return originalJson(body);
    };

    next();
  };
};

/**
 * Helper function to manually create audit log from controllers
 */
export const logAuditEvent = async (
  req: AuthRequest,
  action: string,
  entityType: string,
  entityId: string,
  options?: {
    description?: string;
    changes?: Record<string, any>;
    success?: boolean;
    errorMessage?: string;
  }
): Promise<void> => {
  const logData: CreateAuditLogData = {
    userId: req.user?.id,
    action,
    entityType,
    entityId,
    description: options?.description,
    changes: options?.changes,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
    requestMethod: req.method,
    requestPath: req.originalUrl,
    success: options?.success ?? true,
    errorMessage: options?.errorMessage,
  };

  await auditLogService.createLog(logData);
};

/**
 * Pre-built middleware for common actions
 */
export const auditMiddleware = {
  /**
   * Audit CREATE action
   */
  create: (entityType: string, getEntityId: (req: AuthRequest) => string) =>
    createAuditLog('CREATE', entityType, getEntityId),

  /**
   * Audit UPDATE action
   */
  update: (entityType: string, getEntityId: (req: AuthRequest) => string) =>
    createAuditLog('UPDATE', entityType, getEntityId),

  /**
   * Audit DELETE action
   */
  delete: (entityType: string, getEntityId: (req: AuthRequest) => string) =>
    createAuditLog('DELETE', entityType, getEntityId),

  /**
   * Audit VIEW action
   */
  view: (entityType: string, getEntityId: (req: AuthRequest) => string) =>
    createAuditLog('VIEW', entityType, getEntityId),

  /**
   * Audit ARCHIVE action
   */
  archive: (entityType: string, getEntityId: (req: AuthRequest) => string) =>
    createAuditLog('ARCHIVE', entityType, getEntityId),

  /**
   * Audit EXPORT action
   */
  export: (entityType: string, getEntityId: (req: AuthRequest) => string) =>
    createAuditLog('EXPORT', entityType, getEntityId),

  /**
   * Audit SHARE action
   */
  share: (entityType: string, getEntityId: (req: AuthRequest) => string) =>
    createAuditLog('SHARE', entityType, getEntityId),
};
