import express, { Request, Response } from 'express';
import axios from 'axios';

const router = express.Router();

interface BulkRegistrationRequest {
  boardIds: string[];
  descriptions?: Record<string, string>;
  callbackUrl: string;
}

interface BulkRegistrationResult {
  boardId: string;
  success: boolean;
  webhookId?: string;
  error?: string;
}

interface BulkRegistrationResponse {
  success: boolean;
  results: BulkRegistrationResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

/**
 * POST /api/trello-webhook/bulk
 * Register webhooks for multiple Trello boards in a single request
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { boardIds, descriptions, callbackUrl } = req.body as BulkRegistrationRequest;

    // Validate input
    if (!Array.isArray(boardIds) || boardIds.length === 0) {
      return res.status(400).json({
        error: 'boardIds must be a non-empty array',
      });
    }

    if (boardIds.length > 50) {
      return res.status(400).json({
        error: 'Maximum 50 boards can be registered at once',
      });
    }

    if (!callbackUrl) {
      return res.status(400).json({
        error: 'callbackUrl is required',
      });
    }

    // Get Trello credentials
    const apiKey = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;

    if (!apiKey || !token) {
      return res.status(500).json({
        error: 'Trello API credentials not configured',
      });
    }

    // Register webhooks for each board in parallel
    const registrationPromises = boardIds.map(boardId =>
      registerWebhookForBoard(
        boardId,
        descriptions?.[boardId] || 'VA Dashboard Chatbot',
        callbackUrl,
        apiKey,
        token
      )
    );

    const results = await Promise.allSettled(registrationPromises);

    // Process results
    const registrationResults: BulkRegistrationResult[] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          boardId: boardIds[index],
          success: false,
          error: result.reason?.message || 'Unknown error',
        };
      }
    });

    const successful = registrationResults.filter(r => r.success).length;
    const failed = registrationResults.filter(r => !r.success).length;

    const response: BulkRegistrationResponse = {
      success: failed === 0,
      results: registrationResults,
      summary: {
        total: boardIds.length,
        successful,
        failed,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('[TrelloWebhookBulk] Error:', error);
    res.status(500).json({
      error: 'Failed to process bulk registration',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Register a webhook for a single board
 */
async function registerWebhookForBoard(
  boardId: string,
  description: string,
  callbackUrl: string,
  apiKey: string,
  token: string
): Promise<BulkRegistrationResult> {
  try {
    // Validate board ID format
    if (!boardId || boardId.length < 8 || boardId.length > 32) {
      throw new Error('Invalid board ID format');
    }

    if (!/^[a-zA-Z0-9]+$/.test(boardId)) {
      throw new Error('Board ID contains invalid characters');
    }

    // Register webhook with Trello
    const response = await axios.post(
      `https://api.trello.com/1/webhooks`,
      {
        callbackURL: callbackUrl,
        idModel: boardId,
        description: description,
      },
      {
        params: {
          key: apiKey,
          token: token,
        },
      }
    );

    if (!response.data || !response.data.id) {
      throw new Error('Invalid response from Trello API');
    }

    return {
      boardId,
      success: true,
      webhookId: response.data.id,
    };
  } catch (error) {
    let errorMessage = 'Unknown error';

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        errorMessage = 'Authentication failed - check your Trello credentials';
      } else if (error.response?.status === 404) {
        errorMessage = 'Board not found or you do not have permission';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else {
        errorMessage = `HTTP ${error.response?.status}: ${error.message}`;
      }
    }

    return {
      boardId,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * GET /api/trello-webhook/bulk/status
 * Get the status of bulk registration operations (for future use)
 */
router.get('/status/:operationId', async (req: Request, res: Response) => {
  try {
    const { operationId } = req.params;

    // TODO: Implement operation tracking in database
    // For now, return a placeholder response

    res.json({
      operationId,
      status: 'completed',
      progress: 100,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get operation status',
    });
  }
});

export default router;
