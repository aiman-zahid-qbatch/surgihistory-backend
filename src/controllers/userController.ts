import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/userService';
import { logger } from '../config/logger';
import { prisma } from '../config/database';

import { AuthRequest } from '../middlewares/auth';
import { logAuditEvent } from '../middlewares/auditLog';
import notificationService from '../services/notificationService';

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

  async createUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, name, role, cnic, fullName, fatherName, contactNumber, whatsappNumber, address } = req.body;

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

      // Validate required fields for PATIENT role
      if (role === 'PATIENT') {
        if (!cnic || !fullName || !fatherName || !contactNumber) {
          res.status(400).json({ 
            message: 'Patient role requires: cnic, fullName, fatherName, and contactNumber' 
          });
          return;
        }

        // Validate CNIC format
        const cnicRegex = /^\d{5}-?\d{7}-?\d{1}$/;
        if (!cnicRegex.test(cnic)) {
          res.status(400).json({ message: 'Invalid CNIC format. Use format: 12345-1234567-1' });
          return;
        }

        // Validate contact number
        const phoneRegex = /^[+]?[\d\s-]+$/;
        const digitsOnly = contactNumber.replace(/[^\d]/g, '');
        if (!phoneRegex.test(contactNumber) || digitsOnly.length < 10) {
          res.status(400).json({ message: 'Invalid contact number. Must contain at least 10 digits' });
          return;
        }
      }

      const user = await userService.createUser({ 
        email, 
        name: name || fullName, 
        role,
        // Patient-specific fields
        cnic,
        fullName,
        fatherName,
        contactNumber,
        whatsappNumber,
        address,
      });

      // Log audit event for user creation
      await logAuditEvent(req, 'CREATE', 'user', user.id, {
        description: `Created user: ${email} with role ${role}`,
        changes: { email, name, role },
      });

      // Notify all admins about new user creation (for non-admin users)
      if (role !== 'ADMIN') {
        await notificationService.notifyUserCreated(
          user.id,
          name || fullName || email,
          email,
          role
        );
      }

      res.status(201).json(user);
    } catch (error: any) {
      logger.error('Error in createUser:', error);
      if (error.message === 'User with this email already exists' || 
          error.message === 'Patient with this CNIC already exists' ||
          error.message.includes('Patient role requires')) {
        res.status(409).json({ message: error.message });
        return;
      }
      next(error);
    }
  }

  async updateUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { email, name, role, isActive } = req.body;

      const user = await userService.updateUser(id, { email, name, role, isActive });

      // Log audit event for user update
      await logAuditEvent(req, 'UPDATE', 'user', id, {
        description: `Updated user: ${user.email}`,
        changes: { email, name, role, isActive },
      });

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

  async deleteUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      // Log audit event before deletion
      await logAuditEvent(req, 'DELETE', 'user', id, {
        description: `Deleted user with ID: ${id}`,
      });

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

  async toggleUserStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = await userService.toggleUserStatus(id);

      // Log audit event for status toggle
      await logAuditEvent(req, 'UPDATE', 'user', id, {
        description: `Toggled user status: ${user.email} is now ${user.isActive ? 'active' : 'inactive'}`,
        changes: { isActive: user.isActive },
      });

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

  async approveSurgeon(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = await userService.approveSurgeon(id);

      // Log audit event for surgeon approval
      await logAuditEvent(req, 'UPDATE', 'surgeon', id, {
        description: `Approved surgeon: ${user.email}`,
      });

      // Notify the surgeon that their account is approved
      const surgeon = await prisma.surgeon.findUnique({
        where: { userId: id },
      });
      if (surgeon) {
        await notificationService.notifySurgeonApproved(id, surgeon.id);
      }

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

  async rejectSurgeon(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      // Log audit event for surgeon rejection
      await logAuditEvent(req, 'DELETE', 'surgeon', id, {
        description: `Rejected surgeon registration with ID: ${id}`,
      });

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
  async createModeratorBySurgeon(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
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

      // Get surgeon name for notification
      let surgeonName = 'A surgeon';
      if (req.user) {
        const surgeon = await prisma.surgeon.findUnique({
          where: { userId: req.user.id },
          select: { fullName: true },
        });
        if (surgeon) {
          surgeonName = surgeon.fullName;
        }
      }

      // Fetch the moderator profile to get the moderator ID
      const moderatorProfile = await prisma.moderator.findUnique({
        where: { userId: moderator.id },
        select: { id: true },
      });

      // Send welcome notification to the new moderator
      if (moderatorProfile?.id) {
        try {
          await notificationService.notifyModeratorCreated(
            moderatorProfile.id,
            surgeonName
          );
        } catch (notifError) {
          logger.error('Error sending moderator welcome notification:', notifError);
        }
      }

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

  // Get all surgeons (for dropdown in patient assignment - admin only)
  async getAllSurgeons(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get all active surgeons with their profile information
      const surgeons = await prisma.surgeon.findMany({
        where: {
          isArchived: false,
          user: {
            isActive: true,
          },
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
        data: surgeons,
      });
    } catch (error) {
      logger.error('Error in getAllSurgeons:', error);
      next(error);
    }
  }
}

export const userController = new UserController();
