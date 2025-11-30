import { Router } from 'express';
import { userController } from '../controllers/userController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);

// Check if user is admin
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Access denied. Admin role required.' });
  }
  next();
};

router.use(requireAdmin);

// User management routes
router.get('/', userController.getAllUsers.bind(userController));
router.get('/pending-surgeons', userController.getPendingSurgeons.bind(userController));
router.get('/:id', userController.getUserById.bind(userController));
router.post('/', userController.createUser.bind(userController));
router.post('/:id/approve', userController.approveSurgeon.bind(userController));
router.post('/:id/reject', userController.rejectSurgeon.bind(userController));
router.put('/:id', userController.updateUser.bind(userController));
router.delete('/:id', userController.deleteUser.bind(userController));
router.patch('/:id/toggle-status', userController.toggleUserStatus.bind(userController));

export default router;
