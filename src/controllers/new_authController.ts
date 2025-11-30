import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { AuthRequest } from '../middlewares/auth';

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, role } = req.body;
      
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const user = await authService.register(
        { email, password, role },
        ipAddress,
        userAgent
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...userWithoutPassword } = user;
      
      res.status(201).json({
        message: 'User registered successfully',
        user: userWithoutPassword,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.login(
        email,
        password,
        ipAddress,
        userAgent
      );

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      res.cookie('sessionId', result.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({
        message: 'Login successful',
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(401).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        res.status(401).json({ message: 'Refresh token required' });
        return;
      }

      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.refreshToken(
        refreshToken,
        ipAddress,
        userAgent
      );

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({
        message: 'Token refreshed successfully',
        accessToken: result.accessToken,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(401).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  }

  async logout(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user || !req.token) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }

      const sessionId = req.cookies.sessionId || req.body.sessionId;
      
      if (!sessionId) {
        res.status(400).json({ message: 'Session ID required' });
        return;
      }

      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      await authService.logout(
        req.user.id,
        req.token,
        sessionId,
        ipAddress,
        userAgent
      );

      res.clearCookie('refreshToken');
      res.clearCookie('sessionId');

      res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  }

  async changePassword(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }

      const { currentPassword, newPassword } = req.body;
      
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      await authService.changePassword(
        req.user.id,
        currentPassword,
        newPassword,
        ipAddress,
        userAgent
      );

      res.clearCookie('refreshToken');
      res.clearCookie('sessionId');

      res.status(200).json({ 
        message: 'Password changed successfully. Please login again.' 
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  }

  async getCurrentUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }

      const user = await authService.getUserById(req.user.id);

      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      res.status(200).json({ user });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  }
}

export const authController = new AuthController();
