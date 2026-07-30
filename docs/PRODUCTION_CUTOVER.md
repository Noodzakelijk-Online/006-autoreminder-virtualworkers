# Production Cutover

## Target Runtime

The consolidated application requires a persistent Node.js container runtime,
MySQL, Redis, HTTPS, and WebSocket support. It also runs scheduled work inside
the application process. A static or request-only serverless deployment does
not preserve the complete runtime contract.

Use `Dockerfile` and `docker-compose.yml` for a single-host deployment, or map
the same services to a managed container platform. Keep one application
instance active until scheduled-job locking has been verified on the target
platform.

## Required Secrets

Configure these values in the deployment platform's secret store:

- `DATABASE_URL`: MySQL connection URL.
- `JWT_SECRET`: newly generated random value of at least 32 characters.
- `TRELLO_API_KEY`: active Trello API key.
- `TRELLO_TOKEN`: active Trello member token.
- `OPENAI_API_KEY`: active OpenAI API key.
- `REDIS_URL`: authenticated Redis connection URL.

For Docker Compose, also set `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`,
`MYSQL_USER`, `MYSQL_PASSWORD`, and `REDIS_PASSWORD`. Do not commit `.env`.

The server accepts the old local names `TrelloAPIKey` and `TrelloAPIToken`
during transition, but production configuration should use the canonical
uppercase names.

## Optional Integrations

- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, and
  `NOTIFICATIONS_ENABLED=true` enable outbound email notifications.
- `TRELLO_WEBHOOK_CALLBACK_URL` and `TRELLO_WEBHOOK_SECRET` enable verified
  Trello push updates after a public HTTPS domain exists.
- `SCHEDULED_TASK_SECRET` protects explicitly exposed scheduled-task routes.

Do not migrate the legacy MongoDB URL, Twilio credentials, React frontend URL,
or old reminder timing variables. They belong to the retired split
application, not the consolidated runtime.

## Verification Gate

Before traffic is moved:

1. Back up the source database.
2. Deploy MySQL and Redis with persistent storage.
3. Apply the canonical Drizzle migrations. Docker Compose runs the one-shot
   `migrate` service and starts the app only after it succeeds.
4. Start the application with `NODE_ENV=production`, `HOST=0.0.0.0`, and
   `LOCAL_AUTH_BYPASS=false`.
5. Confirm `/api/health`, authenticated founder/admin/worker access,
   WebSockets, scheduled jobs, Trello, OpenAI, Gmail, and Drive.
6. Confirm no unapproved Trello comment, move, email, or other external action
   occurs during smoke testing.
7. Point the public domain and Trello webhook callback at the new runtime.
8. Retain the prior build and database snapshot through the rollback window.

Only disconnect or delete the obsolete Vercel projects after this gate passes
against the public replacement.
