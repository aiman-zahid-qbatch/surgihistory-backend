import { prisma } from '../config/database';
import { logger } from '../config/logger';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { UserRole } from '@prisma/client';
import { emailService } from './emailService';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateUserData {
  email: string;
  name?: string;
  role: UserRole;
}

interface UpdateUserData {
  email?: string;
  name?: string;
  role?: UserRole;
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
            not: UserRole.ADMIN
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
      if (existingUser.role === UserRole.ADMIN) {
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
      if (user.role === UserRole.ADMIN) {
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
      if (user.role === UserRole.ADMIN) {
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
}

export const userService = new UserService();
