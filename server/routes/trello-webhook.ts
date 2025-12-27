/**
 * Trello Webhook Routes
 * 
 * Handles incoming webhooks from Trello for the chatbot functionality.
 * Trello webhooks require:
 * 1. A HEAD endpoint that returns 200 (for webhook verification)
 * 2. A POST endpoint that receives the webhook payload
 */

import { Router } from 'express';
import { handleTrelloWebhook, postTrelloComment, parseBotCommand, processBotCommand } from '../services/trello-chatbot';

const router = Router();

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;

/**
 * HEAD /api/trello-webhook
 * Trello sends a HEAD request to verify the webhook URL is valid
 */
router.head('/', (req, res) => {
  console.log('[TrelloWebhook] Received HEAD verification request');
  res.status(200).send();
});

/**
 * POST /api/trello-webhook
 * Receives webhook events from Trello
 */
router.post('/', async (req, res) => {
  try {
    const payload = req.body;
    
    // Log the webhook event type
    const actionType = payload?.action?.type;
    console.log(`[TrelloWebhook] Received webhook: ${actionType}`);
    
    // Process the webhook asynchronously (don't block the response)
    // Trello expects a quick 200 response
    res.status(200).send('OK');
    
    // Handle the webhook in the background
    await handleTrelloWebhook(payload);
  } catch (error) {
    console.error('[TrelloWebhook] Error processing webhook:', error);
    // Still return 200 to prevent Trello from retrying
    res.status(200).send('OK');
  }
});

/**
 * POST /api/trello-webhook/register
 * Register a webhook with Trello for a specific model (board, card, etc.)
 */
router.post('/register', async (req, res) => {
  try {
    const { modelId, description, callbackUrl } = req.body;
    
    if (!modelId || !callbackUrl) {
      return res.status(400).json({ 
        error: 'Missing required fields: modelId, callbackUrl' 
      });
    }

    const response = await fetch(
      `https://api.trello.com/1/webhooks?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idModel: modelId,
          callbackURL: callbackUrl,
          description: description || 'VA Dashboard Chatbot Webhook',
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TrelloWebhook] Failed to register webhook:', errorText);
      return res.status(response.status).json({ 
        error: 'Failed to register webhook', 
        details: errorText 
      });
    }

    const webhook = await response.json();
    console.log('[TrelloWebhook] Registered webhook:', webhook.id);
    
    res.json({ 
      success: true, 
      webhookId: webhook.id,
      webhook 
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error registering webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/trello-webhook/list
 * List all registered webhooks
 */
router.get('/list', async (req, res) => {
  try {
    const response = await fetch(
      `https://api.trello.com/1/tokens/${TRELLO_TOKEN}/webhooks?key=${TRELLO_API_KEY}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ 
        error: 'Failed to list webhooks', 
        details: errorText 
      });
    }

    const webhooks = await response.json();
    res.json({ webhooks });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error listing webhooks:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/trello-webhook/:webhookId
 * Delete a specific webhook
 */
router.delete('/:webhookId', async (req, res) => {
  try {
    const { webhookId } = req.params;

    const response = await fetch(
      `https://api.trello.com/1/webhooks/${webhookId}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ 
        error: 'Failed to delete webhook', 
        details: errorText 
      });
    }

    console.log('[TrelloWebhook] Deleted webhook:', webhookId);
    res.json({ success: true, webhookId });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error deleting webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trello-webhook/test
 * Test the chatbot by simulating a comment
 */
router.post('/test', async (req, res) => {
  try {
    const { cardId, comment, authorName } = req.body;
    
    if (!cardId || !comment) {
      return res.status(400).json({ 
        error: 'Missing required fields: cardId, comment' 
      });
    }

    // Parse the command
    const cmd = parseBotCommand(
      comment, 
      cardId, 
      'test-comment-id', 
      'test-author-id', 
      authorName || 'Test User'
    );

    if (!cmd) {
      return res.json({ 
        success: false, 
        message: 'No @bot command found in comment' 
      });
    }

    // Process the command
    const response = await processBotCommand(cmd);

    res.json({ 
      success: true, 
      command: cmd.command,
      args: cmd.args,
      response: response.text,
      mentions: response.mentions 
    });
  } catch (error: any) {
    console.error('[TrelloWebhook] Error testing chatbot:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trello-webhook/checkin
 * Manually trigger a check-in for a card
 */
router.post('/checkin', async (req, res) => {
  try {
    const { cardId, workerName, type } = req.body;
    
    if (!cardId) {
      return res.status(400).json({ error: 'Missing required field: cardId' });
    }

    const { triggerManualCheckin } = await import('../services/chatbot-scheduler');
    const sent = await triggerManualCheckin(cardId, workerName, type || 'midday');

    if (sent) {
      res.json({ success: true, message: 'Check-in sent successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send check-in' });
    }
  } catch (error: any) {
    console.error('[TrelloWebhook] Error sending check-in:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/trello-webhook/send
 * Manually send a bot message to a card
 */
router.post('/send', async (req, res) => {
  try {
    const { cardId, message } = req.body;
    
    if (!cardId || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: cardId, message' 
      });
    }

    const posted = await postTrelloComment(cardId, message);

    if (posted) {
      res.json({ success: true, message: 'Comment posted successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to post comment' });
    }
  } catch (error: any) {
    console.error('[TrelloWebhook] Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
