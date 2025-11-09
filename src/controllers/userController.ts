import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/userService';
import { logger } from '../config/logger';

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
}

export const userController = new UserController();
