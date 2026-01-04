# Developer Setup Guide
## Smart Interview System - Local Development

This guide will help you get the interview system running on your local machine.

---

## Prerequisites

Before starting, ensure you have:

- **Node.js** v22.13.0 or higher
- **pnpm** package manager
- **Git** for version control
- **Trello API credentials** (API Key + Token)
- **Database** (PostgreSQL recommended, or use the built-in SQLite for development)

---

## Step 1: Clone and Install

```bash
# Navigate to project directory
cd /path/to/va-dashboard

# Install dependencies
pnpm install

# This will install all required packages including:
# - React 19 + Wouter (frontend)
# - tRPC (API layer)
# - Drizzle ORM (database)
# - Zod (validation)
# - All other dependencies
```

---

## Step 2: Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Trello API Credentials (REQUIRED)
TRELLO_API_KEY=your_trello_api_key_here
TRELLO_TOKEN=your_trello_token_here

# Database (use SQLite for local dev)
DATABASE_URL=file:./dev.db

# JWT Secret (for authentication)
JWT_SECRET=your_random_secret_here

# OAuth (if using authentication)
OAUTH_SERVER_URL=https://oauth.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im

# Owner Info (your Trello user)
OWNER_NAME=Your Name
OWNER_OPEN_ID=your_trello_user_id

# Frontend Config
VITE_APP_TITLE=VA Task Dashboard
VITE_APP_ID=va-dashboard
VITE_APP_LOGO=/logo.png

# AI Provider (for interview system)
# The system uses the built-in Forge API by default
# No additional API keys needed for development
```

### How to Get Trello Credentials

1. **API Key:** Visit https://trello.com/app-key
2. **Token:** Click "Token" link on the API key page and authorize the app
3. **User ID:** Visit https://trello.com/1/members/me?key=YOUR_API_KEY&token=YOUR_TOKEN

---

## Step 3: Database Setup

```bash
# Generate database schema
pnpm db:generate

# Push schema to database
pnpm db:push

# This creates all necessary tables including:
# - users
# - trello_cache_metadata
# - trello_cached_tasks
# - va_profiles
# - etc.
```

---

## Step 4: Start Development Server

```bash
# Start the dev server (both frontend and backend)
pnpm dev

# The server will start on:
# - Frontend: http://localhost:5173 (Vite dev server)
# - Backend: http://localhost:3000 (Express + tRPC)

# You should see:
# ✓ Server running on http://localhost:3000/
# ✓ [Server] Webhook auto-register DISABLED - notifications turned off
```

---

## Step 5: Verify Installation

### Check Backend Health

```bash
# Test the server is running
curl http://localhost:3000/api/health

# Should return: {"status":"ok"}
```

### Check Frontend

1. Open browser: http://localhost:5173
2. You should see the VA Task Dashboard
3. Click on "APTLSS Management" in the top navigation
4. The page should load without errors

### Check Interview System

```bash
# Test interview.start endpoint
curl -X POST http://localhost:3000/api/trpc/interview.start \
  -H "Content-Type: application/json" \
  -d '{"cardId":"YOUR_TRELLO_CARD_ID"}'

# Should return interview start response with first question
```

---

## Step 6: Load Test Data

To test the interview system, you need Trello cards:

1. **Navigate to APTLSS Management:** http://localhost:5173/aptlss
2. **Click "Refresh"** to load your Trello workspaces
3. **Select a workspace** and click "Load Cards"
4. **Cards will appear** in the "Cards" tab
5. **Click "Start Goal Interview"** on any card to test

---

## Project Structure

Understanding the codebase:

```
va-dashboard/
├── client/                    # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── ui/           # shadcn/ui components
│   │   │   └── GoalInterviewDialog.tsx  # Interview UI ⭐
│   │   ├── pages/            # Page components
│   │   │   └── APTLSSManagement.tsx     # Main APTLSS page ⭐
│   │   ├── contexts/         # React contexts
│   │   └── hooks/            # Custom hooks
│   └── index.html            # HTML entry point
│
├── server/                    # Backend (Node.js + Express)
│   ├── _core/                # Core server setup
│   │   ├── index.ts          # Server entry point
│   │   └── trpc.ts           # tRPC configuration
│   ├── routes/               # API routes
│   │   └── interview.ts      # Interview endpoints ⭐
│   ├── services/             # Business logic
│   │   ├── pre-interview-analysis.ts    # Card analysis ⭐
│   │   ├── conversational-interview.ts  # AI interview ⭐
│   │   ├── answer-validator.ts          # Validation ⭐
│   │   └── atis-understanding.ts        # APTLSS generation ⭐
│   └── db/                   # Database
│
├── drizzle/                   # Database schema
│   └── schema.ts             # Table definitions
│
├── shared/                    # Shared types
│   └── const.ts              # Constants
│
└── package.json              # Dependencies
```

**⭐ = Key files for interview system**

---

## Common Issues & Solutions

### Issue: "Cannot find module 'xyz'"

**Solution:** Run `pnpm install` again. Sometimes dependencies don't install correctly.

### Issue: "Trello API 401 Unauthorized"

**Solution:** Check your `TRELLO_API_KEY` and `TRELLO_TOKEN` in `.env`. Make sure they're correct and not expired.

### Issue: "Database error"

**Solution:** Delete `dev.db` and run `pnpm db:push` again to recreate the database.

### Issue: "Port 3000 already in use"

**Solution:** Kill the process using port 3000:
```bash
lsof -ti:3000 | xargs kill -9
```

### Issue: "Interview dialog doesn't open"

**Solution:** 
1. Check browser console for errors (F12)
2. Verify tRPC routes are registered in `server/routers.ts`
3. Ensure `interviewRouter` is imported and added to `appRouter`

### Issue: "Pre-analysis returns empty data"

**Solution:**
1. Check the Trello card has description, comments, or attachments
2. Verify Trello API credentials have read access
3. Check server logs for API errors

---

## Testing the Interview System

### Manual Testing Checklist

1. ✅ Load APTLSS Management page
2. ✅ Load cards from Trello
3. ✅ Click "Start Goal Interview" on a card
4. ✅ Dialog opens with first question
5. ✅ Answer with vague response (e.g., "the client")
6. ✅ AI should reject and ask for specifics
7. ✅ Answer with specific response (e.g., "Woonzorgnet")
8. ✅ AI should accept and move to next question
9. ✅ Confidence meter should increase
10. ✅ Complete interview (confidence >= 70%)
11. ✅ Final goal should be displayed
12. ✅ Dialog should close automatically

### Unit Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### API Testing with Postman/Insomnia

**1. Start Interview**
```
POST http://localhost:3000/api/trpc/interview.start
Content-Type: application/json

{
  "cardId": "YOUR_CARD_ID"
}
```

**2. Send Response**
```
POST http://localhost:3000/api/trpc/interview.respond
Content-Type: application/json

{
  "cardId": "YOUR_CARD_ID",
  "response": "Your answer here"
}
```

---

## Debugging Tips

### Enable Verbose Logging

Add this to your `.env`:
```env
DEBUG=trpc:*,interview:*
LOG_LEVEL=debug
```

### Check Server Logs

```bash
# Watch server logs in real-time
tail -f /tmp/va-dashboard-*.log

# Filter for interview-related logs
tail -f /tmp/va-dashboard-*.log | grep -i interview
```

### Use Browser DevTools

1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "trpc"
4. Watch API calls in real-time
5. Check request/response payloads

### Debug AI Prompts

Edit `server/services/conversational-interview.ts` and add:
```typescript
console.log('[Interview] System prompt:', systemPrompt);
console.log('[Interview] User message:', userMessage);
console.log('[Interview] AI response:', aiResponse);
```

---

## Next Steps

Once you have the system running:

1. **Read the Day-by-Day Plan:** `DEV_PLAN_INTERVIEW_SYSTEM.md`
2. **Start with Day 1 tasks:** Setup, testing, and bug fixes
3. **Document issues:** Add bugs to `todo.md`
4. **Ask questions:** Don't hesitate to reach out if stuck

---

## Useful Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm preview          # Preview production build

# Database
pnpm db:generate      # Generate migration files
pnpm db:push          # Push schema to database
pnpm db:studio        # Open Drizzle Studio (DB GUI)

# Testing
pnpm test             # Run tests
pnpm test:watch       # Run tests in watch mode
pnpm type-check       # Check TypeScript types

# Code Quality
pnpm lint             # Run ESLint
pnpm format           # Format code with Prettier
```

---

## Getting Help

If you get stuck:

1. **Check the logs:** Server logs often contain helpful error messages
2. **Read the code:** The codebase is well-documented with comments
3. **Search the docs:** Refer to tRPC, React, and Drizzle documentation
4. **Ask the founder:** Reach out with specific questions

Good luck! 🚀
