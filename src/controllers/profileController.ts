import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';

export class ProfileController {
  // Get user profile
  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;

      let user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          profileImage: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          patient: {
            select: {
              id: true,
              patientId: true,
              fullName: true,
              contactNumber: true,
              whatsappNumber: true,
            },
          },
          surgeon: {
            select: {
              id: true,
              fullName: true,
              specialization: true,
              contactNumber: true,
              whatsappNumber: true,
            },
          },
          moderator: {
            select: {
              id: true,
              fullName: true,
              contactNumber: true,
              whatsappNumber: true,
              canAddRecords: true,
              canEditRecords: true,
              canDeleteRecords: true,
            },
          },
        },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      // Auto-create moderator profile if it doesn't exist for MODERATOR role
      if (userRole === 'MODERATOR' && !user.moderator) {
        const newModerator = await prisma.moderator.create({
          data: {
            userId: userId,
            fullName: user.name || user.email.split('@')[0],
            contactNumber: '',
          },
          select: {
            id: true,
            fullName: true,
            contactNumber: true,
            whatsappNumber: true,
            canAddRecords: true,
            canEditRecords: true,
            canDeleteRecords: true,
          },
        });
        
        logger.info(`Auto-created moderator profile for user: ${user.email}`);
        
        // Add the moderator profile to the user object
        (user as any).moderator = newModerator;
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      logger.error('Error fetching profile:', error);
      next(error);
    }
  };

  // Update user profile
  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const { name, email } = req.body;

      // Check if email is already taken by another user
      if (email) {
        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        if (existingUser && existingUser.id !== userId) {
          res.status(400).json({
            success: false,
            message: 'Email is already taken',
          });
          return;
        }
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(name !== undefined && { name }),
          ...(email && { email }),
        },
        select: {
          id: true,
          email: true,
          name: true,
          profileImage: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info(`Profile updated for user: ${user.email}`);

      res.json({
        success: true,
        data: user,
        message: 'Profile updated successfully',
      });
    } catch (error) {
      logger.error('Error updating profile:', error);
      next(error);
    }
  };

  // Update profile image
  updateProfileImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user.id;

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No image file provided',
        });
        return;
      }

      // Get current user to delete old image
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { profileImage: true },
      });

      // Delete old profile image if exists
      if (currentUser?.profileImage) {
        const oldImagePath = path.join(process.cwd(), currentUser.profileImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      // Store relative path
      const relativePath = path.join('uploads', 'profiles', req.file.filename);

      const user = await prisma.user.update({
        where: { id: userId },
        data: { profileImage: relativePath },
        select: {
          id: true,
          email: true,
          name: true,
          profileImage: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info(`Profile image updated for user: ${user.email}`);

      res.json({
        success: true,
        data: user,
        message: 'Profile image updated successfully',
      });
    } catch (error) {
      // Delete uploaded file if database update fails
      if (req.file) {
        const filePath = req.file.path;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      logger.error('Error updating profile image:', error);
      next(error);
    }
  };

  // Delete profile image
  deleteProfileImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user.id;

      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { profileImage: true },
      });

      if (!currentUser?.profileImage) {
        res.status(404).json({
          success: false,
          message: 'No profile image found',
        });
        return;
      }

      // Delete image file
      const imagePath = path.join(process.cwd(), currentUser.profileImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: { profileImage: null },
        select: {
          id: true,
          email: true,
          name: true,
          profileImage: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info(`Profile image deleted for user: ${user.email}`);

      res.json({
        success: true,
        data: user,
        message: 'Profile image deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting profile image:', error);
      next(error);
    }
  };

  // Change password
  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user.id;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'Current password and new password are required',
        });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long',
        });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        res.status(401).json({
          success: false,
          message: 'Current password is incorrect',
        });
        return;
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      logger.info(`Password changed for user: ${user.email}`);

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      logger.error('Error changing password:', error);
      next(error);
    }
  };
}

export default new ProfileController();
