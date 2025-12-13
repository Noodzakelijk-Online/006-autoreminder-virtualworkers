import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

/**
 * POST /api/reschedule/preview
 * Preview the impact of rescheduling with new settings
 */
router.post('/preview', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { workStartHour, workEndHour, workingDays } = req.body;

    // Calculate impact
    // For now, return a simple preview
    // In a real implementation, this would fetch current tasks and calculate changes
    
    res.json({
      success: true,
      preview: {
        totalTasks: 0, // Would be calculated from actual tasks
        affectedTasks: 0,
        newSchedule: {
          workStartHour,
          workEndHour,
          workingDays,
        },
        message: 'Tasks will be rescheduled based on new working hours and days',
      },
    });
  } catch (error) {
    console.error('Error generating reschedule preview:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

/**
 * POST /api/reschedule/apply
 * Apply bulk rescheduling
 * This triggers a re-fetch of tasks which will automatically use new settings
 */
router.post('/apply', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // The actual rescheduling happens automatically when tasks are fetched
    // because the scheduling algorithm uses the user's current settings
    // This endpoint just confirms the action and can trigger any cleanup if needed

    res.json({
      success: true,
      message: 'Settings updated. Tasks will be rescheduled on next refresh.',
    });
  } catch (error) {
    console.error('Error applying reschedule:', error);
    res.status(500).json({ error: 'Failed to apply rescheduling' });
  }
});

export default router;
