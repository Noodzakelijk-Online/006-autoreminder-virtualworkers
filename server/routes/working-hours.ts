import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../db';
import { userWorkingHours } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Get user's working hours settings
router.get('/working-hours/settings', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const settings = await db.select().from(userWorkingHours)
      .where(eq(userWorkingHours.userOpenId, user.openId))
      .limit(1);

    if (settings.length === 0) {
      // Return default settings if none exist
      return res.json({
        workStartHour: 9,
        workStartMinute: 0,
        workEndHour: 18,
        workEndMinute: 0,
        breakfastTime: '09:00',
        breakfastDuration: 45,
        lunchTime: '15:00',
        lunchDuration: 45,
        dinnerTime: '20:00',
        dinnerDuration: 120,
        enableBreaks: true,
        shortBreakInterval: 120,
        shortBreakDuration: 10,
        longBreakInterval: 240,
        longBreakDuration: 30,
        workingDays: '1,2,3,4,5',
        timezone: 'UTC',
        country: 'US',
      });
    }

    res.json(settings[0]);
  } catch (error) {
    console.error('Error fetching working hours:', error);
    res.status(500).json({ error: 'Failed to fetch working hours' });
  }
});

// Save user's working hours settings
router.post('/working-hours/settings', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const {
      workStartHour,
      workStartMinute,
      workEndHour,
      workEndMinute,
      breakfastTime,
      breakfastDuration,
      lunchTime,
      lunchDuration,
      dinnerTime,
      dinnerDuration,
      enableBreaks,
      shortBreakInterval,
      shortBreakDuration,
      longBreakInterval,
      longBreakDuration,
      workingDays,
      timezone,
      country,
    } = req.body;

    // Check if settings exist
    const existing = await db.select().from(userWorkingHours)
      .where(eq(userWorkingHours.userOpenId, user.openId))
      .limit(1);

    if (existing.length === 0) {
      // Insert new settings
      await db.insert(userWorkingHours).values({
        userId: user.id,
        userOpenId: user.openId,
        workStartHour,
        workStartMinute,
        workEndHour,
        workEndMinute,
        breakfastTime,
        breakfastDuration,
        lunchTime,
        lunchDuration,
        dinnerTime,
        dinnerDuration,
        enableBreaks: enableBreaks ? 1 : 0,
        shortBreakInterval,
        shortBreakDuration,
        longBreakInterval,
        longBreakDuration,
        workingDays: workingDays || '1,2,3,4,5',
        timezone: timezone || 'UTC',
        country: country || 'US',
      });
    } else {
      // Update existing settings
      await db.update(userWorkingHours)
        .set({
          workStartHour,
          workStartMinute,
          workEndHour,
          workEndMinute,
          breakfastTime,
          breakfastDuration,
          lunchTime,
          lunchDuration,
          dinnerTime,
          dinnerDuration,
          enableBreaks: enableBreaks ? 1 : 0,
          shortBreakInterval,
          shortBreakDuration,
          longBreakInterval,
          longBreakDuration,
          workingDays: workingDays || '1,2,3,4,5',
          timezone: timezone || 'UTC',
          country: country || 'US',
        })
        .where(eq(userWorkingHours.userOpenId, user.openId));
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving working hours:', error);
    res.status(500).json({ error: 'Failed to save working hours' });
  }
});

export default router;
