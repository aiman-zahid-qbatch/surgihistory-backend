import { Router } from 'express';
import profileController from '../controllers/profileController';
import { authenticate } from '../middlewares/auth';
import { uploadProfileImage } from '../middlewares/upload';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get current user profile
router.get('/', profileController.getProfile);

// Update profile information
router.put('/', profileController.updateProfile);

// Update profile image
router.post('/image', uploadProfileImage, profileController.updateProfileImage);

// Delete profile image
router.delete('/image', profileController.deleteProfileImage);

// Change password
router.post('/change-password', profileController.changePassword);

export default router;
