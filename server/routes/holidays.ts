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
 * GET /api/holidays
 * Get user's active holidays (main endpoint for calendar)
 */
router.get('/', async (req: any, res: Response) => {
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
      .where(and(
        eq(holidays.userOpenId, user.openId),
        eq(holidays.isActive, 1)
      ))
      .orderBy(holidays.date);

    res.json(userHolidays);
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

/**
 * GET /api/holidays/workers
 * Get all workers with their timezone for the current user
 */
router.get('/workers', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const { vaProfiles } = await import('../../drizzle/schema');
    
    // Get all workers (VA profiles) for this founder
    const workers = await db.select({
      id: vaProfiles.id,
      name: vaProfiles.name,
      timezone: vaProfiles.timezone,
      email: vaProfiles.email,
    })
      .from(vaProfiles)
      .where(eq(vaProfiles.founderId, user.id));

    res.json(workers);
  } catch (error) {
    console.error('Error fetching workers:', error);
    res.status(500).json({ error: 'Failed to fetch workers' });
  }
});

/**
 * GET /api/holidays/by-timezone/:timezone/:year
 * Fetch holidays by timezone (converts timezone to country code)
 */
router.get('/by-timezone/:timezone/:year', async (req: any, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { timezone, year } = req.params;
    
    // Map timezone to country code
    const timezoneToCountryMap: { [key: string]: string } = {
      'America/New_York': 'US',
      'America/Chicago': 'US',
      'America/Denver': 'US',
      'America/Los_Angeles': 'US',
      'America/Anchorage': 'US',
      'Pacific/Honolulu': 'US',
      'Europe/London': 'GB',
      'Europe/Paris': 'FR',
      'Europe/Berlin': 'DE',
      'Europe/Amsterdam': 'NL',
      'Europe/Madrid': 'ES',
      'Europe/Rome': 'IT',
      'Europe/Vienna': 'AT',
      'Europe/Brussels': 'BE',
      'Europe/Prague': 'CZ',
      'Europe/Warsaw': 'PL',
      'Europe/Moscow': 'RU',
      'Asia/Tokyo': 'JP',
      'Asia/Shanghai': 'CN',
      'Asia/Hong_Kong': 'HK',
      'Asia/Singapore': 'SG',
      'Asia/Bangkok': 'TH',
      'Asia/Manila': 'PH',
      'Asia/Jakarta': 'ID',
      'Asia/Kolkata': 'IN',
      'Asia/Dubai': 'AE',
      'Australia/Sydney': 'AU',
      'Australia/Melbourne': 'AU',
      'Pacific/Auckland': 'NZ',
      'America/Toronto': 'CA',
      'America/Vancouver': 'CA',
      'America/Mexico_City': 'MX',
      'America/Sao_Paulo': 'BR',
      'America/Buenos_Aires': 'AR',
      'Africa/Cairo': 'EG',
      'Africa/Johannesburg': 'ZA',
      'Africa/Lagos': 'NG',
    };

    const countryCode = timezoneToCountryMap[timezone];
    if (!countryCode) {
      return res.status(400).json({ error: 'Timezone not supported or country mapping not found' });
    }

    // Validate year
    const yearNum = parseInt(year);
    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2030) {
      return res.status(400).json({ error: 'Invalid year' });
    }

    // Fetch holidays from Nager.Date API
    const response = await fetch(`${HOLIDAY_API_BASE}/PublicHolidays/${year}/${countryCode}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: 'No holidays found for this timezone' });
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
        eq(holidays.country, countryCode)
      ));

    // Insert new holidays
    const holidayRecords = holidaysData.map((h: any) => ({
      userId: user.id,
      userOpenId: user.openId,
      date: h.date,
      name: h.localName || h.name,
      country: countryCode,
      isActive: 1,
    }));

    if (holidayRecords.length > 0) {
      await db.insert(holidays).values(holidayRecords);
    }

    return res.json({
      success: true,
      count: holidayRecords.length,
      countryCode: countryCode,
      timezone: timezone,
      holidays: holidayRecords
    });
  } catch (error) {
    console.error('Error fetching holidays by timezone:', error);
    return res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});

/**
 * GET /api/holidays/list/:country
 * Get user's stored holidays for a specific country
 */
router.get('/list/:country', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { country } = req.params;

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const userHolidays = await db.select()
      .from(holidays)
      .where(and(
        eq(holidays.userOpenId, user.openId),
        eq(holidays.country, country)
      ))
      .orderBy(holidays.date);

    res.json(userHolidays);
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});
