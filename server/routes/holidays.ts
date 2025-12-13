import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../db';
import { holidays } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

// Nager.Date API - Free public holiday API (no auth required)
// Documentation: https://date.nager.at/Api
const HOLIDAY_API_BASE = 'https://date.nager.at/api/v3';

/**
 * GET /api/holidays/fetch/:country/:year
 * Fetch holidays from external API and store in database
 */
router.get('/fetch/:country/:year', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { country, year } = req.params;
    
    // Validate country code (ISO 3166-1 alpha-2)
    if (!/^[A-Z]{2}$/.test(country)) {
      return res.status(400).json({ error: 'Invalid country code' });
    }

    // Validate year
    const yearNum = parseInt(year);
    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2030) {
      return res.status(400).json({ error: 'Invalid year' });
    }

    // Fetch holidays from Nager.Date API
    const response = await fetch(`${HOLIDAY_API_BASE}/PublicHolidays/${year}/${country}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: 'No holidays found for this country' });
      }
      throw new Error(`Holiday API error: ${response.statusText}`);
    }

    const holidaysData = await response.json();
    
    // Store holidays in database
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    // Delete existing holidays for this user/country/year
    await db.delete(holidays)
      .where(and(
        eq(holidays.userOpenId, user.openId),
        eq(holidays.country, country)
      ));

    // Insert new holidays
    const holidayRecords = holidaysData.map((h: any) => ({
      userId: user.id,
      userOpenId: user.openId,
      date: h.date, // YYYY-MM-DD format
      name: h.localName || h.name,
      country: country,
      isActive: 1,
    }));

    if (holidayRecords.length > 0) {
      await db.insert(holidays).values(holidayRecords);
    }

    res.json({
      success: true,
      count: holidayRecords.length,
      holidays: holidayRecords
    });
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});

/**
 * GET /api/holidays/list
 * Get user's stored holidays
 */
router.get('/list', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const userHolidays = await db.select()
      .from(holidays)
      .where(eq(holidays.userOpenId, user.openId))
      .orderBy(holidays.date);

    res.json(userHolidays);
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});

/**
 * POST /api/holidays/toggle/:id
 * Toggle holiday active status
 */
router.post('/toggle/:id', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const holidayId = parseInt(req.params.id);
    if (isNaN(holidayId)) {
      return res.status(400).json({ error: 'Invalid holiday ID' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    // Get current holiday
    const [holiday] = await db.select()
      .from(holidays)
      .where(and(
        eq(holidays.id, holidayId),
        eq(holidays.userOpenId, user.openId)
      ))
      .limit(1);

    if (!holiday) {
      return res.status(404).json({ error: 'Holiday not found' });
    }

    // Toggle active status
    await db.update(holidays)
      .set({ isActive: holiday.isActive === 1 ? 0 : 1 })
      .where(eq(holidays.id, holidayId));

    res.json({ success: true, isActive: holiday.isActive === 1 ? 0 : 1 });
  } catch (error) {
    console.error('Error toggling holiday:', error);
    res.status(500).json({ error: 'Failed to toggle holiday' });
  }
});

/**
 * GET /api/holidays/countries
 * Get list of supported countries
 */
router.get('/countries', async (req: any, res: Response) => {
  try {
    // Fetch available countries from Nager.Date API
    const response = await fetch(`${HOLIDAY_API_BASE}/AvailableCountries`);
    
    if (!response.ok) {
      throw new Error(`Holiday API error: ${response.statusText}`);
    }

    const countries = await response.json();
    res.json(countries);
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

export default router;
