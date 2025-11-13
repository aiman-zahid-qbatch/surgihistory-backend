import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/userService';
import { logger } from '../config/logger';
import { prisma } from '../config/database';

export class UserController {
  async getAllUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await userService.getAllUsers(true); // Exclude admins
      res.json(users);
    } catch (error) {
      logger.error('Error in getAllUsers:', error);
      next(error);
    }
  }

  async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = await userService.getUserById(id);

      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      res.json(user);
    } catch (error) {
      logger.error('Error in getUserById:', error);
      next(error);
    }
  }

  async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, name, role } = req.body;

      if (!email || !role) {
        res.status(400).json({ message: 'Email and role are required' });
        return;
      }

      // Validate role
      const validRoles = ['PATIENT', 'MODERATOR', 'SURGEON', 'ADMIN'];
      if (!validRoles.includes(role)) {
        res.status(400).json({ message: 'Invalid role. Valid roles are: PATIENT, MODERATOR, SURGEON, ADMIN' });
        return;
      }

      const user = await userService.createUser({ email, name, role });
      res.status(201).json(user);
    } catch (error: any) {
      logger.error('Error in createUser:', error);
      if (error.message === 'User already exists with this email') {
        res.status(409).json({ message: error.message });
        return;
      }
      next(error);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { email, name, role, isActive } = req.body;

      const user = await userService.updateUser(id, { email, name, role, isActive });
      res.json(user);
    } catch (error: any) {
      logger.error('Error in updateUser:', error);
      if (error.message === 'User not found') {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error.message === 'Cannot modify admin users' || error.message === 'Email already in use') {
        res.status(403).json({ message: error.message });
        return;
      }
      next(error);
    }
  }

  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await userService.deleteUser(id);
      res.status(204).send();
    } catch (error: any) {
      logger.error('Error in deleteUser:', error);
      if (error.message === 'User not found') {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error.message === 'Cannot delete admin users') {
        res.status(403).json({ message: error.message });
        return;
      }
      next(error);
    }
  }

  async toggleUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = await userService.toggleUserStatus(id);
      res.json(user);
    } catch (error: any) {
      logger.error('Error in toggleUserStatus:', error);
      if (error.message === 'User not found') {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error.message === 'Cannot modify admin status') {
        res.status(403).json({ message: error.message });
        return;
      }
      next(error);
    }
  }

  async getPendingSurgeons(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const pendingSurgeons = await userService.getPendingSurgeons();
      res.json(pendingSurgeons);
    } catch (error) {
      logger.error('Error in getPendingSurgeons:', error);
      next(error);
    }
  }

  async approveSurgeon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = await userService.approveSurgeon(id);
      res.json({ message: 'Surgeon approved successfully', user });
    } catch (error: any) {
      logger.error('Error in approveSurgeon:', error);
      if (error.message === 'User not found') {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error.message === 'User is not a surgeon' || error.message === 'Surgeon is already approved') {
        res.status(400).json({ message: error.message });
        return;
      }
      next(error);
    }
  }

  async rejectSurgeon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await userService.rejectSurgeon(id);
      res.json({ message: 'Surgeon registration rejected successfully' });
    } catch (error: any) {
      logger.error('Error in rejectSurgeon:', error);
      if (error.message === 'User not found') {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error.message === 'User is not a surgeon' || error.message === 'Cannot reject an approved surgeon') {
        res.status(400).json({ message: error.message });
        return;
      }
      next(error);
    }
  }

  // Surgeon creates a moderator
  async createModeratorBySurgeon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, name } = req.body;

      if (!email) {
        res.status(400).json({ message: 'Email is required' });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ message: 'Invalid email format' });
        return;
      }

      // Validate name if provided
      if (name) {
        const nameRegex = /^[a-zA-Z\s.-]+$/;
        if (!nameRegex.test(name)) {
          res.status(400).json({ message: 'Name can only contain letters, spaces, dots, and hyphens' });
          return;
        }
      }

      // Create moderator with MODERATOR role
      const moderator = await userService.createUser({ 
        email, 
        name: name || null, 
        role: 'MODERATOR' 
      });

      res.status(201).json({
        message: 'Moderator created successfully and email sent with credentials',
        moderator
      });
    } catch (error: any) {
      logger.error('Error in createModeratorBySurgeon:', error);
      if (error.message === 'User with this email already exists') {
        res.status(400).json({ message: error.message });
        return;
      }
      next(error);
    }
  }

  // Get all moderators for surgeon
  async getModeratorsBySurgeon(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await userService.getAllUsers(true);
      // Filter only moderators
      const moderators = users.filter(user => user.role === 'MODERATOR');
      res.json(moderators);
    } catch (error) {
      logger.error('Error in getModeratorsBySurgeon:', error);
      next(error);
    }
  }

  // Get all moderators (for dropdown in patient assignment)
  async getAllModerators(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get all moderators with their profile information
      const moderators = await prisma.moderator.findMany({
        where: {
          isArchived: false,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              isActive: true,
            },
          },
        },
        orderBy: {
          fullName: 'asc',
        },
      });

      res.json({
        success: true,
        data: moderators,
      });
    } catch (error) {
      logger.error('Error in getAllModerators:', error);
      next(error);
    }
  }
}

export const userController = new UserController();
