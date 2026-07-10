# Joyce Work Schedule Production Runbook

This app is an internal operations dashboard for Joyce. Keep external side effects approval-gated: manual Trello comments, timer changes, card moves, step completion, and maintenance runs should happen only from explicit UI actions.

Reply-monitor and compliance scans collect review evidence only. They must never change weekly pay or issue demerits automatically; any pay adjustment requires an explicit owner action in Time & Pay.

## Required Setup

1. Copy `.env.example` to `.env` on the deployment host.
   For local development, run `pnpm setup:local-secrets` once to provision missing session, owner-login, and scheduled-job secrets without printing their values.
2. Set these required values:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `TrelloAPIKey`
   - `TrelloAPIToken`
   - `OWNER_OPEN_ID`
3. Set one owner sign-in method:
   - Hosted OAuth: `OAUTH_SERVER_URL`
   - Local self-hosted unlock: `LOCAL_AUTH_TOKEN`, `LOCAL_AUTH_OPEN_ID`, `LOCAL_AUTH_NAME`, `LOCAL_AUTH_EMAIL`
4. Run migrations:
   ```bash
   pnpm db:migrate
   ```
5. Build and start:
   ```bash
   pnpm build
   pnpm start
   ```

## Docker Deployment

Use Docker Compose when you want the app and MySQL to run together on one host.

1. Set all required values in `.env`, including:
   - `JOYCE_DB_PASSWORD`
   - `MYSQL_ROOT_PASSWORD`
   - `PORT`
   - all Trello/auth values listed above
2. Start MySQL:
   ```bash
   docker compose up -d db
   ```
3. Run migrations:
   ```bash
   docker compose --profile migrate run --rm migrate
   ```
4. Start the app:
   ```bash
   docker compose up -d app
   ```
5. Confirm health:
   ```bash
   curl http://localhost:${PORT:-3000}/api/health
   ```

The app container has a Docker healthcheck wired to `/api/health`. The production image does not copy `.env`, `node_modules`, `dist`, `.git`, or local package-store files from the host.

## Production Quality Add-Ons

Set these before treating the deployment as fully production-ready:

- `BUILT_IN_FORGE_API_KEY`: enables full AI APTLSS planning, daily plans, and follow-up drafts.
- `SCHEDULED_TASK_SECRET`: locks `/api/scheduled/*` routes. Scheduled jobs must send `Authorization: Bearer <SCHEDULED_TASK_SECRET>`.
- `TRELLO_WEBHOOK_CALLBACK_URL`: set to `https://<deployment-domain>/api/trello/webhook` for Trello push sync.
- `TRELLO_POWERUP_API_KEY` and `TRELLO_POWERUP_SECRET`: required for the Trello Power-Up and webhook signature fallback.
- `TRELLO_WEBHOOK_SECRET`: optional dedicated webhook signature secret.

## Health Checks

Use the plain HTTP endpoint for deployment monitors:

```bash
curl https://<deployment-domain>/api/health
```

Expected behavior:

- HTTP `200`: no blocked readiness items. Warnings may still exist.
- HTTP `503`: one or more required production items are blocked.

The response intentionally contains only status, summary, counts, uptime, environment, and timestamp. It does not expose secret values.

## Scheduled Jobs

Recommended scheduled calls:

```bash
curl -X POST https://<deployment-domain>/api/scheduled/daily-summary -H "Authorization: Bearer <SCHEDULED_TASK_SECRET>"
curl -X POST https://<deployment-domain>/api/scheduled/auto-stop-timers -H "Authorization: Bearer <SCHEDULED_TASK_SECRET>"
curl -X POST https://<deployment-domain>/api/scheduled/gmail-scan -H "Authorization: Bearer <SCHEDULED_TASK_SECRET>"
curl -X POST https://<deployment-domain>/api/scheduled/aptlss-maintenance -H "Authorization: Bearer <SCHEDULED_TASK_SECRET>"
curl -X POST https://<deployment-domain>/api/scheduled/weekly-analysis -H "Authorization: Bearer <SCHEDULED_TASK_SECRET>"
```

If scheduled jobs are not configured yet, the owner can open `/admin` and use `Run Maintenance` to refresh APTLSS states, priority scores, repair flags, follow-up drafts, Robert decision counts, and the admin sync log manually.

## Daily Operator Checks

1. Open `/admin` and confirm Production Readiness has `Blocked = 0`.
2. Confirm `Trello live access` is ready.
3. Open Triage -> Plan My Day and verify the saved daily plan loads before generating a new one.
4. Use timers and maintenance actions only from explicit UI buttons.
5. Before end of day, draft the EOD handoff from Plan My Day and review any Robert decisions.
