import { Router } from 'express';
import { userController } from '../controllers/userController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Check if user is surgeon
const requireSurgeon = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'SURGEON') {
    return res.status(403).json({ message: 'Access denied. Surgeon role required.' });
  }
  next();
};

router.use(requireSurgeon);

// Moderator management routes for surgeons
router.post('/', userController.createModeratorBySurgeon.bind(userController));
router.get('/', userController.getModeratorsBySurgeon.bind(userController));

export default router;
