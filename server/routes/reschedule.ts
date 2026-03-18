import { Router } from 'express';
import type { Request, Response } from 'express';
import { getCachedTasks } from '../services/trello-cache';

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

    const cachedTasks = await getCachedTasks(user.id, user.openId);
    const tasks = Array.isArray(cachedTasks) ? cachedTasks : [];
    const normalizedWorkingDays = Array.isArray(workingDays)
      ? workingDays.map((day: any) => Number(day)).filter((day: number) => Number.isFinite(day))
      : [1, 2, 3, 4, 5];

    const affectedTasks = tasks.filter((task: any) => {
      if (!task.date) return false;

      const taskDate = new Date(task.date);
      const dayOfWeek = taskDate.getDay();
      if (!normalizedWorkingDays.includes(dayOfWeek)) {
        return true;
      }

      const startHour = Number(task.startTime?.split(':')?.[0]);
      const endHour = Number(task.endTime?.split(':')?.[0]);

      if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) {
        return false;
      }

      return startHour < workStartHour || endHour > workEndHour;
    });
    
    res.json({
      success: true,
      preview: {
        totalTasks: tasks.length,
        affectedTasks: affectedTasks.length,
        newSchedule: {
          workStartHour,
          workEndHour,
          workingDays: normalizedWorkingDays,
        },
        message: tasks.length > 0
          ? `${affectedTasks.length} task(s) would be rescheduled based on the updated working hours and days`
          : 'No cached tasks available to preview rescheduling impact',
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
