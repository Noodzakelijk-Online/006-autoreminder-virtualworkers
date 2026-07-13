/**
 * Trello Webhook handler.
 *
 * Trello sends a POST to /api/trello/webhook whenever a card on the board
 * is changed (moved, commented on, due date set, checklist updated, etc.).
 *
 * Enhanced v2:
 *   - Syncs APTLSS step completions when a checkItem is updated
 *   - Invalidates cached card state/priority when a card is moved between lists
 *   - Broadcasts SSE "trello-invalidate" for all events so the dashboard refreshes
 *
 * Security: Trello signs each request with HMAC-SHA1 of the raw body plus
 * callback URL using the app/Power-Up secret. We verify this when either
 * TRELLO_WEBHOOK_SECRET or TRELLO_POWERUP_SECRET is set.
 */
import crypto from "crypto";
import type { Application, Request, Response } from "express";
import { broadcastTrelloInvalidate } from "./sse";
import {
  completeStepByCheckItemId,
  uncompleteStepByCheckItemId,
} from "./aptlssStepsDb";
import { fetchCardContext } from "./trelloCardContext";
import { invalidateTrelloCardCache } from "./trello";
import {
  assessAndSaveCardIntelligence,
} from "./aptlssEngine";

const APTLSS_INTELLIGENCE_TRIGGERS = new Set([
  "createCard", "updateCard", "commentCard",
  "addMemberToCard", "removeMemberFromCard",
  "addLabelToCard", "removeLabelFromCard",
  "addAttachmentToCard", "deleteAttachmentFromCard",
  "addChecklistToCard", "removeChecklistFromCard",
  "createCheckItem", "deleteCheckItem", "updateCheckItem", "updateCheckItemStateOnCard",
]);

export function shouldRefreshAptlssForAction(actionType: string) {
  return APTLSS_INTELLIGENCE_TRIGGERS.has(actionType);
}

export function verifyTrelloSignature(
  body: string,
  callbackUrl: string,
  signature: string,
  secret: string
): boolean {
  const content = body + callbackUrl;
  const digest = crypto
    .createHmac("sha1", secret)
    .update(content)
    .digest("base64");
  const expected = Buffer.from(digest);
  const received = Buffer.from(signature);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

export function authorizeTrelloWebhook({
  body,
  callbackUrl,
  signature,
  secret,
  production,
}: {
  body: string;
  callbackUrl: string;
  signature?: string;
  secret?: string;
  production: boolean;
}) {
  if (!secret) {
    return production
      ? { ok: false as const, status: 503, message: "Trello webhook signature secret is not configured" }
      : { ok: true as const, unsignedDevelopmentRequest: true as const };
  }
  if (!signature || !verifyTrelloSignature(body, callbackUrl, signature, secret)) {
    return { ok: false as const, status: 401, message: "Invalid Trello webhook signature" };
  }
  return { ok: true as const, unsignedDevelopmentRequest: false as const };
}

export function registerTrelloWebhookRoute(app: Application): void {
  // HEAD — Trello uses this to verify the endpoint is reachable
  app.head("/api/trello/webhook", (_req: Request, res: Response) => {
    res.sendStatus(200);
  });

  // POST — actual webhook events
  app.post("/api/trello/webhook", async (req: Request, res: Response) => {
    const secret = process.env.TRELLO_WEBHOOK_SECRET || process.env.TRELLO_POWERUP_SECRET;
    const signature = req.headers["x-trello-webhook"] as string | undefined;

    const callbackUrl =
      process.env.TRELLO_WEBHOOK_CALLBACK_URL ||
      `${req.protocol}://${req.get("host")}/api/trello/webhook`;
    const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body);
    const authorization = authorizeTrelloWebhook({
      body: rawBody,
      callbackUrl,
      signature,
      secret,
      production: process.env.NODE_ENV === "production",
    });
    if (!authorization.ok) {
      res.status(authorization.status).send(authorization.message);
      return;
    }
    if (authorization.unsignedDevelopmentRequest) {
      console.warn("[Trello Webhook] Signature verification is disabled in local development.");
    }

    // Respond immediately so Trello doesn't time out
    res.sendStatus(200);

    // Process the event asynchronously
    const action = req.body?.action;
    invalidateTrelloCardCache();
    if (!action) {
      broadcastTrelloInvalidate();
      return;
    }

    const actionType: string = action.type ?? "";
    const cardId: string | undefined =
      action.data?.card?.id ?? action.data?.cardId;

    try {
      let shouldRefresh = false;
      // ── updateCheckItem: sync APTLSS step completion ──────────────────────
      if ((actionType === "updateCheckItem" || actionType === "updateCheckItemStateOnCard") && action.data?.checkItem) {
        const checkItemId: string = action.data.checkItem.id;
        const state: string = action.data.checkItem.state; // "complete" | "incomplete"

        if (state === "complete") {
          await completeStepByCheckItemId(checkItemId);
        } else {
          await uncompleteStepByCheckItemId(checkItemId);
        }

        shouldRefresh = true;
      }

      shouldRefresh ||= shouldRefreshAptlssForAction(actionType);
      if (cardId && shouldRefresh) await refreshCardIntelligence(cardId);
    } catch (e) {
      // Never let webhook processing errors crash the server
      console.error("[Trello Webhook] Error processing event:", actionType, e);
    }

    // Always broadcast SSE so the dashboard refreshes
    broadcastTrelloInvalidate();
  });
}

/**
 * Re-run the card state machine and priority scoring for a card.
 * Runs for every changed card so untriaged work also receives an assessment.
 */
async function refreshCardIntelligence(cardId: string): Promise<void> {
  const apiKey = process.env.TrelloAPIKey;
  const apiToken = process.env.TrelloAPIToken;
  if (!apiKey || !apiToken) return;

  try {
    const ctx = await fetchCardContext(cardId, apiKey, apiToken);
    await assessAndSaveCardIntelligence(ctx, "webhook");
  } catch (e) {
    console.error("[Trello Webhook] refreshCardIntelligence failed for", cardId, e);
  }
}
