import { Request, Response, NextFunction } from 'express';
import patientService from '../services/patientService';
import { logger } from '../config/logger';

export class PatientController {
  async createPatient(req: Request, res: Response, next: NextFunction) {
    try {
      const patient = await patientService.createPatient(req.body);
      res.status(201).json({
        success: true,
        data: patient,
      });
    } catch (error) {
      logger.error('Error in createPatient controller:', error);
      next(error);
    }
  }

  async getPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const patient = await patientService.getPatientById(id);

      if (!patient) {
        res.status(404).json({
          success: false,
          message: 'Patient not found',
        });
        return;
      }

      res.json({
        success: true,
        data: patient,
      });
    } catch (error) {
      logger.error('Error in getPatient controller:', error);
      next(error);
    }
  }

  async getAllPatients(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patients = await patientService.getAllPatients();
      res.json({
        success: true,
        data: patients,
      });
    } catch (error) {
      logger.error('Error in getAllPatients controller:', error);
      next(error);
    }
  }

  async updatePatient(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const patient = await patientService.updatePatient(id, req.body);

      res.json({
        success: true,
        data: patient,
      });
    } catch (error) {
      logger.error('Error in updatePatient controller:', error);
      next(error);
    }
  }

  async archivePatient(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const patient = await patientService.archivePatient(id);

      res.json({
        success: true,
        message: 'Patient archived successfully',
        data: patient,
      });
    } catch (error) {
      logger.error('Error in archivePatient controller:', error);
      next(error);
    }
  }

  async searchPatients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q } = req.query;
      
      if (!q || typeof q !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Search query is required',
        });
        return;
      }

      const patients = await patientService.searchPatients(q);
      res.json({
        success: true,
        data: patients,
      });
    } catch (error) {
      logger.error('Error in searchPatients controller:', error);
      next(error);
    }
  }
}

export default new PatientController();
