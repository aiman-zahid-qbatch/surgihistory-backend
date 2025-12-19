import { prisma } from '../config/database';
import { logger } from '../config/logger';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

import { emailService } from './emailService';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateUserData {
  email: string;
  name?: string;
  role: string;
  // Patient-specific fields (required when role is PATIENT)
  cnic?: string;
  fullName?: string;
  fatherName?: string;
  contactNumber?: string;
  whatsappNumber?: string;
  address?: string;
}

interface UpdateUserData {
  email?: string;
  name?: string;
  role?: string;
  isActive?: boolean;
}

export class UserService {
  // Generate a secure random password
  private generatePassword(length: number = 12): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    const randomBytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length];
    }
    
    return password;
  }
    async getAllUsers(excludeAdmins: boolean = true): Promise<Omit<User, 'password'>[]> {
    try {
      const users = await prisma.user.findMany({
        where: excludeAdmins ? {
          role: {
            not: 'ADMIN'
          }
        } : undefined,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return users;
    } catch (error) {
      logger.error('Error fetching users:', error);
      throw error;
    }
  }

  async getUserById(id: string): Promise<Omit<User, 'password'> | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return user;
    } catch (error) {
      logger.error(`Error fetching user with ID ${id}:`, error);
      throw error;
    }
  }

  async createUser(data: CreateUserData): Promise<Omit<User, 'password'>> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Generate a random secure password
      const generatedPassword = this.generatePassword();
      const hashedPassword = await bcrypt.hash(generatedPassword, 10);

      // Create user with generated password
      const user = await prisma.user.create({
        data: {
          email: data.email,
          name: data.name || null,
          password: hashedPassword,
          role: data.role,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Create Surgeon profile for SURGEON role
      if (data.role === 'SURGEON') {
        await prisma.surgeon.create({
          data: {
            userId: user.id,
            fullName: data.name || data.email.split('@')[0],
            contactNumber: '', // Can be updated later
            specialization: 'Surgeon',
          },
        });
        logger.info(`Surgeon profile created for user: ${user.email}`);
      }

      // Create Moderator profile for MODERATOR role
      if (data.role === 'MODERATOR') {
        await prisma.moderator.create({
          data: {
            userId: user.id,
            fullName: data.name || data.email.split('@')[0],
            contactNumber: '', // Can be updated later
          },
        });
        logger.info(`Moderator profile created for user: ${user.email}`);
      }

      // Create Patient profile for PATIENT role
      if (data.role === 'PATIENT') {
        // Validate required patient fields
        if (!data.cnic || !data.fullName || !data.fatherName || !data.contactNumber) {
          throw new Error('Patient role requires: cnic, fullName, fatherName, and contactNumber');
        }

        // Check if CNIC already exists
        const existingPatient = await prisma.patient.findUnique({
          where: { cnic: data.cnic },
        });
        if (existingPatient) {
          // Rollback user creation
          await prisma.user.delete({ where: { id: user.id } });
          throw new Error('Patient with this CNIC already exists');
        }

        // Generate a unique patient ID
        const patientCount = await prisma.patient.count();
        const patientId = `PAT-${new Date().getFullYear()}-${String(patientCount + 1).padStart(4, '0')}`;
        
        await prisma.patient.create({
          data: {
            userId: user.id,
            patientId: patientId,
            cnic: data.cnic,
            fullName: data.fullName,
            fatherName: data.fatherName,
            contactNumber: data.contactNumber,
            whatsappNumber: data.whatsappNumber || data.contactNumber,
            address: data.address || '',
          },
        });
        logger.info(`Patient profile created for user: ${user.email} with ID: ${patientId}`);
      }

      // Send welcome email with credentials (don't fail user creation if email fails)
      try {
        await emailService.sendWelcomeEmail(
          user.email,
          user.name || 'User',
          generatedPassword,
          user.role
        );
        logger.info(`Welcome email sent to ${user.email}`);
      } catch (emailError) {
        logger.error(`Failed to send welcome email to ${user.email}:`, emailError);
        // Continue - user creation succeeded even if email failed
      }

      logger.info(`User created successfully: ${user.email}`);
      return user;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(userId: string, data: UpdateUserData): Promise<Omit<User, 'password'>> {
    try {
      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        throw new Error('User not found');
      }

      // Prevent changing admin role
      if (existingUser.role === 'ADMIN') {
        throw new Error('Cannot modify admin users');
      }

      // Check if email is being changed and if it's already taken
      if (data.email && data.email !== existingUser.email) {
        const emailExists = await prisma.user.findUnique({
          where: { email: data.email },
        });

        if (emailExists) {
          throw new Error('Email already in use');
        }
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(data.email && { email: data.email }),
          ...(data.name !== undefined && { name: data.name }),
          ...(data.role && { role: data.role }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info(`User updated: ${user.email}`);

      return user;
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Prevent deleting admin users
      if (user.role === 'ADMIN') {
        throw new Error('Cannot delete admin users');
      }

      await prisma.user.delete({
        where: { id: userId },
      });

      logger.info(`User deleted: ${user.email}`);
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  async toggleUserStatus(userId: string): Promise<Omit<User, 'password'>> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Prevent deactivating admin users
      if (user.role === 'ADMIN') {
        throw new Error('Cannot modify admin status');
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          isActive: !user.isActive,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info(`User status toggled: ${updatedUser.email} - Active: ${updatedUser.isActive}`);

      return updatedUser;
    } catch (error) {
      logger.error('Error toggling user status:', error);
      throw error;
    }
  }

  async approveSurgeon(userId: string): Promise<Omit<User, 'password'>> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.role !== 'SURGEON') {
        throw new Error('User is not a surgeon');
      }

      if (user.isActive) {
        throw new Error('Surgeon is already approved');
      }

      // Activate the surgeon account
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Send approval email
      try {
        await emailService.sendApprovalEmail(
          updatedUser.email,
          updatedUser.name || 'Surgeon'
        );
      } catch (emailError) {
        logger.error('Failed to send approval email:', emailError);
        // Don't throw error here, account is already approved
      }

      logger.info(`Surgeon approved: ${updatedUser.email}`);

      return updatedUser;
    } catch (error) {
      logger.error('Error approving surgeon:', error);
      throw error;
    }
  }

  async rejectSurgeon(userId: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.role !== 'SURGEON') {
        throw new Error('User is not a surgeon');
      }

      if (user.isActive) {
        throw new Error('Cannot reject an approved surgeon');
      }

      // Send rejection email before deleting
      try {
        await emailService.sendRejectionEmail(
          user.email,
          user.name || 'Surgeon'
        );
      } catch (emailError) {
        logger.error('Failed to send rejection email:', emailError);
      }

      // Delete the user
      await prisma.user.delete({
        where: { id: userId },
      });

      logger.info(`Surgeon registration rejected and deleted: ${user.email}`);
    } catch (error) {
      logger.error('Error rejecting surgeon:', error);
      throw error;
    }
  }

  async getPendingSurgeons(): Promise<Omit<User, 'password'>[]> {
    try {
      const pendingSurgeons = await prisma.user.findMany({
        where: {
          role: 'SURGEON',
          isActive: false,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return pendingSurgeons;
    } catch (error) {
      logger.error('Error fetching pending surgeons:', error);
      throw error;
    }
  }
}

export const userService = new UserService();
