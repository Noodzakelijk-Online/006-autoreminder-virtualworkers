/**
 * Trello Webhook Auto-Registration
 *
 * On server startup (when TRELLO_WEBHOOK_CALLBACK_URL is set), this module:
 *   1. Fetches all boards Joyce is a member of across all workspaces
 *   2. Lists existing webhooks on her Trello token
 *   3. Registers a new webhook for any board that doesn't already have one
 *      pointing to our callback URL
 *
 * This means no manual board ID configuration is needed — it discovers and
 * covers every board automatically.
 */
import axios from "axios";

const TRELLO_API_BASE = "https://api.trello.com/1";

interface TrelloBoard {
  id: string;
  name: string;
  closed: boolean;
}

interface TrelloWebhook {
  id: string;
  callbackURL: string;
  idModel: string;
  active: boolean;
}

/**
 * Fetch all open boards Joyce is a member of.
 */
async function getJoyceBoards(
  apiKey: string,
  apiToken: string
): Promise<TrelloBoard[]> {
  const res = await axios.get<TrelloBoard[]>(
    `${TRELLO_API_BASE}/members/me/boards`,
    {
      params: {
        key: apiKey,
        token: apiToken,
        filter: "open",
        fields: "id,name,closed",
      },
    }
  );
  return res.data.filter((b) => !b.closed);
}

/**
 * Fetch all webhooks currently registered on this token.
 */
async function getExistingWebhooks(
  apiKey: string,
  apiToken: string
): Promise<TrelloWebhook[]> {
  const res = await axios.get<TrelloWebhook[]>(
    `${TRELLO_API_BASE}/tokens/${apiToken}/webhooks`,
    { params: { key: apiKey, token: apiToken } }
  );
  return res.data;
}

/**
 * Register a webhook for a single board.
 */
async function registerWebhook(
  apiKey: string,
  apiToken: string,
  boardId: string,
  callbackUrl: string
): Promise<void> {
  await axios.post(
    `${TRELLO_API_BASE}/webhooks`,
    {
      callbackURL: callbackUrl,
      idModel: boardId,
      description: `Joyce Work Dashboard — board ${boardId}`,
      active: true,
    },
    { params: { key: apiKey, token: apiToken } }
  );
}

/**
 * Main entry point — call once during server startup.
 * Silently skips if credentials or callback URL are not configured.
 */
export async function registerTrelloWebhooksForAllBoards(): Promise<void> {
  const apiKey = process.env.TrelloAPIKey;
  const apiToken = process.env.TrelloAPIToken;
  const callbackUrl = process.env.TRELLO_WEBHOOK_CALLBACK_URL;

  if (!apiKey || !apiToken || !callbackUrl) {
    console.log(
      "[Trello Webhooks] Skipping auto-registration: TrelloAPIKey, TrelloAPIToken, or TRELLO_WEBHOOK_CALLBACK_URL not set."
    );
    return;
  }

  try {
    const [boards, existing] = await Promise.all([
      getJoyceBoards(apiKey, apiToken),
      getExistingWebhooks(apiKey, apiToken),
    ]);

    // Build a set of board IDs that already have a webhook pointing to our URL
    const alreadyRegistered = new Set(
      existing
        .filter((w) => w.callbackURL === callbackUrl && w.active)
        .map((w) => w.idModel)
    );

    const toRegister = boards.filter((b) => !alreadyRegistered.has(b.id));

    if (toRegister.length === 0) {
      console.log(
        `[Trello Webhooks] All ${boards.length} board(s) already have webhooks registered.`
      );
      return;
    }

    console.log(
      `[Trello Webhooks] Registering webhooks for ${toRegister.length} board(s)…`
    );

    await Promise.all(
      toRegister.map(async (board) => {
        try {
          await registerWebhook(apiKey, apiToken, board.id, callbackUrl);
          console.log(
            `[Trello Webhooks] ✓ Registered for board: "${board.name}" (${board.id})`
          );
        } catch (err: any) {
          console.error(
            `[Trello Webhooks] ✗ Failed for board "${board.name}" (${board.id}):`,
            err?.response?.data ?? err.message
          );
        }
      })
    );
  } catch (err: any) {
    console.error(
      "[Trello Webhooks] Auto-registration failed:",
      err?.response?.data ?? err.message
    );
  }
}
