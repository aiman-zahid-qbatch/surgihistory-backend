import { prisma } from '../config/database';
import { logger } from '../config/logger';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import notificationService from './notificationService';

export enum UserRole {
  PATIENT = 'PATIENT',
  MODERATOR = 'MODERATOR',
  SURGEON = 'SURGEON',
  ADMIN = 'ADMIN',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  VIEW = 'VIEW',
  HIDE = 'HIDE',
  ARCHIVE = 'ARCHIVE',
  DELETE = 'DELETE',
  EXPORT = 'EXPORT',
  SHARE = 'SHARE',
}

interface User {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface RegisterData {
  email: string;
  password: string;
  role: UserRole;
  fullName?: string;
  specialization?: string;
  phoneNumber?: string;
}

interface LoginResponse {
  user: Omit<User, 'password'>;
  accessToken: string;
  refreshToken: string;
}

interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

interface AuditLogData {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: object;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  requestMethod?: string;
  requestPath?: string;
  success?: boolean;
  errorMessage?: string;
}

export class AuthService {
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '30d';

  private generateAccessToken(user: User): string {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined');
    }

    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      jwtSecret,
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );
  }

  private generateRefreshToken(user: User): string {
    const jwtSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_REFRESH_SECRET is not defined');
    }

    return jwt.sign(
      {
        id: user.id,
        type: 'refresh',
        jti: `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`, // Add unique identifier
      },
      jwtSecret,
      { expiresIn: this.REFRESH_TOKEN_EXPIRY }
    );
  }

  async createAuditLog(data: AuditLogData): Promise<void> {
    try {
      const auditData: any = {
        action: data.action as any,
        entityType: data.entityType,
        entityId: data.entityId,
        changes: data.changes ? JSON.parse(JSON.stringify(data.changes)) : undefined,
        description: data.description,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        requestMethod: data.requestMethod,
        requestPath: data.requestPath,
        success: data.success !== undefined ? data.success : true,
        errorMessage: data.errorMessage,
      };

      // Only include userId if it's not 'unknown'
      if (data.userId && data.userId !== 'unknown') {
        auditData.userId = data.userId;
      }

      await prisma.auditLog.create({
        data: auditData,
      });
    } catch (error) {
      logger.error('Error creating audit log:', error);
    }
  }

  async register(
    data: RegisterData,
    ipAddress?: string,
    userAgent?: string
  ): Promise<User> {
    try {
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new Error('User already exists with this email');
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Surgeons need admin approval, so they start as inactive
      const isActive = data.role === 'SURGEON' ? false : true;

      const user = await prisma.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          role: data.role,
          name: data.fullName || null,
          isActive: isActive,
        },
      }) as User;

      // Create Surgeon profile for SURGEON role
      if (data.role === UserRole.SURGEON) {
        const surgeon = await prisma.surgeon.create({
          data: {
            userId: user.id,
            fullName: data.fullName || data.email.split('@')[0],
            contactNumber: data.phoneNumber || '',
            specialization: data.specialization || 'Surgeon',
          },
        });
        logger.info(`Surgeon profile created for user: ${user.email}`);

        // Notify all admins about the new surgeon signup
        await notificationService.notifySurgeonSignup(
          surgeon.id,
          data.fullName || data.email.split('@')[0],
          data.email
        );
      }

      await this.createAuditLog({
        userId: user.id,
        action: 'CREATE',
        entityType: 'user',
        entityId: user.id,
        description: 'User registration',
        ipAddress,
        userAgent,
        requestMethod: 'POST',
        requestPath: '/api/auth/register',
        success: true,
      });

      logger.info(`User registered: ${user.email}`);
      return user;
    } catch (error) {
      logger.error('Error registering user:', error);
      throw error;
    }
  }

  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResponse> {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          patient: true,
          surgeon: true,
          moderator: true,
        },
      }) as User | null;

      if (!user) {
        await this.createAuditLog({
          userId: 'unknown',
          action: 'VIEW',
          entityType: 'auth',
          entityId: 'login_attempt',
          description: `Failed login attempt for email: ${email}`,
          ipAddress,
          userAgent,
          requestMethod: 'POST',
          requestPath: '/api/auth/login',
          success: false,
          errorMessage: 'Invalid credentials',
        });
        throw new Error('Invalid credentials');
      }

      if (!user.isActive) {
        // Check if the user is a surgeon with pending approval
        const isPendingApproval = user.role === UserRole.SURGEON;

        await this.createAuditLog({
          userId: user.id,
          action: 'VIEW',
          entityType: 'auth',
          entityId: 'login_attempt',
          description: isPendingApproval
            ? 'Login attempt on pending approval account'
            : 'Login attempt on deactivated account',
          ipAddress,
          userAgent,
          requestMethod: 'POST',
          requestPath: '/api/auth/login',
          success: false,
          errorMessage: isPendingApproval
            ? 'Account pending approval'
            : 'Account is deactivated',
        });
        throw new Error(
          isPendingApproval
            ? 'Your account is pending admin approval. You will receive an email once approved.'
            : 'Your account has been deactivated by admin. You are no longer a user of this system.'
        );
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        await this.createAuditLog({
          userId: user.id,
          action: 'VIEW',
          entityType: 'auth',
          entityId: 'login_attempt',
          description: 'Failed login attempt - invalid password',
          ipAddress,
          userAgent,
          requestMethod: 'POST',
          requestPath: '/api/auth/login',
          success: false,
          errorMessage: 'Invalid credentials',
        });
        throw new Error('Invalid credentials');
      }

      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // Store refresh token in database
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt,
        },
      });

      await this.createAuditLog({
        userId: user.id,
        action: 'VIEW',
        entityType: 'auth',
        entityId: 'login_success',
        description: 'User logged in successfully',
        ipAddress,
        userAgent,
        requestMethod: 'POST',
        requestPath: '/api/auth/login',
        success: true,
      });

      logger.info(`User logged in: ${user.email}`);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      logger.error('Error logging in user:', error);
      throw error;
    }
  }

  async refreshToken(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<RefreshTokenResponse> {
    try {
      const jwtSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_REFRESH_SECRET is not defined');
      }

      const decoded = jwt.verify(refreshToken, jwtSecret) as {
        id: string;
        type: string;
      };

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if refresh token exists in database and is not revoked
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!storedToken) {
        await this.createAuditLog({
          userId: decoded.id,
          action: 'VIEW',
          entityType: 'auth',
          entityId: 'token_refresh',
          description: 'Refresh token not found in database',
          ipAddress,
          userAgent,
          success: false,
          errorMessage: 'Invalid refresh token',
        });
        throw new Error('Invalid refresh token');
      }

      if (storedToken.isRevoked) {
        await this.createAuditLog({
          userId: decoded.id,
          action: 'VIEW',
          entityType: 'auth',
          entityId: 'token_refresh',
          description: 'Attempted to use revoked refresh token',
          ipAddress,
          userAgent,
          success: false,
          errorMessage: 'Token has been revoked',
        });
        throw new Error('Token has been revoked');
      }

      if (storedToken.expiresAt < new Date()) {
        await this.createAuditLog({
          userId: decoded.id,
          action: 'VIEW',
          entityType: 'auth',
          entityId: 'token_refresh',
          description: 'Refresh token expired',
          ipAddress,
          userAgent,
          success: false,
          errorMessage: 'Refresh token expired',
        });
        throw new Error('Refresh token expired');
      }

      const user = storedToken.user as User;

      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      const newAccessToken = this.generateAccessToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      // Revoke old refresh token
      await prisma.refreshToken.update({
        where: { token: refreshToken },
        data: { isRevoked: true },
      });

      // Store new refresh token in database
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

      try {
        await prisma.refreshToken.create({
          data: {
            token: newRefreshToken,
            userId: user.id,
            expiresAt,
          },
        });
      } catch (error: any) {
        // If unique constraint fails, try to delete the existing token and retry
        if (error.code === 'P2002') {
          await prisma.refreshToken.deleteMany({
            where: { token: newRefreshToken },
          });
          await prisma.refreshToken.create({
            data: {
              token: newRefreshToken,
              userId: user.id,
              expiresAt,
            },
          });
        } else {
          throw error;
        }
      }

      await this.createAuditLog({
        userId: user.id,
        action: 'VIEW',
        entityType: 'auth',
        entityId: 'token_refresh',
        description: 'Access token refreshed',
        ipAddress,
        userAgent,
        success: true,
      });

      logger.info(`Token refreshed for user: ${user.email}`);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      logger.error('Error refreshing token:', error);
      throw error;
    }
  }

  async logout(
    userId: string,
    accessToken: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      // Revoke all active refresh tokens for this user
      await prisma.refreshToken.updateMany({
        where: {
          userId,
          isRevoked: false,
        },
        data: {
          isRevoked: true,
        },
      });

      // Blacklist the access token
      const decoded = jwt.decode(accessToken) as { exp?: number };
      const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 15 * 60 * 1000);

      await prisma.blacklistedToken.create({
        data: {
          token: accessToken,
          expiresAt,
        },
      });

      await this.createAuditLog({
        userId,
        action: 'VIEW',
        entityType: 'auth',
        entityId: 'logout',
        description: 'User logged out',
        ipAddress,
        userAgent,
        requestMethod: 'POST',
        requestPath: '/api/auth/logout',
        success: true,
      });

      logger.info(`User logged out: ${userId}`);
    } catch (error) {
      logger.error('Error logging out user:', error);
      throw error;
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      }) as User | null;

      if (!user) {
        throw new Error('User not found');
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

      if (!isPasswordValid) {
        await this.createAuditLog({
          userId,
          action: 'UPDATE',
          entityType: 'user',
          entityId: userId,
          description: 'Failed password change - invalid current password',
          ipAddress,
          userAgent,
          success: false,
          errorMessage: 'Invalid current password',
        });
        throw new Error('Invalid current password');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      // Revoke all tokens on password change
      await prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      });

      await this.createAuditLog({
        userId,
        action: 'UPDATE',
        entityType: 'user',
        entityId: userId,
        description: 'Password changed successfully',
        ipAddress,
        userAgent,
        success: true,
      });

      logger.info(`Password changed for user: ${userId}`);
    } catch (error) {
      logger.error('Error changing password:', error);
      throw error;
    }
  }

  async getUserById(userId: string): Promise<Omit<User, 'password'> | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          patient: true,
          surgeon: true,
          moderator: true,
        },
      }) as User | null;

      if (!user) {
        return null;
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      logger.error('Error getting user:', error);
      throw error;
    }
  }

  async cleanupExpiredTokens(): Promise<void> {
    try {
      // Clean up refresh tokens
      const refreshResult = await prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { isRevoked: true, updatedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          ],
        },
      });

      // Clean up blacklisted tokens
      const blacklistResult = await prisma.blacklistedToken.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      if (refreshResult.count > 0 || blacklistResult.count > 0) {
        logger.info(`Cleaned up ${refreshResult.count} refresh tokens and ${blacklistResult.count} blacklisted tokens`);
      }
    } catch (error) {
      logger.error('Error cleaning up expired tokens:', error);
    }
  }
}

export const authService = new AuthService();
