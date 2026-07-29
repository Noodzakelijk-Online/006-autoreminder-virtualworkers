# Repository Consolidation Record

## Authority And Scope

This workspace is the product authority for Joyce Work Schedule. The legacy GitHub repository at `Noodzakelijk-Online/006-autoreminder-virtualworkers` is retained for history, but its application tree is not a runtime dependency and is not merged into this codebase file by file.

The original consolidation source reviewed on 2026-07-14 was remote `main`
commit `9607fd536f058d72c1edb14293bcb1e9e406a9b0`.

The remote was reviewed again on 2026-07-25 at
`917a9af45692718796f2bc3a875ee16453a24c67`. Its three newer commits were
checked behavior by behavior:

- dynamic Trello authorization already exists at `/api/trello/authorize` and
  uses the configured server key;
- clearing a personal Trello comment token is already supported with a nullable
  input and deletes the stored value;
- daily goals and schedule settings already have validated, persisted tRPC
  procedures;
- the duplicate legacy Manus route is not present in this runtime;
- generic worker branding was not imported because this deployment is
  intentionally Joyce-specific;
- the legacy chatbot conversation mapping was not imported because that route
  and schema are not runtime dependencies of the operator dashboard.

The remote commits remain reachable through the final consolidation merge even
where their legacy file changes are not applied to the canonical tree.

## Adopted Capabilities

The useful backend concepts were rebuilt against the current schema and runtime boundaries:

- a normalized operating profile with working days, hours, breaks, holidays, leave, and exceptional workdays;
- durable task dependency edges consumed by APTLSS portfolio analysis;
- project and client context matched to Trello boards and used in daily-plan ranking;
- normalized communication evidence for Gmail, Trello, Upwork, and future channels;
- durable local notification records independent of an optional external provider;
- versioned end-of-day and shift handoff records;
- owner-protected tRPC procedures under `operations` for these records.

Migration `0025_consolidated-operational-foundation.sql` is the only migration for this imported foundation. It extends the current migration chain rather than replaying the legacy repository's unrelated schema history.

## Deliberately Rejected

The following legacy implementations are not carried into the runtime:

- placeholder service adapters and duplicate backend entry points;
- permissive WebSocket or HTTP authentication;
- in-memory production rate limiting;
- duplicate model-provider routing;
- implicit Trello mutations or unapproved external side effects;
- legacy migrations that do not describe the current database;
- committed credentials or environment files.

## Release Gates

The consolidation branch must pass:

1. `pnpm install --frozen-lockfile`
2. `pnpm check`
3. `pnpm test`
4. `pnpm build`
5. Drizzle schema and migration drift detection
6. release-tree secret scanning
7. local database migration and readiness verification

Remote `main` must not be replaced until these checks pass and exposed
historical credentials have been rotated. Preserve the pre-consolidation remote
head in a dated legacy branch before updating `main`.

## Rollback

Before deployment, back up MySQL and record the deployed commit. If the release fails:

1. stop the application process;
2. restore the previous application commit or container image;
3. restore the pre-migration MySQL backup if migration `0025` was applied to that environment;
4. restart and verify `/api/health` and `/api/readiness`;
5. retain failed job, assessment, and sync records for diagnosis.

No public tunnel is part of this consolidation. Trello push webhooks remain unavailable until a stable public HTTPS deployment callback is configured.
