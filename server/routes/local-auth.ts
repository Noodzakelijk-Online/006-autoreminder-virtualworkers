/**
 * Local authentication routes — replaces Manus OAuth for local development.
 * Provides simple username/password login and registration.
 */
import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { COOKIE_NAME, ONE_YEAR_MS } from '@shared/const';
import { sdk } from '../_core/sdk';
import { getSessionCookieOptions } from '../_core/cookies';
import * as db from '../db';

const router = express.Router();

/**
 * POST /api/auth/register
 * Create a new local account.
 * Body: { username, password, name }
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    console.log('[LocalAuth] Register request received:', {
      body: req.body,
      hasUsername: !!req.body?.username,
      hasPassword: !!req.body?.password,
      hasName: !!req.body?.name,
    });

    const { username, password, name } = req.body as {
      username?: string;
      password?: string;
      name?: string;
    };

    if (!username || !password) {
      console.log('[LocalAuth] Validation failed: missing username or password');
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 6) {
      console.log('[LocalAuth] Validation failed: password too short');
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existing = await db.getUserByOpenId(username);
    if (existing) {
      console.log('[LocalAuth] User already exists:', username);
      return res.status(409).json({ error: 'Username already taken' });
    }

    console.log('[LocalAuth] Creating new user:', username);

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user — openId = username for local auth
    await db.upsertUser({
      openId: username,
      name: name || username,
      email: null,
      loginMethod: 'local',
      lastSignedIn: new Date(),
    });

    // Store password hash
    const dbInstance = await (await import('../db')).getDb();
    if (dbInstance) {
      const { users } = await import('../../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      await dbInstance
        .update(users)
        .set({ passwordHash })
        .where(eq(users.openId, username));
    }

    console.log('[LocalAuth] User created successfully, creating session');

    // Create session
    const sessionToken = await sdk.createSessionToken(username, {
      name: name || username,
      expiresInMs: ONE_YEAR_MS,
    });

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

    console.log('[LocalAuth] Registration complete');
    return res.json({ success: true, message: 'Account created successfully' });
  } catch (error) {
    console.error('[LocalAuth] Register error:', error);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Log in with username and password.
 * Body: { username, password }
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = await db.getUserByOpenId(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Verify password
    if (!user.passwordHash) {
      return res.status(401).json({ error: 'This account does not have a local password. Please use OAuth login.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Update last signed in
    await db.upsertUser({
      openId: username,
      lastSignedIn: new Date(),
    });

    // Create session
    const sessionToken = await sdk.createSessionToken(username, {
      name: user.name || username,
      expiresInMs: ONE_YEAR_MS,
    });

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

    return res.json({ success: true, message: 'Logged in successfully' });
  } catch (error) {
    console.error('[LocalAuth] Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
