import { Router } from 'express';
import { auditLogController } from '../controllers/auditLogController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Check if user is admin
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Access denied. Admin role required.' });
  }
  next();
};

router.use(requireAdmin);

// Get available filter options
router.get('/actions', auditLogController.getAuditActions.bind(auditLogController));
router.get('/entity-types', auditLogController.getEntityTypes.bind(auditLogController));

// Get audit log statistics
router.get('/stats', auditLogController.getStats.bind(auditLogController));

// Export audit logs
router.get('/export', auditLogController.exportLogs.bind(auditLogController));

// Get logs by entity
router.get('/entity/:entityType/:entityId', auditLogController.getLogsByEntity.bind(auditLogController));

// Get logs by user
router.get('/user/:userId', auditLogController.getLogsByUser.bind(auditLogController));

// Get audit log by ID
router.get('/:id', auditLogController.getLogById.bind(auditLogController));

// Get all audit logs with pagination and filtering
router.get('/', auditLogController.getLogs.bind(auditLogController));

// Delete old audit logs (admin only)
router.delete('/cleanup', auditLogController.deleteOldLogs.bind(auditLogController));

export default router;
