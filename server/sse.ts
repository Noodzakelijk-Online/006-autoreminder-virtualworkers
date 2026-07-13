/**
 * Server-Sent Events (SSE) broadcast module.
 *
 * Manages a set of connected SSE clients and lets any server code
 * broadcast named invalidation events so the frontend immediately
 * refetches the relevant data — no polling lag.
 *
 * Supported event types:
 *   - "trello-invalidate"  -> Trello card data changed (webhook)
 *   - "timer-invalidate"   -> A timer was started, stopped, or edited
 *   - "pay-invalidate"     -> Pay log was updated
 *   - "scan-complete"      -> Reply monitor scan finished
 *
 * Usage:
 *   import { registerSseRoute, broadcast } from "./sse";
 *   registerSseRoute(app);
 *   broadcast("timer-invalidate");
 *   broadcast("trello-invalidate");
 */
import type { Application, Request, Response } from "express";

// Set of active SSE response objects (one per connected browser tab)
const clients = new Set<Response>();
export type OperationalEvent =
  | "trello-invalidate"
  | "timer-invalidate"
  | "pay-invalidate"
  | "scan-complete"
  | "aptlss-invalidate"
  | "gmail-invalidate"
  | "jobs-invalidate";

/**
 * Register the GET /api/sse/trello route.
 * The frontend connects to this endpoint to receive push invalidation signals.
 */
export function registerSseRoute(app: Application): void {
  app.get("/api/sse/trello", (req: Request, res: Response) => {
    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
    res.flushHeaders();

    // Send a heartbeat comment every 55 s to keep the connection alive.
    // 55 s is safely under the typical 60 s proxy idle timeout.
    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 55_000);

    // Register this client
    clients.add(res);

    // Clean up on disconnect
    req.on("close", () => {
      clearInterval(heartbeat);
      clients.delete(res);
    });
  });
}

/**
 * Broadcast a named event to all connected SSE clients.
 * The frontend listens for these events and immediately invalidates
 * the relevant tRPC cache entries.
 */
export function broadcast(eventName: OperationalEvent): void {
  const payload = JSON.stringify({ ts: Date.now() });
  const message = `event: ${eventName}\ndata: ${payload}\n\n`;
  for (const res of Array.from(clients)) {
    try {
      res.write(message);
    } catch {
      // Client disconnected mid-write -- remove it
      clients.delete(res);
    }
  }
}

/**
 * Convenience alias for the original Trello invalidation broadcast.
 * Kept for backward compatibility with trelloWebhook.ts.
 */
export function broadcastTrelloInvalidate(): void {
  broadcast("trello-invalidate");
}
