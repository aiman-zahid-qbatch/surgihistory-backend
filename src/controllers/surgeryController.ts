import { Request, Response, NextFunction } from 'express';
import surgeryService from '../services/surgeryService';
import { logger } from '../config/logger';
import { AuthRequest } from '../middlewares/auth';

export class SurgeryController {
  async createSurgery(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const surgery = await surgeryService.createSurgery(req.body, req.user.id);
      res.status(201).json({
        success: true,
        data: surgery,
      });
    } catch (error) {
      logger.error('Error in createSurgery controller:', error);
      next(error);
    }
  }

  async getSurgery(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const surgery = await surgeryService.getSurgeryById(id);

      if (!surgery) {
        res.status(404).json({
          success: false,
          message: 'Surgery not found',
        });
        return;
      }

      res.json({
        success: true,
        data: surgery,
      });
    } catch (error) {
      logger.error('Error in getSurgery controller:', error);
      next(error);
    }
  }

  async getSurgeriesByPatient(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { patientId } = req.params;
      const surgeries = await surgeryService.getSurgeriesByPatient(patientId);

      res.json({
        success: true,
        data: surgeries,
      });
    } catch (error) {
      logger.error('Error in getSurgeriesByPatient controller:', error);
      next(error);
    }
  }

  async getSurgeriesByDoctor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { doctorId } = req.params;
      const surgeries = await surgeryService.getSurgeriesByDoctor(doctorId);

      res.json({
        success: true,
        data: surgeries,
      });
    } catch (error) {
      logger.error('Error in getSurgeriesByDoctor controller:', error);
      next(error);
    }
  }

  async updateSurgery(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const surgery = await surgeryService.updateSurgery(id, req.body);

      res.json({
        success: true,
        data: surgery,
      });
    } catch (error) {
      logger.error('Error in updateSurgery controller:', error);
      next(error);
    }
  }

  async archiveSurgery(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const surgery = await surgeryService.archiveSurgery(id);

      res.json({
        success: true,
        message: 'Surgery archived successfully',
        data: surgery,
      });
    } catch (error) {
      logger.error('Error in archiveSurgery controller:', error);
      next(error);
    }
  }

  async searchSurgeries(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q } = req.query;
      
      if (!q || typeof q !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Search query is required',
        });
        return;
      }

      const surgeries = await surgeryService.searchSurgeries(q);
      res.json({
        success: true,
        data: surgeries,
      });
    } catch (error) {
      logger.error('Error in searchSurgeries controller:', error);
      next(error);
    }
  }
}

export default new SurgeryController();
