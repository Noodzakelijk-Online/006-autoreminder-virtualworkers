# Joyce Work Schedule Production Runbook

This app is an internal operations dashboard for Joyce. Keep external side effects approval-gated: manual Trello comments, timer changes, card moves, step completion, and maintenance runs should happen only from explicit UI actions.

Reply-monitor and compliance scans collect review evidence only. They must never change weekly pay or issue demerits automatically; any pay adjustment requires an explicit owner action in Time & Pay.

## Required Setup

1. Copy `.env.example` to `.env` on the deployment host.
   For local development, run `pnpm setup:local-secrets` once to provision missing encryption and scheduled-job secrets without printing their values.
2. Set these required values:
   - `DATABASE_URL`
   - `TrelloAPIKey`
   - `TrelloAPIToken`
   - `OPENAI_API_KEY`
   - `GMAIL_CREDENTIALS_ENCRYPTION_KEY` when Gmail OAuth credentials are stored in Settings
3. Run migrations:
   ```bash
   pnpm db:migrate
   ```
4. Build and start:
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
   - all Trello and integration values listed above
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

- `OPENAI_API_KEY`: the only APTLSS model-provider credential. Compatible account-visible models are assigned automatically.
- `SCHEDULED_TASK_SECRET`: locks `/api/scheduled/*` routes. Scheduled jobs must send `Authorization: Bearer <SCHEDULED_TASK_SECRET>`.
- `TRELLO_WEBHOOK_CALLBACK_URL`: set to `https://<deployment-domain>/api/trello/webhook` for Trello push sync.
- `TRELLO_POWERUP_API_KEY` and `TRELLO_POWERUP_SECRET`: required for the Trello Power-Up and webhook signature fallback.

`MANUS_RUNTIME_ENABLED` is intentionally disabled by default. Set it to `true` only when the deployment is hosted inside Manus and needs the Manus page editor/error overlay; it is not required by the Joyce dashboard itself.
- `TRELLO_WEBHOOK_SECRET`: optional dedicated webhook signature secret.

## Health Checks

Use the cheap process-liveness endpoint for high-frequency deployment monitors:

```bash
curl https://<deployment-domain>/api/health
```

Expected behavior:

- HTTP `200`: the application process is running and can serve requests.

Run the deeper database, Trello, webhook, scheduler, and configuration probes separately:

```bash
curl https://<deployment-domain>/api/readiness
```

Readiness returns HTTP `200` when no required item is blocked and HTTP `503` when production setup is blocked. Both responses intentionally contain only status, summary, counts, uptime, environment, and timestamp; neither exposes secret values.

## Scheduled Jobs

APTLSS continuously recalculates evidence-based card state, intervention priority, and confidence. Material Trello webhook events trigger immediate reassessment; an in-process hourly sweep at `:07 UTC` provides polling fallback and covers new, changed, or assessment-due cards. Manual maintenance remains exhaustive. The sweep is rate-limited and retries Trello `429` responses.

Assessment confidence is derived from description, ownership, due dates, labels, custom fields, persisted steps, completion criteria, risk evidence, comments, meaningful activity, contradictions, and freshness. LLM confidence is capped by this evidence score. Assessment snapshots and material changes are retained in `aptlss_assessments` and are visible under `/admin`.

### APTLSS model cascade

Structured APTLSS generation uses the lowest-ranked compatible OpenAI stage first. Live discovery refreshes models visible to the configured OpenAI project and excludes specialized or incompatible endpoints. The next available OpenAI stage reviews the candidate. A passing review stops the cascade. A failed review must return a corrected result, which is checked by the next stage. Deterministic evidence, approval, schedule, and plan-quality gates remain authoritative at every level.

The OpenAI catalog is cached, failures retain the last successful snapshot, and the static OpenAI ladder remains the offline fallback. Model failures, unsupported models, and rate limits open a temporary circuit and advance to the next OpenAI stage. Actual calls are recorded in `aptlss_audit_log` without prompts, outputs, or secrets.

See `docs/APTLSS_LLM_ROUTING.md` for discovery filters, effort support, caching, and failure behavior.

Recommended scheduled calls:

```bash
curl -X POST https://<deployment-domain>/api/scheduled/daily-summary -H "Authorization: Bearer <SCHEDULED_TASK_SECRET>"
curl -X POST https://<deployment-domain>/api/scheduled/auto-stop-timers -H "Authorization: Bearer <SCHEDULED_TASK_SECRET>"
curl -X POST https://<deployment-domain>/api/scheduled/aptlss-maintenance -H "Authorization: Bearer <SCHEDULED_TASK_SECRET>"
curl -X POST https://<deployment-domain>/api/scheduled/weekly-analysis -H "Authorization: Bearer <SCHEDULED_TASK_SECRET>"
```

Gmail does not require an external scheduled call. Configure the read-only Google OAuth client, connect the account, and choose the ingestion interval under Settings -> Automation. The server then reads the last 24 hours of Inbox mail, deduplicates by thread, and records every run in the scheduled-job ledger. The legacy `/api/scheduled/gmail-scan` batch endpoint remains available only for compatible external importers.

If scheduled jobs are not configured yet, Joyce can open `/admin` and use `Run Maintenance` to refresh APTLSS states, priority scores, repair flags, follow-up drafts, Robert decision counts, and the admin sync log manually.

## Daily Operator Checks

1. Open `/admin` and confirm Production Readiness has `Blocked = 0`.
2. Confirm `Trello live access` is ready.
3. Open Triage -> Plan My Day and verify the saved daily plan loads before generating a new one.
4. Use timers and maintenance actions only from explicit UI buttons.
5. Before end of day, draft the EOD handoff from Plan My Day and review any Robert decisions.

## Backup And Rollback

Before applying a production migration, create a restorable MySQL backup and record the currently deployed commit. Test the restore procedure outside production at least once.

If a release fails, stop the app, restore the previous commit or image, and restore the matching database backup when the failed release applied a migration. Restart only after both `/api/health` and `/api/readiness` return the expected status. Do not delete failed job, assessment, notification, or sync records; they are part of the incident evidence.
