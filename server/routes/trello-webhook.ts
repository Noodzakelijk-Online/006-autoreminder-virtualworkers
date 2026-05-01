import { Router, Response } from 'express';
import { getDb } from '../db';
import { chatbotWebhooks, chatbotConversations } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

const router = Router();

const TRELLO_API_BASE = 'https://api.trello.com/1';

/**
 * Normalise a raw Trello API webhook object into the same shape as our DB row.
 * Fix #7: the /list endpoint was returning raw Trello objects (idModel, active)
 * when the Trello API succeeded, but DB rows (modelId, isActive) on fallback.
 * The frontend Webhook interface only matches the DB shape, so the Trello-API
 * path was silently broken. We now always return a consistent shape.
 */
function normaliseTrelloWebhook(raw: any) {
  return {
    // Use the Trello webhook ID as both id and trelloWebhookId so the
    // frontend delete handler (which uses trelloWebhookId) always works.
    id: raw.id,
    trelloWebhookId: raw.id,
    modelId: raw.idModel ?? raw.modelId,
    description: raw.description ?? null,
    isActive: raw.active !== undefined ? (raw.active ? 1 : 0) : raw.isActive,
    callbackUrl: raw.callbackURL ?? raw.callbackUrl ?? null,
    createdAt: raw.createdAt ?? null,
  };
}

/**
 * GET /api/trello-webhook
 * Health check / Trello validation endpoint — must NOT require auth so Trello
 * can reach it during webhook registration.
 */
router.get('/', (_req: any, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Webhook endpoint is ready' });
});

/**
 * POST /api/trello-webhook/register
 * Register a webhook for a Trello board/workspace.
 * Fix #3 (duplicate detection): checks DB before calling Trello.
 */
router.post('/register', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { modelId, description: rawDescription } = req.body;

    if (!modelId) {
      return res.status(400).json({ error: 'Missing modelId' });
    }

    if (typeof modelId !== 'string' || modelId.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid modelId. Must be a non-empty string.' });
    }

    const cleanModelId = modelId.trim();

    if (cleanModelId.length < 8 || cleanModelId.length > 32) {
      return res.status(400).json({
        error: 'Invalid modelId length. Trello board IDs are typically 24-32 characters.',
      });
    }

    if (!/^[a-zA-Z0-9]+$/.test(cleanModelId)) {
      return res.status(400).json({
        error: 'Invalid modelId format. Only alphanumeric characters allowed.',
      });
    }

    const apiKey = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;

    if (!apiKey || !token) {
      return res.status(500).json({ error: 'Trello credentials not configured' });
    }

    // Fix #4 — build callbackUrl server-side, never from client body
    // Priority: WEBHOOK_BASE_URL → PUBLIC_URL → APP_URL
    const base =
      process.env.WEBHOOK_BASE_URL ||
      process.env.PUBLIC_URL ||
      process.env.APP_URL ||
      '';

    if (!base || base.startsWith('/')) {
      return res.status(500).json({
        error:
          'Server is not configured with a public URL. Set WEBHOOK_BASE_URL (e.g. https://your-domain.com) in your environment variables so Trello can reach the webhook callback.',
      });
    }

    const callbackUrl = `${base}/api/trello-webhook`;

    // Fix #3 — duplicate detection: check DB before calling Trello
    const db = await getDb();
    if (db) {
      const existing = await db.query.chatbotWebhooks.findFirst({
        where: eq(chatbotWebhooks.modelId, cleanModelId),
      });
      if (existing) {
        return res.status(409).json({
          error: 'A webhook for this board is already registered. Delete it first to re-register.',
        });
      }
    }

    console.log('[TrelloWebhook] Registering webhook for modelId:', cleanModelId);

    const description = rawDescription || `VA Dashboard Webhook for ${cleanModelId}`;

    const response = await fetch(`${TRELLO_API_BASE}/webhooks?key=${apiKey}&token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idModel: cleanModelId,
        callbackURL: callbackUrl,
        description,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[TrelloWebhook] Trello API error:', error);

      let userMessage = 'Failed to register webhook with Trello';
      if (error.includes('invalid value for idModel')) {
        userMessage = `Board ID "${cleanModelId}" is invalid or not found. Verify the ID from your Trello board URL (trello.com/b/BOARD_ID/name) and that you have admin access.`;
      } else if (error.includes('invalid token') || error.includes('unauthorized')) {
        userMessage = 'Trello authentication failed. Check your TRELLO_API_KEY and TRELLO_TOKEN.';
      } else if (error.includes('already exists')) {
        userMessage = 'A webhook for this board already exists on Trello. Delete the existing webhook first.';
      } else if (error.includes('model not found')) {
        userMessage = `Board "${cleanModelId}" not found. Please verify the board ID is correct.`;
      }

      return res.status(response.status).json({ error: userMessage });
    }

    const webhookData = await response.json();

    if (db) {
      await db
        .insert(chatbotWebhooks)
        .values({
          trelloWebhookId: webhookData.id,
          modelId: cleanModelId,
          description,
          callbackUrl,
          isActive: 1,
        })
        .catch((err: any) => console.error('[TrelloWebhook] DB insert error:', err));
    }

    console.log('[TrelloWebhook] Webhook registered successfully:', webhookData.id);
    res.json({ success: true, webhookId: webhookData.id });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error registering webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/trello-webhook/list
 * List all registered webhooks.
 *
 * Fix #7: always returns a consistent shape regardless of data source.
 * The Trello API and DB previously returned different field names
 * (idModel vs modelId, active vs isActive) which broke the frontend.
 * Now both paths are normalised through normaliseTrelloWebhook().
 */
router.get('/list', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const apiKey = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;

    // Try Trello API first (source of truth for active state)
    if (apiKey && token) {
      try {
        const response = await fetch(
          `${TRELLO_API_BASE}/tokens/${token}/webhooks?key=${apiKey}`
        );
        if (response.ok) {
          const raw = await response.json();
          // Filter to only webhooks pointing at our callback URL so we don't
          // show unrelated webhooks registered under the same token.
          const baseUrl = process.env.PUBLIC_URL || process.env.WEBHOOK_BASE_URL;
          const ourBase = baseUrl
            ? `${baseUrl}/api/trello-webhook`
            : null;
          const filtered = ourBase
            ? raw.filter((w: any) => (w.callbackURL ?? '').startsWith(ourBase))
            : raw;
          const webhooks = filtered.map(normaliseTrelloWebhook);
          console.log('[TrelloWebhook] Fetched webhooks from Trello API');
          return res.json({ webhooks });
        }
      } catch (err: any) {
        console.error('[TrelloWebhook] Trello API error, falling back to DB:', err);
      }
    }

    // Fallback to database
    const db = await getDb();
    if (db) {
      const rows = await db.query.chatbotWebhooks.findMany();
      const webhooks = rows.map(normaliseTrelloWebhook);
      console.log('[TrelloWebhook] Fetched webhooks from database');
      return res.json({ webhooks });
    }

    res.json({ webhooks: [] });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error listing webhooks:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/trello-webhook/:webhookId
 * Delete a webhook from both Trello and the local DB.
 */
router.delete('/:webhookId', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { webhookId } = req.params;
    const apiKey = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;

    if (apiKey && token) {
      try {
        const response = await fetch(
          `${TRELLO_API_BASE}/webhooks/${webhookId}?key=${apiKey}&token=${token}`,
          { method: 'DELETE' }
        );
        if (response.ok) {
          console.log('[TrelloWebhook] Deleted webhook from Trello API');
        } else {
          console.error('[TrelloWebhook] Error deleting from Trello:', response.status);
        }
      } catch (err: any) {
        console.error('[TrelloWebhook] Error deleting from Trello:', err);
      }
    }

    const db = await getDb();
    if (db) {
      await db.delete(chatbotWebhooks).where(eq(chatbotWebhooks.trelloWebhookId, webhookId));
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error deleting webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trello-webhook
 * Webhook callback from Trello — no auth required (called by Trello's servers).
 *
 * Fix #8: was inserting into wrong/non-existent columns (trelloCardId,
 * trelloAction, conversationData). The actual schema columns are cardTrelloId,
 * boardTrelloId, command, and responseStatus (NOT NULL). Fixed to match schema.
 */
router.post('/', async (req: any, res: Response) => {
  try {
    const action = req.body;
    const actionType: string = action?.type ?? 'unknown';

    console.log('[TrelloWebhook] Received callback:', actionType);

    const db = await getDb();
    if (db) {
      await db
        .insert(chatbotConversations)
        .values({
          cardTrelloId: action?.data?.card?.id ?? 'unknown',   // Fix #8 — correct column name
          cardName: action?.data?.card?.name ?? null,
          boardTrelloId: action?.data?.board?.id ?? null,
          command: actionType,                                  // Fix #8 — required NOT NULL column
          commandArgs: JSON.stringify(action?.data ?? {}),
          authorTrelloId: action?.memberCreator?.id ?? null,
          authorName: action?.memberCreator?.fullName ?? null,
          responseStatus: 'pending',                           // Fix #8 — required NOT NULL column
        })
        .catch((err: any) =>
          console.error('[TrelloWebhook] Error storing conversation:', err)
        );
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error processing callback:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/trello-webhook/status
 * Get webhook configuration status.
 *
 * Fix #6: isReachable was always hardcoded to true. Now actually probes the
 * callback URL with a HEAD request to verify it's reachable.
 */
router.get('/status', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const baseUrl = process.env.PUBLIC_URL || process.env.WEBHOOK_BASE_URL || '';
    const callbackUrl = `${baseUrl}/api/trello-webhook`;
    const isConfigured = !!process.env.TRELLO_API_KEY && !!process.env.TRELLO_TOKEN;

    // Fix #6 — actually probe the endpoint instead of hardcoding true
    let isReachable = false;
    let recommendation = '';

    if (!baseUrl) {
      recommendation = 'Set PUBLIC_URL or WEBHOOK_BASE_URL in your environment to a publicly reachable URL.';
    } else {
      try {
        const probe = await fetch(callbackUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        isReachable = probe.ok || probe.status === 405; // 405 = endpoint exists but HEAD not allowed
        recommendation = isReachable
          ? 'Webhook endpoint is reachable and properly configured.'
          : `Endpoint returned ${probe.status}. Ensure the server is publicly accessible.`;
      } catch {
        recommendation = 'Webhook endpoint is not reachable. Ensure PUBLIC_URL or WEBHOOK_BASE_URL points to a public URL.';
      }
    }

    if (!isConfigured) {
      recommendation = 'Trello API credentials (TRELLO_API_KEY / TRELLO_TOKEN) are not set.';
    }

    res.json({
      status: {
        callbackUrl,
        publicUrl: callbackUrl,
        isConfigured,
        isReachable,
        recommendation,
      },
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error getting webhook status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trello-webhook/conversation-counts
 * Get conversation counts for a batch of card IDs.
 * Returns { counts: { [cardId]: number } }
 */
router.post('/conversation-counts', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { cardIds } = req.body;
    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      return res.json({ counts: {} });
    }

    const db = await getDb();
    if (!db) {
      // Return zeros gracefully — no DB means no conversations yet
      const counts: Record<string, number> = {};
      cardIds.forEach((id: string) => { counts[id] = 0; });
      return res.json({ counts });
    }

    // Count conversations per card from chatbot_conversations table
    const { chatbotConversations } = await import('../../drizzle/schema');
    const { inArray, sql: drizzleSql } = await import('drizzle-orm');

    const rows = await db
      .select({
        cardTrelloId: chatbotConversations.cardTrelloId,
        count: drizzleSql<number>`count(*)`,
      })
      .from(chatbotConversations)
      .where(inArray(chatbotConversations.cardTrelloId, cardIds))
      .groupBy(chatbotConversations.cardTrelloId);

    const counts: Record<string, number> = {};
    cardIds.forEach((id: string) => { counts[id] = 0; });
    rows.forEach((row: any) => { counts[row.cardTrelloId] = Number(row.count); });

    res.json({ counts });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error getting conversation counts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/chatbot/analytics
 * Get chatbot analytics.
 */
router.get('/analytics', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    res.json({
      totalConversations: 0,
      totalCommands: {},
      avgResponseTimeMs: 0,
      totalCheckins: 0,
      totalResponses: 0,
      overallResponseRate: 0,
      avgCheckinResponseMinutes: 0,
      activeWorkers: 0,
      activeCards: 0,
      topCommands: [],
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error getting chatbot analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
