import { Router } from 'express';
import reminderController from '../controllers/reminderController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create a new reminder
router.post('/', reminderController.createReminder);

// Create multiple reminders for a follow-up
router.post('/follow-up', reminderController.createFollowUpReminders);

// Get current user's reminders
router.get('/my-reminders', reminderController.getMyReminders);

// Get reminders for a follow-up
router.get('/follow-up/:followUpId', reminderController.getRemindersByFollowUp);

// Get reminder by ID
router.get('/:id', reminderController.getReminderById);

// Update reminder
router.put('/:id', reminderController.updateReminder);

// Cancel reminder
router.patch('/:id/cancel', reminderController.cancelReminder);

// Delete reminder
router.delete('/:id', reminderController.deleteReminder);

// Delete all reminders for a follow-up
router.delete('/follow-up/:followUpId', reminderController.deleteFollowUpReminders);

export default router;
