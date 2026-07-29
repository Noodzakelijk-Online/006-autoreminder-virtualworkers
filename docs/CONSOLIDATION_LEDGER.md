# Consolidation Ledger

## Recovery Record

| Item | Reference | Decision |
| --- | --- | --- |
| Developer baseline | `5a04e6a` | Canonical application architecture and migration lineage |
| Overwritten `main` snapshot | `549b932` | Preserved as tag `backup/joyce-overwrite-2026-07-29` and branch `archive/joyce-operator-current-2026-07-29` |
| Developer source commit | `917a9af45692718796f2bc3a875ee16453a24c67` by Kamal Uddin | Capability source inspected; code adapted only where additive |
| Recovery branch | `recovery/restore-developer-platform` | All consolidation work remains isolated until verification |
| Developer migration boundary | `0027_glorious_epoch` | Canonical; no journal entries were reused or rewritten |

The recovery branch was reverted to a tree that exactly matched `5a04e6a` before any integration work began.

## Retained Developer Capabilities

- Express bootstrap and REST route structure
- Signed-session authentication and role-based access
- Admin, founder, worker, Robert, and command-center surfaces
- VA management, scheduling, calendar, working hours, holidays, and rescheduling
- ATIS, ARES, interviews, notifications, communication, reports, and analytics
- Trello configuration, boards, webhooks, chatbot, and cache
- Redis, Socket.IO, request queueing, rate limiting, health checks, Docker, and deployment structure
- Drizzle schema and migration lineage through `0027`
- Existing APTLSS plans, steps, card states, scores, audit log, daily plans, policies, follow-ups, and weekly analysis
- Existing time, payment, compliance, triage, reply monitor, email inbox, and Sunday workflows

The previous worker dashboard remains available at `/worker/operations`.

## Imported Joyce Capabilities

| Capability | Source | Integrated as | Compatibility decision |
| --- | --- | --- | --- |
| Work lane order | Joyce archive | `shared/workLanePriority.ts` | ON-HOLD, DOING, TO-DO, then other |
| Work queue next action | Joyce archive | `server/aptlssWorkQueue.ts` | Joins existing developer APTLSS records; does not replace the engine |
| Free-flow waiting reason | Joyce archive | Deterministic interpreter plus durable history | Local evidence only; no external side effects |
| Decision outcomes | Joyce archive | Transactional operator mutation | Requires free-text outcome; resolves only the linked open step |
| Browser hygiene | Joyce archive | Token-authenticated collector and daily evidence | Uses developer `app_settings`, Socket.IO, and work schedule |
| Plan My Day | Adapted for recovered schema | Versioned deterministic `daily_plans` payload | Protects configured breaks and preserves unscheduled/Robert items |
| Operator evidence model | Joyce archive, adapted | New migration `0029` | Additive tables and columns only |
| Joyce work control UI | Joyce archive design direction, reimplemented | Authenticated `/worker` routes | Does not replace founder/admin layouts |
| Local auth bypass | Recovery requirement | Loopback-only worker resolution | Startup rejects production and non-loopback usage |
| Advanced scheduling contract | Developer baseline, repaired on recovery branch | Canonical batch adapter, owner-scoped history, shortcuts, metrics, and one Socket.IO subscription | Retains the developer queue and schema while removing invalid raw-column writes and dynamic React hook calls |

## Deliberately Not Imported

- Replacement application shell, central server bootstrap, and router from the Joyce archive
- Conflicting Joyce migration journal
- Provider-specific model cascade that bypassed the developer AI configuration
- Upwork integration
- Automatic Trello comments, moves, or outbound messages
- Browser-extension auto-install behavior, which browsers do not allow safely
- Hard-coded Trello API and Power-Up keys; setup values now load from server configuration at runtime

## Data Authority

- Developer identity, worker assignment, scheduling, authentication, ATIS, and ARES data remain authoritative.
- Existing APTLSS plans, steps, states, scores, and daily plans remain the shared operational source.
- Joyce evidence and history are imported only into compatible or operator-specific tables. Compatible history includes APTLSS plans/steps/states/scores/audit, daily plans, app settings, compliance snapshots, and time entries; identity rows are excluded.
- Database transfer must use `scripts/operator-data-transfer.mjs`, a source backup, and a reconciliation report.

## Required Merge Gates

- Typecheck, full unit/integration tests, production build
- Migration apply and rerun against a developer-lineage database
- Export/import/reconciliation rehearsal from a Joyce snapshot
- Admin, worker, unauthorized, and wrong-role auth checks
- Desktop/mobile and dark/light browser QA for restored routes and worker routes
- Trello, timers, Redis, WebSockets, notifications, Gmail/Drive evidence, and maintenance verification
- Rollback rehearsal using the preserved branch, tag, previous build, and database snapshot

Until all gates pass, `main` must remain unchanged and the recovery PR must remain a draft.
