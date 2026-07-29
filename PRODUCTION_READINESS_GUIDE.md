# VA Dashboard - Production Readiness Guide

Complete guide to take VA Dashboard from 70% complete to 100% production-ready, with comprehensive testing and deployment strategy.

---

## 📊 Current State Assessment

### What's Already Done (70%)

✅ **Core Features Implemented:**
- Task scheduling algorithm (APTLSS)
- Trello integration (read/write)
- Time tracking system
- Worker management
- Chatbot system
- Caching layer (50x faster)
- WebSocket real-time sync
- Holiday calendar
- Notification system
- AI-powered task analysis (ATIS)

✅ **Technical Infrastructure:**
- Database schema (34 tables)
- tRPC API (type-safe)
- Express backend
- React frontend
- Drizzle ORM
- Authentication (Manus OAuth)
- S3 file storage
- SendGrid email integration
- 216+ unit tests

### What's Remaining (30%)

⏳ **To Reach Production:**
1. Code documentation & comments
2. Comprehensive testing (E2E, integration)
3. Error handling improvements
4. Performance optimization
5. Security hardening
6. Deployment configuration
7. Monitoring & logging
8. Backup & recovery procedures
9. User documentation
10. Admin documentation

---

## 🎯 Production Readiness Roadmap

### Phase 1: Code Documentation (3-5 days)
- Add JSDoc comments to all functions
- Document API endpoints
- Create architecture diagrams
- Document database schema
- Create troubleshooting guide

### Phase 2: Testing & Quality (5-7 days)
- Add E2E tests (Playwright/Cypress)
- Add integration tests
- Improve error handling
- Add logging
- Performance testing
- Security testing

### Phase 3: Optimization (3-5 days)
- Database query optimization
- Frontend bundle optimization
- Caching improvements
- API response optimization
- Image optimization

### Phase 4: Deployment Prep (2-3 days)
- Environment configuration
- Deployment scripts
- Monitoring setup
- Backup procedures
- Rollback procedures

### Phase 5: Documentation (2-3 days)
- User guide
- Admin guide
- API documentation
- Deployment guide
- Troubleshooting guide

**Total Time: 15-23 days (3-5 weeks)**

---

## 📚 Phase 1: Code Documentation (3-5 days)

### Step 1: Add JSDoc Comments to All Functions

**Example:**

```typescript
/**
 * Schedules tasks for a worker based on their availability and cognitive load
 * @param workerId - The ID of the worker
 * @param tasks - Array of tasks to schedule
 * @param workingHours - Worker's working hours configuration
 * @returns Promise<ScheduledTask[]> - Array of scheduled tasks with dates
 * @throws Error if worker not found or invalid tasks
 * 
 * @example
 * const scheduled = await scheduleTasksForWorker(
 *   'worker-123',
 *   tasks,
 *   { startTime: 9, endTime: 17, workDays: [1,2,3,4,5] }
 * );
 */
export async function scheduleTasksForWorker(
  workerId: string,
  tasks: Task[],
  workingHours: WorkingHours
): Promise<ScheduledTask[]> {
  // Implementation...
}
```

**Files to Document:**
- `server/routes/aptlss.ts` - Task scheduling
- `server/routes/atis.ts` - AI understanding
- `server/routes/time-tracking.ts` - Time tracking
- `server/routes/working-hours.ts` - Working hours
- `server/services/trello-cache.ts` - Caching
- `server/services/websocket.ts` - Real-time sync
- `server/services/trello-chatbot.ts` - Chatbot
- `client/src/hooks/useAuth.ts` - Auth hook
- `client/src/components/DashboardLayout.tsx` - Layout
- `client/src/lib/trpc.ts` - tRPC client

### Step 2: Document API Endpoints

Create `API_DOCUMENTATION.md`:

```markdown
# API Documentation

## Task Scheduling (APTLSS)

### GET /api/trpc/tasks.getSchedule
Get scheduled tasks for a worker

**Parameters:**
- `workerId` (string) - Worker ID
- `startDate` (Date) - Start date
- `endDate` (Date) - End date

**Response:**
```json
{
  "tasks": [
    {
      "id": "task-123",
      "title": "Task Title",
      "scheduledDate": "2025-02-01",
      "duration": 2,
      "priority": "high"
    }
  ]
}
```

**Errors:**
- 404: Worker not found
- 400: Invalid date range
- 500: Database error

### POST /api/trpc/tasks.reschedule
Reschedule a task

**Parameters:**
- `taskId` (string) - Task ID
- `newDate` (Date) - New scheduled date

**Response:**
```json
{
  "success": true,
  "task": { ... }
}
```
```

### Step 3: Create Architecture Diagrams

Create `ARCHITECTURE.md`:

```markdown
# VA Dashboard Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                       │
│  - Task Timeline                                             │
│  - Time Tracking                                             │
│  - Worker Management                                         │
│  - Settings & Preferences                                    │
└────────────────────────┬────────────────────────────────────┘
                         │ tRPC + WebSocket
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              Backend (Express + tRPC)                        │
│  - Task Scheduling (APTLSS)                                 │
│  - AI Analysis (ATIS)                                        │
│  - Trello Integration                                        │
│  - Time Tracking                                             │
│  - Chatbot                                                   │
│  - Caching Layer                                             │
└────────────────────────┬────────────────────────────────────┘
                         │ SQL Queries
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              Database (MySQL/SQLite)                         │
│  - 34 Tables                                                 │
│  - Relationships & Indexes                                   │
│  - Migrations                                                │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

```
User Action (UI)
    ↓
React Component
    ↓
tRPC Hook (useQuery/useMutation)
    ↓
Express Route Handler
    ↓
Business Logic Service
    ↓
Drizzle ORM Query
    ↓
Database (MySQL/SQLite)
    ↓
Response (SuperJSON)
    ↓
React Query Cache
    ↓
Component Re-render
```

## Component Relationships

```
App.tsx (Main)
├── DashboardLayout
│   ├── Sidebar Navigation
│   ├── Header
│   └── Main Content
│       ├── Home Page
│       ├── Task Timeline
│       ├── Time Tracking
│       ├── Worker Management
│       └── Settings
├── AIChatBox
└── Map Component
```
```

### Step 4: Document Database Schema

Create `DATABASE_SCHEMA.md`:

```markdown
# Database Schema Documentation

## Tables Overview

### Users Table
Stores user authentication and profile information

```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') DEFAULT 'user',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Relationships:**
- Has many: user_working_hours
- Has many: task_assignments
- Has many: time_entries

### ATIS Cards Table
Stores Trello cards ingested from ATIS

```sql
CREATE TABLE atis_cards (
  id VARCHAR(36) PRIMARY KEY,
  trelloCardId VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('todo', 'in_progress', 'done') DEFAULT 'todo',
  priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Relationships:**
- Has one: atis_card_understanding
- Has many: atis_attachments
- Has many: atis_comments
- Has many: task_assignments
```

### Step 5: Create Troubleshooting Guide

Create `TROUBLESHOOTING.md`:

```markdown
# Troubleshooting Guide

## Common Issues & Solutions

### Issue: "Cannot connect to database"

**Symptoms:**
- App loads but data doesn't appear
- Console shows database connection error

**Solutions:**
1. Check DATABASE_URL in .env.local
2. Verify database is running
3. Verify credentials are correct
4. Check firewall/network settings
5. Try resetting database: `pnpm db:push`

### Issue: "Tasks not scheduling correctly"

**Symptoms:**
- Tasks appear but with wrong dates
- Scheduling algorithm seems broken

**Solutions:**
1. Check working hours configuration
2. Verify holidays are set correctly
3. Check cognitive load settings
4. Review task duration estimates
5. Check for timezone issues

### Issue: "Trello sync not working"

**Symptoms:**
- Cards not appearing in dashboard
- Changes not syncing back to Trello

**Solutions:**
1. Verify TRELLO_API_KEY and TRELLO_TOKEN
2. Check Trello API rate limits
3. Verify board permissions
4. Check cache invalidation
5. Review webhook logs

### Issue: "Time tracking not recording"

**Symptoms:**
- Timer starts but doesn't save
- Time entries disappear

**Solutions:**
1. Check database connection
2. Verify user is authenticated
3. Check for JavaScript errors
4. Verify time entry permissions
5. Check database migrations
```

---

## 🧪 Phase 2: Testing & Quality (5-7 days)

### Step 1: Add E2E Tests (Playwright)

Install Playwright:
```bash
pnpm add -D @playwright/test
```

Create `tests/e2e/dashboard.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('VA Dashboard E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:3000');
  });

  test('should load dashboard', async ({ page }) => {
    // Verify page title
    await expect(page).toHaveTitle(/VA Dashboard/);
    
    // Verify main elements load
    await expect(page.locator('text=Task Timeline')).toBeVisible();
  });

  test('should display tasks', async ({ page }) => {
    // Wait for tasks to load
    await page.waitForSelector('[data-testid="task-item"]');
    
    // Verify at least one task is visible
    const tasks = await page.locator('[data-testid="task-item"]').count();
    expect(tasks).toBeGreaterThan(0);
  });

  test('should allow task rescheduling', async ({ page }) => {
    // Click reschedule button
    await page.click('[data-testid="reschedule-btn"]');
    
    // Select new date
    await page.click('[data-testid="date-picker"]');
    await page.click('text=15');
    
    // Confirm
    await page.click('text=Confirm');
    
    // Verify success message
    await expect(page.locator('text=Task rescheduled')).toBeVisible();
  });

  test('should track time', async ({ page }) => {
    // Click start timer
    await page.click('[data-testid="start-timer"]');
    
    // Wait 2 seconds
    await page.waitForTimeout(2000);
    
    // Click stop timer
    await page.click('[data-testid="stop-timer"]');
    
    // Verify time was recorded
    await expect(page.locator('[data-testid="time-recorded"]')).toBeVisible();
  });

  test('should display worker profiles', async ({ page }) => {
    // Navigate to workers page
    await page.click('text=Workers');
    
    // Verify workers are displayed
    await page.waitForSelector('[data-testid="worker-card"]');
    const workers = await page.locator('[data-testid="worker-card"]').count();
    expect(workers).toBeGreaterThan(0);
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Trigger an error (e.g., invalid input)
    await page.fill('[data-testid="task-input"]', '');
    await page.click('[data-testid="submit-btn"]');
    
    // Verify error message
    await expect(page.locator('text=Required field')).toBeVisible();
  });
});
```

### Step 2: Add Integration Tests

Create `server/routes/aptlss.integration.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../db';
import { scheduleTasksForWorker } from './aptlss';

describe('APTLSS Integration Tests', () => {
  let workerId: string;

  beforeAll(async () => {
    // Create test worker
    const worker = await db.createWorker({
      name: 'Test Worker',
      email: 'test@example.com',
    });
    workerId = worker.id;
  });

  afterAll(async () => {
    // Clean up test data
    await db.deleteWorker(workerId);
  });

  it('should schedule tasks correctly', async () => {
    const tasks = [
      { title: 'Task 1', duration: 2, priority: 'high' },
      { title: 'Task 2', duration: 1, priority: 'medium' },
    ];

    const scheduled = await scheduleTasksForWorker(workerId, tasks);

    expect(scheduled).toHaveLength(2);
    expect(scheduled[0].date).toBeDefined();
    expect(scheduled[1].date).toBeDefined();
  });

  it('should respect working hours', async () => {
    const tasks = [
      { title: 'Task 1', duration: 8, priority: 'high' },
    ];

    const scheduled = await scheduleTasksForWorker(workerId, tasks);

    // Verify task doesn't exceed working hours
    expect(scheduled[0].duration).toBeLessThanOrEqual(8);
  });

  it('should handle holidays', async () => {
    // Add holiday
    await db.addHoliday(new Date('2025-02-14'));

    const tasks = [
      { title: 'Task 1', duration: 2, priority: 'high' },
    ];

    const scheduled = await scheduleTasksForWorker(workerId, tasks);

    // Verify task is not scheduled on holiday
    expect(scheduled[0].date.toDateString()).not.toBe('Fri Feb 14 2025');
  });
});
```

### Step 3: Improve Error Handling

Add error handling middleware:

```typescript
// server/_core/errorHandler.ts
export function createErrorHandler() {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err);

    // Log error with context
    const errorLog = {
      timestamp: new Date(),
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      userId: (req as any).user?.id,
    };

    // Send to logging service
    logError(errorLog);

    // Send error response
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  };
}
```

### Step 4: Add Logging

Add logging to key operations:

```typescript
// server/_core/logger.ts
export const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data);
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error);
  },
  debug: (message: string, data?: any) => {
    if (process.env.DEBUG) {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, data);
    }
  },
};
```

### Step 5: Performance Testing

Create performance test:

```typescript
// tests/performance.test.ts
import { describe, it, expect } from 'vitest';

describe('Performance Tests', () => {
  it('should schedule 100 tasks in < 1 second', async () => {
    const start = performance.now();
    
    const tasks = Array.from({ length: 100 }, (_, i) => ({
      title: `Task ${i}`,
      duration: 1,
      priority: 'medium',
    }));

    await scheduleTasksForWorker('worker-123', tasks);

    const end = performance.now();
    expect(end - start).toBeLessThan(1000);
  });

  it('should retrieve 1000 tasks in < 500ms', async () => {
    const start = performance.now();
    
    await db.getTasks({ limit: 1000 });

    const end = performance.now();
    expect(end - start).toBeLessThan(500);
  });
});
```

### Step 6: Security Testing

Create security test:

```typescript
// tests/security.test.ts
import { describe, it, expect } from 'vitest';

describe('Security Tests', () => {
  it('should prevent SQL injection', async () => {
    const maliciousInput = "'; DROP TABLE users; --";
    
    // Should not execute malicious SQL
    const result = await db.searchTasks(maliciousInput);
    
    expect(result).toBeDefined();
    // Verify table still exists
    const users = await db.getUsers();
    expect(users).toBeDefined();
  });

  it('should require authentication for protected routes', async () => {
    // Try to access protected route without auth
    const response = await fetch('/api/trpc/tasks.getSchedule', {
      method: 'GET',
    });

    expect(response.status).toBe(401);
  });

  it('should validate user permissions', async () => {
    // Try to access another user's data
    const response = await fetch('/api/trpc/tasks.getSchedule', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer invalid-token',
      },
    });

    expect(response.status).toBe(401);
  });
});
```

---

## ⚡ Phase 3: Optimization (3-5 days)

### Step 1: Database Query Optimization

Add indexes to frequently queried columns:

```typescript
// drizzle/schema.ts
export const atis_cards = mysqlTable('atis_cards', {
  id: varchar('id', { length: 36 }).primaryKey(),
  trelloCardId: varchar('trello_card_id', { length: 255 }).unique().notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).default('todo'),
  priority: varchar('priority', { length: 50 }).default('medium'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (table) => ({
  // Add indexes for frequently queried columns
  statusIdx: index('status_idx').on(table.status),
  priorityIdx: index('priority_idx').on(table.priority),
  createdAtIdx: index('created_at_idx').on(table.createdAt),
}));
```

### Step 2: Frontend Bundle Optimization

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          'trpc': ['@trpc/client', '@trpc/react-query'],
        },
      },
    },
    // Enable minification
    minify: 'terser',
    // Source maps for production debugging
    sourcemap: true,
  },
});
```

### Step 3: API Response Optimization

Add response compression:

```typescript
// server/_core/index.ts
import compression from 'compression';

app.use(compression());
```

### Step 4: Image Optimization

Optimize images in S3:

```typescript
// server/services/imageOptimization.ts
import sharp from 'sharp';

export async function optimizeImage(buffer: Buffer) {
  return sharp(buffer)
    .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}
```

---

## 🚀 Phase 4: Deployment Prep (2-3 days)

### Step 1: Environment Configuration

Create `.env.production`:

```env
# Database
DATABASE_URL=mysql://user:password@host:port/database

# Authentication
JWT_SECRET=your-production-secret
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://oauth.manus.computer

# Trello
TRELLO_API_KEY=your-api-key
TRELLO_TOKEN=your-token

# AWS S3
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# Email
SENDGRID_API_KEY=your-sendgrid-key

# Manus APIs
BUILT_IN_FORGE_API_URL=https://api.manus.computer
BUILT_IN_FORGE_API_KEY=your-key

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/va-dashboard.log

# Monitoring
SENTRY_DSN=your-sentry-dsn
```

### Step 2: Deployment Scripts

Create `scripts/deploy.sh`:

```bash
#!/bin/bash

# Build the project
echo "Building project..."
pnpm build

# Run tests
echo "Running tests..."
pnpm test

# Run migrations
echo "Running database migrations..."
pnpm db:push

# Start the server
echo "Starting server..."
NODE_ENV=production node dist/index.js
```

### Step 3: Monitoring Setup

Add Sentry for error tracking:

```bash
pnpm add @sentry/node
```

```typescript
// server/_core/index.ts
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

app.use(Sentry.Handlers.errorHandler());
```

### Step 4: Backup Procedures

Create backup script:

```bash
#!/bin/bash

# Backup database
mysqldump -u $DB_USER -p$DB_PASSWORD $DB_NAME > backup-$(date +%Y%m%d-%H%M%S).sql

# Upload to S3
aws s3 cp backup-*.sql s3://your-backup-bucket/

# Keep only last 7 days of backups
find . -name "backup-*.sql" -mtime +7 -delete
```

### Step 5: Rollback Procedures

Create rollback script:

```bash
#!/bin/bash

# Get previous version
PREVIOUS_VERSION=$(git log --oneline -2 | tail -1 | awk '{print $1}')

# Checkout previous version
git checkout $PREVIOUS_VERSION

# Rebuild and restart
pnpm build
pnpm db:push
NODE_ENV=production node dist/index.js
```

---

## 📖 Phase 5: Documentation (2-3 days)

### Create User Guide

Create `USER_GUIDE.md`:

```markdown
# VA Dashboard User Guide

## Getting Started

### 1. Login
- Click "Login" button
- Authenticate with Manus OAuth
- You'll be redirected to dashboard

### 2. Dashboard Overview
- **Task Timeline** - View and manage scheduled tasks
- **Time Tracking** - Track time spent on tasks
- **Workers** - Manage team members
- **Settings** - Configure preferences

### 3. Scheduling Tasks
1. Click "New Task"
2. Enter task details
3. Set priority and duration
4. Click "Schedule"
5. Task will be automatically scheduled based on availability

### 4. Tracking Time
1. Click "Start Timer" on a task
2. Work on the task
3. Click "Stop Timer" when done
4. Time is automatically recorded

### 5. Managing Workers
1. Go to "Workers" page
2. Click "Add Worker"
3. Enter worker details
4. Set working hours
5. Assign tasks

## Troubleshooting

### Tasks not appearing
- Refresh the page
- Check if you have permission to view tasks
- Verify Trello integration is connected

### Time not recording
- Check if timer is running
- Verify you're logged in
- Check browser console for errors
```

### Create Admin Guide

Create `ADMIN_GUIDE.md`:

```markdown
# VA Dashboard Admin Guide

## System Administration

### User Management
- Add/remove users
- Set user roles (admin/user)
- Reset passwords
- View user activity

### Database Management
- Run migrations: `pnpm db:push`
- Backup database: `./scripts/backup.sh`
- Restore database: `./scripts/restore.sh`
- Monitor database performance

### Monitoring
- View error logs: `tail -f /var/log/va-dashboard.log`
- Check Sentry for errors: https://sentry.io
- Monitor API performance
- Check database health

### Troubleshooting
- Check logs for errors
- Verify environment variables
- Check database connection
- Verify external service connections (Trello, SendGrid)

### Backup & Recovery
- Daily backups at 2 AM
- Backups stored in S3
- Restore from backup: `./scripts/restore.sh backup-date.sql`
- Test restore procedures weekly
```

---

## ✅ Production Readiness Checklist

### Code Quality
- [ ] All functions have JSDoc comments
- [ ] Error handling added to all endpoints
- [ ] Logging added to key operations
- [ ] Code follows style guide
- [ ] No console.log statements in production code
- [ ] No hardcoded secrets

### Testing
- [ ] Unit tests passing (216+)
- [ ] Integration tests added
- [ ] E2E tests added
- [ ] Performance tests passing
- [ ] Security tests passing
- [ ] Error handling tested

### Documentation
- [ ] API documentation complete
- [ ] Architecture documentation complete
- [ ] Database schema documented
- [ ] User guide created
- [ ] Admin guide created
- [ ] Troubleshooting guide created

### Performance
- [ ] Database queries optimized
- [ ] Frontend bundle optimized
- [ ] API responses compressed
- [ ] Images optimized
- [ ] Caching working correctly
- [ ] Load time < 3 seconds

### Security
- [ ] SQL injection prevented
- [ ] XSS protection enabled
- [ ] CSRF tokens implemented
- [ ] Authentication working
- [ ] Authorization working
- [ ] Secrets not in code

### Deployment
- [ ] Environment variables configured
- [ ] Deployment scripts created
- [ ] Monitoring setup
- [ ] Backup procedures created
- [ ] Rollback procedures created
- [ ] Health checks configured

### Operations
- [ ] Logging configured
- [ ] Error tracking setup (Sentry)
- [ ] Monitoring setup
- [ ] Alerting configured
- [ ] Backup schedule set
- [ ] Disaster recovery plan created

---

## 🧪 Local Testing Strategy

### Step 1: Set Up Test Environment

```bash
# Create test database
cp va-dashboard.db va-dashboard-test.db

# Create test environment file
cp .env.local .env.test

# Update .env.test
DATABASE_URL=sqlite:./va-dashboard-test.db
NODE_ENV=test
```

### Step 2: Run All Tests

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test -- integration

# E2E tests
pnpm test -- e2e

# Performance tests
pnpm test -- performance

# Security tests
pnpm test -- security
```

### Step 3: Manual Testing

Create test scenarios:

```markdown
# Manual Testing Scenarios

## Scenario 1: Task Scheduling
1. Create 5 tasks with different priorities
2. Verify tasks are scheduled correctly
3. Verify cognitive load is respected
4. Verify working hours are respected
5. Verify holidays are excluded

## Scenario 2: Time Tracking
1. Start timer on a task
2. Wait 5 minutes
3. Stop timer
4. Verify time is recorded
5. Verify time appears in reports

## Scenario 3: Worker Management
1. Add a new worker
2. Set working hours
3. Assign tasks
4. Verify tasks appear for worker
5. Verify schedule respects working hours

## Scenario 4: Trello Integration
1. Create card in Trello
2. Verify card appears in dashboard
3. Update card in dashboard
4. Verify update appears in Trello
5. Delete card in dashboard
6. Verify card is deleted in Trello

## Scenario 5: Error Handling
1. Disconnect database
2. Try to load tasks
3. Verify error message appears
4. Reconnect database
5. Verify app recovers
```

### Step 4: Load Testing

```bash
# Install load testing tool
pnpm add -D artillery

# Create load test config
cat > load-test.yml << 'EOF'
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: 'Warm up'
    - duration: 120
      arrivalRate: 50
      name: 'Ramp up'
    - duration: 60
      arrivalRate: 100
      name: 'Spike'

scenarios:
  - name: 'Task Scheduling'
    flow:
      - get:
          url: '/api/trpc/tasks.getSchedule'
      - post:
          url: '/api/trpc/tasks.schedule'
          json:
            title: 'Load test task'
            duration: 2
EOF

# Run load test
npx artillery run load-test.yml
```

---

## 🎯 Summary

### Timeline to Production
- **Week 1:** Code documentation + Testing (Phase 1-2)
- **Week 2:** Optimization + Deployment prep (Phase 3-4)
- **Week 3:** Final documentation + Testing (Phase 5)
- **Week 4:** Final testing + Deployment

### Key Metrics
- ✅ 99.9% uptime
- ✅ < 3 second page load
- ✅ < 500ms API response
- ✅ 0 critical bugs
- ✅ 100% test coverage for critical paths
- ✅ All security tests passing

### Before Going Live
1. ✅ All tests passing
2. ✅ All documentation complete
3. ✅ All security checks passed
4. ✅ Performance benchmarks met
5. ✅ Monitoring setup
6. ✅ Backup procedures tested
7. ✅ Rollback procedures tested
8. ✅ Team trained on operations

---

## 📞 Support

If you get stuck:
1. Check documentation
2. Check logs
3. Run tests to identify issue
4. Review error messages
5. Check Sentry for errors
6. Review git history for recent changes
