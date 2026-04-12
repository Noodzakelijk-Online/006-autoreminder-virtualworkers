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

    // Re-fetch from DB so records include auto-generated IDs
    const savedHolidays = await db.select()
      .from(holidays)
      .where(and(
        eq(holidays.userOpenId, user.openId),
        eq(holidays.country, country)
      ))
      .orderBy(holidays.date);

    res.json({
      success: true,
      count: savedHolidays.length,
      holidays: savedHolidays
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
    console.log('[Holidays] by-timezone endpoint called with params:', req.params);
    console.log('[Holidays] User:', req.user ? 'authenticated' : 'not authenticated');
    
    const user = req.user;
    if (!user) {
      console.log('[Holidays] Unauthorized access attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let { timezone, year } = req.params;
    // Decode URL-encoded timezone (e.g., Asia%2FKarachi -> Asia/Karachi)
    timezone = decodeURIComponent(timezone);
    
    // Map timezone to country code
    const timezoneToCountryMap: { [key: string]: string } = {
      // Americas
      'America/New_York': 'US',
      'America/Chicago': 'US',
      'America/Denver': 'US',
      'America/Phoenix': 'US',
      'America/Los_Angeles': 'US',
      'America/Anchorage': 'US',
      'Pacific/Honolulu': 'US',
      'America/Toronto': 'CA',
      'America/Vancouver': 'CA',
      'America/Mexico_City': 'MX',
      'America/Bogota': 'CO',
      'America/Lima': 'PE',
      'America/Santiago': 'CL',
      'America/Sao_Paulo': 'BR',
      'America/Argentina/Buenos_Aires': 'AR',
      'America/Buenos_Aires': 'AR',
      'America/Caracas': 'VE',
      // Europe
      'Europe/London': 'GB',
      'Europe/Dublin': 'IE',
      'Europe/Lisbon': 'PT',
      'Europe/Amsterdam': 'NL',
      'Europe/Berlin': 'DE',
      'Europe/Paris': 'FR',
      'Europe/Madrid': 'ES',
      'Europe/Rome': 'IT',
      'Europe/Brussels': 'BE',
      'Europe/Zurich': 'CH',
      'Europe/Stockholm': 'SE',
      'Europe/Oslo': 'NO',
      'Europe/Copenhagen': 'DK',
      'Europe/Helsinki': 'FI',
      'Europe/Warsaw': 'PL',
      'Europe/Prague': 'CZ',
      'Europe/Vienna': 'AT',
      'Europe/Budapest': 'HU',
      'Europe/Bucharest': 'RO',
      'Europe/Athens': 'GR',
      'Europe/Kiev': 'UA',
      'Europe/Moscow': 'RU',
      'Europe/Istanbul': 'TR',
      // Africa
      'Africa/Cairo': 'EG',
      'Africa/Johannesburg': 'ZA',
      'Africa/Lagos': 'NG',
      'Africa/Nairobi': 'KE',
      'Africa/Casablanca': 'MA',
      'Africa/Accra': 'GH',
      // Middle East
      'Asia/Dubai': 'AE',
      'Asia/Riyadh': 'SA',
      'Asia/Kuwait': 'KW',
      'Asia/Qatar': 'QA',
      'Asia/Bahrain': 'BH',
      'Asia/Tehran': 'IR',
      'Asia/Jerusalem': 'IL',
      'Asia/Beirut': 'LB',
      // Asia
      'Asia/Karachi': 'PK',
      'Asia/Kolkata': 'IN',
      'Asia/Colombo': 'LK',
      'Asia/Dhaka': 'BD',
      'Asia/Kathmandu': 'NP',
      'Asia/Yangon': 'MM',
      'Asia/Bangkok': 'TH',
      'Asia/Jakarta': 'ID',
      'Asia/Makassar': 'ID',
      'Asia/Jayapura': 'ID',
      'Asia/Ho_Chi_Minh': 'VN',
      'Asia/Phnom_Penh': 'KH',
      'Asia/Kuala_Lumpur': 'MY',
      'Asia/Singapore': 'SG',
      'Asia/Manila': 'PH',
      'Asia/Shanghai': 'CN',
      'Asia/Hong_Kong': 'HK',
      'Asia/Taipei': 'TW',
      'Asia/Seoul': 'KR',
      'Asia/Tokyo': 'JP',
      'Asia/Almaty': 'KZ',
      'Asia/Tashkent': 'UZ',
      // Pacific & Oceania
      'Australia/Perth': 'AU',
      'Australia/Darwin': 'AU',
      'Australia/Adelaide': 'AU',
      'Australia/Brisbane': 'AU',
      'Australia/Sydney': 'AU',
      'Australia/Melbourne': 'AU',
      'Pacific/Auckland': 'NZ',
      'Pacific/Fiji': 'FJ',
      'Pacific/Guam': 'GU',
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
    console.log('[Holidays] Fetching from API for year:', year, 'country:', countryCode);
    const response = await fetch(`${HOLIDAY_API_BASE}/PublicHolidays/${year}/${countryCode}`);
    
    console.log('[Holidays] API response status:', response.status);
    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: 'No holidays found for this timezone' });
      }
      throw new Error(`Holiday API error: ${response.statusText}`);
    }

    const responseText = await response.text();
    console.log('[Holidays] API response text length:', responseText.length);
    
    if (!responseText) {
      console.log('[Holidays] Empty response from API');
      return res.json({ success: true, count: 0, holidays: [] });
    }
    
    let holidaysData;
    try {
      holidaysData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Holidays] Failed to parse API response:', parseError);
      console.error('[Holidays] Response text:', responseText.substring(0, 200));
      return res.status(500).json({ error: 'Failed to parse holiday data from API' });
    }
    
    // Handle empty response from API
    if (!Array.isArray(holidaysData) || holidaysData.length === 0) {
      console.log('[Holidays] API returned empty or non-array response for country:', countryCode);
      return res.json({ 
        success: true, 
        count: 0, 
        countryCode: countryCode,
        timezone: timezone,
        holidays: [],
        message: 'No holidays available for this country in the API'
      });
    }
    
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

    // Re-fetch from DB so records include auto-generated IDs
    console.log('[Holidays] Fetching saved holidays from DB for user:', user.openId, 'country:', countryCode);
    try {
      const savedHolidays = await db.select()
        .from(holidays)
        .where(and(
          eq(holidays.userOpenId, user.openId),
          eq(holidays.country, countryCode)
        ))
        .orderBy(holidays.date);
      console.log('[Holidays] Successfully fetched', savedHolidays.length, 'holidays from DB');

      return res.json({
        success: true,
        count: savedHolidays.length,
        countryCode: countryCode,
        timezone: timezone,
        holidays: savedHolidays
      });
    } catch (dbError: any) {
      console.error('[Holidays] Database query error:', dbError?.message);
      throw dbError;
    }
  } catch (error: any) {
    console.error('[Holidays] Error fetching holidays by timezone:', error);
    console.error('[Holidays] Error stack:', error?.stack);
    return res.status(500).json({ error: error?.message || 'Failed to fetch holidays' });
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
