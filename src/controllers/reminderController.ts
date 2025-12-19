import { Request, Response } from 'express';
import reminderService from '../services/reminderService';

import { logger } from '../config/logger';

export class ReminderController {
  /**
   * Create a new reminder
   */
  async createReminder(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const reminder = await reminderService.createReminder(req.body, userId);

      res.status(201).json({
        message: 'Reminder created successfully',
        data: reminder,
      });
    } catch (error) {
      logger.error('Error in createReminder:', error);
      res.status(500).json({ error: 'Failed to create reminder' });
    }
  }

  /**
   * Create multiple reminders for a follow-up
   */
  async createFollowUpReminders(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const {
        followUpId,
        followUpDate,
        patientId,
        patientName,
        patientPhone,
        patientWhatsapp,
        reminderDays,
        channels,
      } = req.body;

      // Validate required fields
      if (!followUpId || !followUpDate || !patientId || !patientName) {
        res.status(400).json({
          error: 'Missing required fields: followUpId, followUpDate, patientId, patientName',
        });
        return;
      }

      if (!reminderDays || !Array.isArray(reminderDays) || reminderDays.length === 0) {
        res.status(400).json({
          error: 'reminderDays must be a non-empty array',
        });
        return;
      }

      if (!channels || !Array.isArray(channels) || channels.length === 0) {
        res.status(400).json({
          error: 'channels must be a non-empty array',
        });
        return;
      }

      const reminders = await reminderService.createFollowUpReminders(
        followUpId,
        new Date(followUpDate),
        patientId,
        patientName,
        patientPhone,
        patientWhatsapp,
        reminderDays,
        channels,
        userId
      );

      res.status(201).json({
        message: `${reminders.length} reminders created successfully`,
        data: reminders,
      });
    } catch (error) {
      logger.error('Error in createFollowUpReminders:', error);
      res.status(500).json({ error: 'Failed to create follow-up reminders' });
    }
  }

  /**
   * Get reminder by ID
   */
  async getReminderById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const reminder = await reminderService.getReminderById(id);

      if (!reminder) {
        res.status(404).json({ error: 'Reminder not found' });
        return;
      }

      res.json({ data: reminder });
    } catch (error) {
      logger.error('Error in getReminderById:', error);
      res.status(500).json({ error: 'Failed to fetch reminder' });
    }
  }

  /**
   * Get reminders for a follow-up
   */
  async getRemindersByFollowUp(req: Request, res: Response): Promise<void> {
    try {
      const { followUpId } = req.params;

      const reminders = await reminderService.getRemindersByFollowUp(followUpId);

      res.json({ data: reminders });
    } catch (error) {
      logger.error('Error in getRemindersByFollowUp:', error);
      res.status(500).json({ error: 'Failed to fetch reminders' });
    }
  }

  /**
   * Get reminders for current user
   */
  async getMyReminders(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { status } = req.query;

      const reminders = await reminderService.getRemindersByRecipient(
        userId,
        status as string | undefined
      );

      res.json({ data: reminders });
    } catch (error) {
      logger.error('Error in getMyReminders:', error);
      res.status(500).json({ error: 'Failed to fetch reminders' });
    }
  }

  /**
   * Update reminder
   */
  async updateReminder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const reminder = await reminderService.updateReminder(id, req.body);

      res.json({
        message: 'Reminder updated successfully',
        data: reminder,
      });
    } catch (error) {
      logger.error('Error in updateReminder:', error);
      res.status(500).json({ error: 'Failed to update reminder' });
    }
  }

  /**
   * Cancel reminder
   */
  async cancelReminder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const reminder = await reminderService.cancelReminder(id);

      res.json({
        message: 'Reminder cancelled successfully',
        data: reminder,
      });
    } catch (error) {
      logger.error('Error in cancelReminder:', error);
      res.status(500).json({ error: 'Failed to cancel reminder' });
    }
  }

  /**
   * Delete reminder
   */
  async deleteReminder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await reminderService.deleteReminder(id);

      res.json({ message: 'Reminder deleted successfully' });
    } catch (error) {
      logger.error('Error in deleteReminder:', error);
      res.status(500).json({ error: 'Failed to delete reminder' });
    }
  }

  /**
   * Delete all reminders for a follow-up
   */
  async deleteFollowUpReminders(req: Request, res: Response): Promise<void> {
    try {
      const { followUpId } = req.params;

      const result = await reminderService.deleteFollowUpReminders(followUpId);

      res.json({
        message: 'Follow-up reminders deleted successfully',
        deletedCount: result.count,
      });
    } catch (error) {
      logger.error('Error in deleteFollowUpReminders:', error);
      res.status(500).json({ error: 'Failed to delete follow-up reminders' });
    }
  }
}

export default new ReminderController();
