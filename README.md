# Joyce Work Schedule

Joyce Work Schedule is a single-user operations dashboard for a virtual assistant. It combines daily planning, Trello execution, communication monitoring, decision handling, time and pay administration, and evidence-backed compliance history in one workspace.

APTLSS is the intelligence layer beneath the dashboard. It continuously combines Trello cards, card activity, Gmail, Google Drive evidence, recorded decisions, timers, schedules, and historical outcomes to determine work state, next actions, priority, risks, and confidence.

> This application is designed for a trusted private deployment for Joyce. It is not a public multi-tenant service and should not be exposed to the Internet without TLS, access controls, secret management, and a passing readiness check.

## Product Areas

- **Today**: a focused work queue with the current task, next actions, and daily-plan context.
- **Inbox**: Trello triage, Gmail ingestion, reply monitoring, and approval-gated follow-up drafts.
- **Decisions**: active Robert decisions, operational exceptions, recorded outcomes, and recent decision history.
- **Time & Pay**: timers, weekly hours, payment administration, worker-performance signals, and source-backed compliance evidence.
- **Standards**: operating rules, the priority playbook, task classification, and execution guidance.
- **Settings**: integrations, automation intervals, production readiness, webhook health, and the protected Sunday workflow.
- **Admin monitor**: maintenance controls, assessment audit records, scheduled-job history, and deeper system diagnostics.

## Operating Principles

- External side effects remain explicit. The system does not post Trello comments, move cards, complete steps, or change timers without an approved action.
- Compliance and reply-monitor scans collect evidence. They do not automatically change pay or issue demerits.
- APTLSS confidence is evidence-constrained. Model output cannot override deterministic validation, policy, schedule, approval, or data-quality gates.
- Inferred state is kept separate from source evidence and retained in the audit trail.
- Credentials stay server-side and must never be committed to the repository.

## Architecture

| Layer        | Technology                             | Responsibility                                                    |
| ------------ | -------------------------------------- | ----------------------------------------------------------------- |
| Client       | React 19, Vite, Tailwind CSS, Radix UI | Operator dashboard and approval surfaces                          |
| API          | Express, tRPC, Zod                     | Typed application procedures and integration endpoints            |
| Data         | MySQL 8, Drizzle ORM                   | Plans, assessments, evidence, outcomes, timers, and audit history |
| Intelligence | APTLSS, OpenAI API                     | Structured assessment, planning, review, and repair               |
| Integrations | Trello, Gmail, Google Drive            | Work, communication, and supporting evidence ingestion            |
| Runtime      | Node.js 22, SSE, node-cron             | Web server, live updates, webhooks, and internal maintenance jobs |

The application uses one Node process for the web client, API, internal scheduler, webhook handling, and server-sent events. MySQL is the durable source of truth.

## Prerequisites

- Node.js 22
- pnpm 11
- Docker Desktop, recommended for local MySQL
- A Trello API key and token
- An OpenAI API key
- Google OAuth credentials when Gmail and Drive ingestion are enabled

## Local Setup

From PowerShell in the repository root:

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm setup:local-secrets
pnpm db:local:up
pnpm db:migrate
pnpm dev
```

`db:local:up` starts a local MySQL 8.4 container, creates local database credentials, and writes the resulting `DATABASE_URL` to the ignored `.env` file. Do not commit `.env` or `.env.db.local`.

The development server uses `PORT` from `.env`, normally `3000`. If that port is occupied, it selects the next available port and prints the exact URL in the terminal.

## Configuration

Start with [`.env.example`](./.env.example). The main values are:

| Variable                           | Requirement                     | Purpose                                               |
| ---------------------------------- | ------------------------------- | ----------------------------------------------------- |
| `DATABASE_URL`                     | Required                        | MySQL connection string                               |
| `TrelloAPIKey`                     | Required                        | Trello REST API key                                   |
| `TrelloAPIToken`                   | Required                        | Trello REST API token                                 |
| `OPENAI_API_KEY`                   | Required for AI                 | OpenAI project key used by APTLSS                     |
| `GMAIL_CREDENTIALS_ENCRYPTION_KEY` | Required for saved Google OAuth | Encrypts stored Google refresh credentials            |
| `GMAIL_OAUTH_CLIENT_ID`            | Conditional                     | Gmail and Drive OAuth client                          |
| `GMAIL_OAUTH_CLIENT_SECRET`        | Conditional                     | Gmail and Drive OAuth secret                          |
| `SCHEDULED_TASK_SECRET`            | Production                      | Protects external scheduled endpoints                 |
| `TRELLO_WEBHOOK_CALLBACK_URL`      | Hosted Trello sync              | Public HTTPS callback ending in `/api/trello/webhook` |
| `TRELLO_POWERUP_API_KEY`           | Power-Up only                   | Trello Power-Up authorization                         |
| `TRELLO_POWERUP_SECRET`            | Power-Up only                   | Power-Up and webhook-signature fallback               |

The Google account can be connected from **Settings > Automation**. Gmail ingestion is read-only and runs inside the application at the selected interval. Google Drive evidence ingestion uses the same authorized account and does not modify Drive files.

## Database

Apply committed migrations with:

```powershell
pnpm db:migrate
```

When intentionally changing `drizzle/schema.ts`, generate and apply a new migration with:

```powershell
pnpm db:push
```

Do not use schema push as a substitute for reviewing generated migration SQL in production.

## Development Checks

Run the complete local quality gates before merging or deploying:

```powershell
pnpm check
pnpm test
pnpm build
pnpm test:e2e
```

`test:e2e` expects a configured local runtime and exercises the real HTTP application. Unit and integration tests use Vitest.

## Docker Deployment

After configuring `.env`:

```powershell
docker compose up -d db
docker compose --profile migrate run --rm migrate
docker compose up -d app
```

Use the two health endpoints for different purposes:

- `GET /api/health`: cheap process-liveness check. A `200` means the server is responding.
- `GET /api/readiness`: database, Trello, webhook, scheduler, and configuration probes. A blocked deployment returns `503` with a non-secret summary.

Do not treat liveness as production readiness.

## Application Routes

| Route             | Surface                                   |
| ----------------- | ----------------------------------------- |
| `/`               | Joyce operator dashboard                  |
| `/robert`         | Robert oversight view                     |
| `/command-center` | Priority command center                   |
| `/admin`          | Maintenance, readiness, and audit monitor |

## Repository Layout

```text
client/                 React dashboard and Trello Power-Up assets
server/                 tRPC routers, APTLSS, integrations, jobs, and APIs
server/_core/           Runtime, context, environment, and transport setup
shared/                 Shared time and domain utilities
drizzle/                Schema, SQL migrations, and migration metadata
scripts/                Local setup, build helpers, and end-to-end smoke tests
docs/                   Focused technical documentation
PRODUCTION_RUNBOOK.md   Deployment and operator procedures
```

## Further Documentation

- [Production runbook](./PRODUCTION_RUNBOOK.md): deployment, readiness, schedules, webhooks, and daily operator checks.
- [APTLSS model routing](./docs/APTLSS_LLM_ROUTING.md): OpenAI model discovery, routing, review, repair, caching, and fallback behavior.
- [Consolidation record](./docs/CONSOLIDATION.md): product authority, imported capabilities, rejected legacy code, release gates, and rollback.

## Security

- Never commit `.env`, OAuth refresh tokens, Trello tokens, OpenAI keys, or database passwords.
- Rotate a credential immediately if it appears in source control, logs, screenshots, or chat history.
- Use a public HTTPS URL for Trello webhooks; localhost cannot receive Trello callbacks directly.
- Keep external mutations approval-gated and review the audit history after maintenance or integration changes.
- Back up MySQL before applying production migrations.

## License

MIT
