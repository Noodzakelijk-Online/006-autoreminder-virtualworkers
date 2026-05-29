# VA Dashboard

A full-stack virtual assistant task management dashboard that integrates with Trello to manage workers, tasks, scheduling, and AI-powered APTLSS checklist generation.

## Features

- **Trello Integration** — pulls workspaces, boards, cards, labels, members, descriptions, comments, and attachments
- **Worker Dashboard** — workers see only their assigned Trello cards with time slots and completion tracking
- **Admin (Founder) Dashboard** — workload overview, task assignment, priority management, and worker settings
- **APTLSS Checklist Generation** — AI-generated checklists synced directly to real Trello cards
- **Bulk Webhook Registration** — register any number of Trello boards at once (auto-batched in groups of 50)
- **Smart Filtering** — excludes archived cards, Done/Completed lists, template boards, and Info lists
- **Advanced Scheduling** — per-worker scheduling with break times, cognitive load limits, and overflow detection
- **Real-time Updates** — WebSocket-based live sync across clients

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Node.js + Express + tRPC
- **Database:** MySQL + Drizzle ORM
- **Package Manager:** pnpm

## Quick Start

### Prerequisites

- Node.js v22.13.0+
- pnpm
- MySQL server (local, Docker, or remote)
- Trello API Key + Token

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | MySQL connection string, e.g. `mysql://root:pass@localhost:3306/va_dashboard` |
| `TRELLO_API_KEY` | From https://trello.com/app-key |
| `TRELLO_TOKEN` | From https://trello.com/app-key → Token |
| `JWT_SECRET` | Random string, min 32 characters |
| `OWNER_OPEN_ID` | Your Trello user ID |

> **Docker MySQL (quickest local option):**
> ```bash
> docker run --name va-mysql -e MYSQL_ROOT_PASSWORD=rootpass -e MYSQL_DATABASE=va_dashboard -p 3306:3306 -d mysql:8.0
> ```

### 3. Run database migrations

```bash
pnpm db:push
```

### 4. Start the dev server

```bash
pnpm dev
```

App runs at **http://localhost:3000**

> **Note:** Trello webhooks require a publicly reachable URL. For local development use [ngrok](https://ngrok.com) and set `PUBLIC_URL=https://your-ngrok-url.ngrok.io` in `.env`.

## Full Setup Guide

See [`LOCAL_DEV_SETUP.md`](./LOCAL_DEV_SETUP.md) for detailed instructions including troubleshooting.

## Project Structure

```
va-dashboard/
├── client/          # React frontend (Vite)
│   └── src/
│       ├── components/   # UI components
│       ├── pages/        # Route pages
│       ├── hooks/        # Custom React hooks
│       └── contexts/     # React contexts
├── server/          # Express backend
│   ├── routes/      # API route handlers
│   ├── services/    # Business logic services
│   └── utils/       # Shared utilities
├── drizzle/         # Database schema & migrations
├── .env.example     # Environment variable template
└── LOCAL_DEV_SETUP.md  # Detailed setup guide
```

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm db:push` | Push schema changes to database |
| `pnpm test` | Run tests |

## Architecture

See [`ARCHITECTURE-ACTUAL.md`](./ARCHITECTURE-ACTUAL.md) for a full breakdown of the system design.
