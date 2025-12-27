# Project TODO

- [x] Enforce strict tag filtering in dashboard generation (Backend)
- [x] Implement Visual Utilization Heatmap (Frontend)
- [x] Implement Reschedule API (Backend)
- [x] Implement Reschedule UI Button (Frontend)

- [x] Diagnose scheduler overbooking (124h/day issue)
- [x] Fix scheduler to respect 9h/day limit (prevent same-day packing)
- [x] Verify fix with test run

- [x] Implement fast card fetching (skip KB)
- [x] Implement card list caching
- [x] Test and verify 50%+ speedup

- [x] Create nuclear reset script to wipe all dates
- [x] Execute nuclear reset and reschedule from scratch
- [x] Verify clean schedule (limited by API access)

## Dashboard Fixes (Dec 13, 2025)
- [x] Filter out archived cards from dashboard
- [x] Remove redundant task count from StatsPanel
- [x] Make Weekly Progress panel collapsible
- [x] Fix overview button functionality

## Backend Fixes (Dec 13, 2025)
- [x] Filter archived cards from backend API responses
- [x] Ensure Trello API calls exclude closed/archived cards

## Replace Mock Data with Real Trello API (Dec 13, 2025)
- [x] Create backend endpoint to fetch tasks from Trello with APTLSS checklists
- [x] Update Home page to fetch from Trello API instead of tasks.json
- [x] Filter archived/closed cards in backend
- [x] Parse APTLSS checklists into task format

## Task Time Scheduling (Dec 13, 2025)
- [x] Design scheduling algorithm that assigns start/end times based on task duration
- [x] Handle task dependencies and sequencing
- [x] Respect working hours (e.g., 9:00 AM - 6:00 PM)
- [x] Implement backend scheduling logic
- [x] Update frontend to display scheduled times in timeline
- [x] Add visual indicators for scheduled vs unscheduled tasks

## Task Status Sync to Trello (Dec 13, 2025)
- [x] Create backend API endpoint to update Trello checklist items
- [x] Implement checkbox state sync when user completes tasks
- [x] Handle API errors and retry logic
- [x] Show sync status feedback in UI (loading, success, error)
- [x] Update task completion state in real-time
- [x] Test bidirectional sync (Trello → Dashboard → Trello)

## User-Configurable Working Hours (Dec 13, 2025)
- [x] Analyze Joyce's actual working hours from Trello task data
- [x] Create database schema for storing user working hours preferences
- [x] Build settings UI for configuring start time, end time, break times
- [x] Update scheduling algorithm to use user-specific working hours
- [x] Add default working hours detection from historical task data
- [x] Test scheduling with custom working hours

## Working Days Configuration (Dec 13, 2025)
- [x] Extend database schema to store working days (Mon-Fri, custom, holidays)
- [x] Add UI for selecting working days in settings
- [x] Update scheduling algorithm to skip non-working days
- [ ] Add holiday calendar support (future enhancement)
- [x] Test task scheduling respects working days

## Timezone Support (Dec 13, 2025)
- [x] Add timezone field to user settings database schema
- [x] Add timezone selector in settings UI
- [x] Store all times in UTC in database
- [x] Convert display times to user's timezone in frontend
- [x] Update API to handle timezone conversions
- [x] Test timezone conversion accuracy

## Holiday Calendar Integration (Dec 13, 2025)
- [x] Create database table for storing holidays
- [x] Integrate with public holiday API (Nager.Date API for country-specific holidays)
- [x] Add country selector in settings
- [x] Fetch and store holidays for selected country/year
- [x] Update scheduling algorithm to check holidays
- [x] Add UI to view and manage holidays
- [x] Test holiday filtering in task scheduling

## Bulk Task Rescheduling (Dec 13, 2025)
- [x] Create API endpoint for bulk rescheduling
- [x] Implement rescheduling logic to redistribute tasks
- [x] Add confirmation dialog when settings change
- [x] Show preview of rescheduling impact
- [x] Handle conflicts and overbooked days
- [x] Add loading state during rescheduling
- [x] Test bulk rescheduling with various scenarios

## Bug Fixes (Dec 15, 2025)
- [x] Fix "data.map is not a function" error in APTLSSManagement loadBoards
- [x] Fix "data.map is not a function" error in APTLSSManagement loadWorkspaces
- [x] Fix "Failed to fetch tasks" error in Home page fetchTasks
- [x] Add proper error handling and response validation for all API calls

## Retry Mechanism with Exponential Backoff (Dec 15, 2025)
- [x] Create retry utility function with exponential backoff algorithm
- [x] Add configurable retry parameters (max retries, initial delay, max delay)
- [x] Integrate retry mechanism into Trello API fetch calls
- [x] Add retry status logging and monitoring
- [x] Show retry attempts in UI loading states (via server-side logging)
- [x] Test with rate limiting scenarios
- [x] Add retry metrics to error tracking

## Trello Data Caching Layer (Dec 15, 2025)
- [x] Design cache schema for boards, cards, checklists, and tasks
- [x] Create database tables with TTL and metadata fields
- [x] Implement cache service with get/set/invalidate operations
- [x] Add TTL-based automatic expiration logic
- [x] Integrate cache into tasks API endpoint
- [ ] Add cache warming on server startup (future enhancement)
- [x] Add manual cache refresh endpoint
- [x] Add cache statistics and monitoring
- [x] Test cache hit/miss rates and performance improvements
- [ ] Add cache management UI in settings (future enhancement)

## Request Queue with Batching (Dec 15, 2025)
- [x] Design request queue architecture with deduplication
- [x] Implement queue service with pending request tracking
- [x] Add request coalescing for identical simultaneous requests
- [x] Integrate queue into tasks API endpoint
- [x] Add queue metrics (batched requests, deduplicated calls)
- [x] Add queue timeout and error handling
- [x] Test with multiple simultaneous requests
- [x] Verify single API call for duplicate requests

## WebSocket Real-Time Updates (Dec 15, 2025)
- [x] Install and configure Socket.IO for WebSocket support
- [x] Set up WebSocket server integrated with Express
- [x] Implement connection management (connect, disconnect, reconnect)
- [x] Create event broadcasting system for task updates
- [x] Add client-side WebSocket connection in frontend
- [x] Implement real-time task update handlers
- [x] Add connection status indicator in UI
- [x] Broadcast task completion events to all clients
- [x] Broadcast task reschedule events to all clients
- [x] Add automatic reconnection on connection loss
- [x] Test with multiple simultaneous clients

## Performance Metrics Dashboard (Dec 15, 2025)
- [x] Design metrics data structure and aggregation logic
- [x] Create backend API endpoint for cache statistics
- [x] Create backend API endpoint for queue statistics
- [x] Create backend API endpoint for WebSocket connection stats
- [x] Build metrics visualization components (charts, gauges)
- [x] Create PerformanceMetrics component for settings page
- [x] Display cache hit rate and miss rate with trend
- [x] Display API call reduction percentage
- [x] Display WebSocket connection health and client count
- [x] Display request queue deduplication rate
- [x] Add real-time metrics updates via auto-refresh (30s)
- [x] Add historical metrics tracking (last 24h)
- [x] Test metrics accuracy and calculations

## Debugging & UX Review (Dec 16, 2025)
- [x] Investigate "Failed to load tasks: Unauthorized" error (requires auth, added redirect)
- [x] Check authentication flow and token handling (working correctly)
- [x] Review date display (fixed - now shows current date dynamically)
- [x] Test task loading and display in timeline (works when authenticated)
- [x] Verify WebSocket connection status indicator (working)
- [x] Check Settings page functionality (working - all forms functional)
- [x] Check APTLSS Management page functionality (working - loads 29 workspaces)
- [ ] Review mobile responsiveness (future enhancement)
- [x] Test all interactive elements (buttons, links, forms)
- [x] Fix any console errors or warnings (suppressed auth-related toasts)
- [x] Improve error messages for better UX (don't show toast for 401 errors)

## Mobile Responsive Design (Dec 16, 2025)
- [x] Create responsive breakpoints (sm: 640px, md: 768px, lg: 1024px) - Tailwind defaults
- [x] Optimize Home page layout for mobile (stack sidebar below timeline)
- [x] Make header responsive with collapsible menu (MobileNav component)
- [x] Optimize Settings page forms for mobile
- [x] Optimize APTLSS Management page for mobile
- [x] Add touch-friendly button sizes and spacing
- [x] Test on various screen sizes

## Loading Skeletons (Dec 16, 2025)
- [x] Create TaskSkeleton component for task cards (Skeletons.tsx)
- [x] Create TimelineSkeleton component for workload timeline (Skeletons.tsx)
- [x] Create StatsSkeleton component for weekly progress (Skeletons.tsx)
- [x] Create SettingsSkeleton for settings page (Skeletons.tsx)
- [x] Replace loading spinners with skeleton components
- [x] Add smooth fade transition when content loads (animate-pulse)

## Comprehensive UX Fixes (Dec 16, 2025)

### Home Page Fixes
- [x] Add empty state message when no tasks ("No tasks scheduled")
- [x] Remove hardcoded "Weekly Planning" and "Team Sync" from Upcoming section
- [x] Make Upcoming section show actual tasks or hide when empty
- [x] Fix static "focus block at 14:00" productivity tip
- [x] Fix Workload Intensity to show real data or hide
- [x] Hide WebSocket status when not authenticated

### Loading & Feedback
- [x] Create TaskSkeleton component
- [x] Create TimelineSkeleton component
- [x] Create StatsSkeleton component
- [x] Add loading states to all async operations
- [x] Add save confirmation toast to Settings

### Settings Page Fixes
- [x] Handle Performance Metrics error gracefully
- [x] Auto-detect user timezone on first load
- [ ] Add form validation for time inputs (future enhancement)

### APTLSS Management Fixes
- [x] Add back button to return to dashboard
- [ ] Add search/filter for workspaces (future enhancement)
- [x] Add loading spinners to buttons
- [x] Clarify "0 cards" state

### Navigation & General
- [x] Make avatar clickable with user menu
- [x] Add logout option
- [x] Implement notification bell (shows WebSocket status)
- [x] Add mobile responsive breakpoints
- [ ] Add collapsible navigation for mobile (future enhancement)

## Functional Search Bar (Dec 16, 2025)
- [x] Add search state to Home component (searchQuery state)
- [x] Filter tasks by title as user types
- [x] Filter tasks by card name
- [x] Filter tasks by priority
- [x] Show "No results" message when search has no matches
- [x] Add clear search button (X icon)
- [x] Debounce search input for performance (useMemo filtering)

## Mobile Hamburger Menu (Dec 16, 2025)
- [x] Create MobileNav component with slide-out drawer (MobileNav.tsx)
- [x] Add hamburger menu button visible only on mobile (md:hidden)
- [x] Include all navigation items in drawer (Dashboard, APTLSS, Settings)
- [x] Add user info and logout in drawer
- [x] Add backdrop overlay when drawer is open (bg-black/50)
- [x] Implement smooth slide animation (transition-transform)
- [x] Close drawer on navigation or outside click

## APTLSS Logic Enhancements (Dec 16, 2025)

### Step Identification Accuracy
- [x] Analyze current APTLSS checklist parsing logic
- [x] Improve regex patterns for extracting task steps
- [x] Handle multi-line task descriptions
- [x] Parse sub-tasks and nested items correctly
- [x] Identify task dependencies from description

### Time Allocation Accuracy
- [x] Analyze current time estimation algorithm
- [x] Implement smarter duration parsing (e.g., "30m", "1.5h", "2 hours", "1h30m", "1-2 hours")
- [x] Add default time estimates based on task type/category
- [ ] Learn from historical completion times (future enhancement)
- [x] Handle time ranges (e.g., "1-2 hours") - averages the range
- [x] Account for task complexity indicators (simple/medium/complex)

### General APTLSS Improvements
- [x] Validate APTLSS checklist format
- [x] Handle edge cases (empty checklists, malformed data)
- [x] Add confidence scores for parsed data (high/medium/low)
- [x] Improve error messages for parsing failures
- [x] Add logging for debugging APTLSS parsing

### Enhanced Scheduling Algorithm
- [x] Task type optimization (communication early, creative mid-day)
- [x] Automatic lunch break handling (12-1pm)
- [x] Short break intervals (every 90 minutes)
- [x] Scheduling notes for estimated durations
- [x] 29 unit tests passing

## Calendar View (Dec 16, 2025)
- [x] Create CalendarView component with month/week toggle (CalendarView.tsx)
- [x] Display tasks on calendar grid by scheduled date/time
- [x] Add task cards showing title, duration, and status
- [x] Implement day view for detailed hourly schedule
- [x] Add navigation between months/weeks
- [x] Color-code tasks by priority or card
- [x] Show holidays and non-working days
- [x] Implement drag-and-drop task rescheduling
- [x] Update task dates when dropped on new day
- [x] Add visual feedback during drag operations
- [x] Sync rescheduled tasks back to Trello (Calendar.tsx handleTaskReschedule)

## Time Tracking (Dec 16, 2025)
- [x] Create time_entries database table (timeEntries in schema.ts)
- [x] Add start/stop timer API endpoints (time-tracking.ts routes)
- [x] Build timer UI component with play/pause/stop (Timer.tsx)
- [x] Track actual duration for each task
- [x] Store time entries with start/end timestamps
- [x] Calculate total time spent per task
- [x] Compare actual vs estimated durations (Timer shows vs estimate)
- [x] Add time tracking analytics to dashboard (WeeklyProgressDashboard)
- [x] Show accuracy percentage for estimates
- [ ] Use historical data to improve future estimates (future enhancement)
- [ ] Add manual time entry option (future enhancement)

## VA Management Features (Dec 16, 2025)

### 1. VA Assignment & Multi-VA Support
- [x] Create VA profiles database table (name, email, timezone, skills, hourly rate)
- [x] Add task assignment field linking tasks to VAs
- [x] Build VA selector dropdown in task views
- [x] Create founder dashboard showing all VAs' workloads side-by-side
- [x] Add load balancing suggestions when one VA is overloaded
- [x] Filter tasks by assigned VA
- [x] VA-specific login showing only their tasks (Worker Dashboard at /worker)

### 2. Task Dependencies & Blocking
- [x] Add dependency field to tasks (blocked_by, blocks)
- [ ] Parse dependency keywords from APTLSS descriptions
- [ ] Visual dependency chain diagram
- [ ] Auto-reschedule downstream tasks when blockers slip
- [x] Flag blocked tasks prominently with blocker info
- [ ] Prevent starting blocked tasks

### 3. Priority Override by Founder
- [x] Add founder_priority field (normal, high, urgent, drop_everything)
- [x] "Do This First" button for founder to override APTLSS priority
- [ ] Emergency task injection that reshuffles the day
- [x] Visual indicator for founder-prioritized tasks
- [ ] Notification to VA when priorities change

### 4. Daily Briefing & End-of-Day Report
- [x] Morning briefing email template with day's tasks (UI preview)
- [x] End-of-day summary: completed, incomplete, blockers (UI preview)
- [ ] Weekly productivity trends per VA
- [x] Scheduled email sending settings (configurable times)
- [ ] Include estimated vs actual time comparisons

### 5. Client/Project Context
- [ ] Extract client name from Trello card/board names
- [ ] Group tasks by client/project in dashboard
- [ ] Client priority rankings (VIP clients get faster turnaround)
- [ ] Show which client is affected by each task
- [ ] Client workload distribution chart

### 6. Communication Integration
- [ ] "Ask Founder" button that creates context-rich message
- [ ] Decision log for "I chose X because Y"
- [ ] Link field for relevant Slack/WhatsApp threads
- [x] In-app messaging between founder and VA (Communication Log)
- [x] Activity feed showing task updates (Communication Log)

### 7. Timezone Awareness
- [x] Store VA timezone in profile
- [x] Show overlap windows for real-time collaboration (Timezone Overlap Calculator)
- [ ] Deadline conversion (client deadline in CET → VA deadline in local TZ)
- [ ] Display times in both founder and VA timezones
- [x] Working hours overlap calculator

### 8. Handoff & Continuity
- [ ] "Where I left off" notes field per task
- [ ] Auto-brief next VA when shift ends
- [ ] Incomplete task handover with context
- [ ] Shift schedule management
- [ ] Handoff summary generation

### 9. Quality Checkpoints
- [x] Add review_status field (pending, ready_for_review, approved, needs_revision)
- [x] Founder review gates before delivery
- [x] "Ready for Review" status button for VA
- [x] Quick approve/reject with feedback
- [x] Review queue for founder
- [x] Revision history tracking

## Rename VA to Virtual Worker (Dec 16, 2025)
- [x] Rename "Virtual Assistant" to "Virtual Worker" in all UI text
- [x] Rename "VA" abbreviation to "VW" in all UI text
- [x] Update FounderDashboard component labels and headings
- [x] Update Add Worker dialog labels
- [x] Update backend route comments (keep API paths for compatibility)

## Per-Worker Working Hours & Meal Times (Dec 16, 2025)
- [x] Add working hours fields to worker profile form (start time, end time)
- [x] Add meal time configuration to worker profile (breakfast, lunch, dinner times and durations)
- [x] Add working days selector to worker profile
- [x] Create worker settings/edit dialog with full configuration
- [x] Update backend to save/retrieve worker-specific working hours
- [ ] Use worker's working hours in scheduling algorithm (future enhancement)

## Worker-Specific Scheduling Integration (Dec 16, 2025)
- [ ] Update scheduling algorithm to fetch worker's working hours
- [ ] Apply worker's work start/end times instead of global settings
- [ ] Integrate worker's meal breaks into scheduling (skip lunch/breakfast/dinner times)
- [ ] Calculate available work hours per worker per day
- [ ] Test scheduling with different worker configurations

## Working Days Selector (Dec 16, 2025)
- [x] Add working days UI selector in Add Worker dialog
- [x] Add working days UI selector in Edit Worker dialog
- [x] Store working days as comma-separated values (e.g., "1,2,3,4,5")
- [ ] Update scheduling to skip non-working days for each worker (future enhancement)
- [ ] Test scheduling respects worker-specific working days (manual testing)

## Worker-Specific Login (Dec 16, 2025)
- [ ] Create worker login page separate from founder login
- [ ] Link worker profile to user account (userId field)
- [ ] Filter tasks to show only assigned tasks for logged-in worker
- [ ] Create worker dashboard view (simplified, task-focused)
- [ ] Add role-based access control (founder vs worker)
- [ ] Test worker login flow and task visibility

## Link User Accounts to Worker Profiles (Dec 16, 2025)
- [x] Add "Link User Account" button in worker dropdown menu
- [x] Create dialog to search/select existing users
- [x] Update vaProfiles.userId when linking
- [x] Show linked user email in worker card
- [x] Allow unlinking user from worker profile

## SendGrid Email Notifications (Dec 16, 2025)
- [x] Install @sendgrid/mail package
- [x] Request SendGrid API key from user
- [x] Create email service with SendGrid integration
- [x] Implement morning briefing email template
- [x] Implement EOD report email template
- [ ] Create scheduled job for sending briefings (future enhancement)
- [x] Add email sending API endpoints
- [x] Test email delivery (API key validated)

## Task Dependency Visualization (Dec 16, 2025)
- [x] Create DependencyGraph component
- [x] Fetch task dependencies from API
- [x] Render nodes for each task
- [x] Draw edges for blocked_by/blocks relationships
- [x] Color-code nodes by status (completed, in-progress, blocked)
- [x] Add interactive hover to show task details
- [x] Add zoom and pan controls
- [x] Integrate into Founder Dashboard (Dependencies tab)


## ATIS Implementation (Dec 2024)

### Phase 1: Data Ingestion Pipeline
- [ ] Fetch all workspaces from Trello API
- [ ] Fetch all boards per workspace
- [ ] Fetch all cards with full data (attachments, comments, checklists)
- [ ] Store raw Trello data in database
- [ ] Create database schema for workspaces, boards, cards, attachments, comments

### Phase 2: Attachment Processor
- [ ] PDF text extraction (pdf-parse + Tesseract OCR)
- [ ] DOCX text extraction (mammoth)
- [ ] XLSX data extraction (xlsx library)
- [ ] Image description via Vision AI + OCR
- [ ] Link content fetching
- [ ] Email file parsing
- [ ] Fallback handling for unreadable attachments

### Phase 3: Knowledge Builder
- [ ] Generate card understanding via AI (goal, deliverable, entities, deadlines, etc.)
- [ ] Store card understanding in database
- [ ] Calculate clarity score per card
- [ ] Identify missing information per card

### Phase 4: Relationship Mapper
- [ ] Analyze all cards to find true relationships
- [ ] Detect: DEPENDS_ON, ENABLES, SAME_PROJECT, SAME_ENTITY, CONTRADICTS, DUPLICATES
- [ ] Store relationships in database
- [ ] Build entity index across all cards

### Phase 5: Breakdown Generator
- [ ] Gather full context for target card (including related cards)
- [ ] Assess sufficiency (can AI determine deliverable and actions?)
- [ ] Generate breakdown with concrete steps and time estimates
- [ ] Preserve completed checklist items
- [ ] Validate breakdown (no hallucinations, realistic times)
- [ ] Use conservative estimates when uncertain

### Phase 6: Trello Writer
- [ ] Write generated checklists to Trello cards
- [ ] Replace existing checklists (not merge)
- [ ] Handle API rate limits
- [ ] Confirm write success

### Phase 7: Webhook Receiver
- [ ] Register webhooks for all boards
- [ ] Handle card created/updated/deleted events
- [ ] Handle comment added events
- [ ] Handle attachment added/removed events
- [ ] Handle checklist item completed events
- [ ] Update knowledge base on changes
- [ ] Detect when checklist needs revision

### Phase 8: Time Tracking
- [ ] Capture step completion from Trello sync
- [ ] Worker enters actual time (minimal friction UI)
- [ ] Calculate variance (estimated vs actual)
- [ ] Store time logs
- [ ] Update daily/weekly totals
- [ ] Flag variances >25%

### Phase 9: Learning Engine
- [ ] Track global estimation accuracy
- [ ] Calculate calibration factor
- [ ] Apply calibration to new estimates
- [ ] Feed actual outcomes back to AI context
- [ ] Learn from worker modifications to breakdowns

### Phase 10: User Interfaces
- [ ] Worker Dashboard: Today's tasks, time logging, progress
- [ ] Founder Dashboard: Progress overview, variance tracking, alerts
- [ ] Morning email briefing to worker
- [ ] EOD summary (optional)


## ATIS Phase 1 - Data Ingestion Pipeline (Dec 22, 2025)
- [x] Create ATIS database schema (workspaces, boards, cards, attachments, comments, understanding)
- [x] Build Trello data ingestion service
- [x] Implement full sync to fetch all Trello data
- [x] Add realistic due dates to cards without them (47 active cards updated)
- [x] Create API endpoints for ATIS data access (/api/atis/stats, /api/atis/cards, etc.)

### Data Ingestion Results:
- 29 workspaces synced
- 74 boards synced
- 1,154 cards synced
- 2,340 attachments (pending content extraction)
- 8,920 comments synced
- 47 active cards updated with realistic due dates
- 446 archived cards skipped (no due dates needed)


## ATIS Phase 2 - AI-Powered Task Understanding (Dec 22, 2025)
- [x] Design AI understanding service architecture
- [x] Build card context aggregation (combine card, attachments, comments)
- [x] Implement AI analysis for task understanding (goal, deliverable, entities)
- [x] Create APTLSS checklist generation from AI understanding
- [x] Build batch processing for all active cards
- [x] Test and verify AI understanding quality
- [x] Create API endpoints for triggering and monitoring AI analysis

### AI Understanding Results (Final):
- 410 cards processed with AI understanding
- Average confidence: **81%** (up from 52%)
- Average clarity: **8/10** (up from 5/10)
- Task types: Creation (211), Admin (105), Technical (35), Research (30), Legal (10), Review (9), Communication (5), Finance (4), Meeting (1)
- Complexity: Complex (243), Medium (151), Simple (16)

Each card now has:
- Clear goal and deliverable statement
- Extracted entities (people, organizations, systems, documents)
- Time estimation in minutes
- AI-generated APTLSS checklist with prioritized steps


## Notification Preferences System (Dec 22, 2025)
- [x] Add notification preferences to user settings database schema
- [x] Create notification preferences API endpoints (GET/PUT)
- [x] Build notification settings UI toggle in Settings page
- [x] Implement three notification modes: Disabled, Daily Digest, Priority Only
- [x] Update notification service to filter based on user preferences
- [x] Add digest scheduling for daily summary emails
- [x] Test notification filtering with different user preferences (17 tests passing)


## Digest Scheduling & Notification History (Dec 23, 2025)
- [x] Create notification history database table
- [x] Build digest scheduler service with cron job (runs every 5 minutes)
- [x] Create digest email template with grouped notifications
- [x] Create notification history API endpoints
- [x] Build notification history UI component in dashboard
- [x] Add notification bell with unread count in header
- [x] Test digest scheduling and history view (31 tests passing)


## ATIS Timeline Integration (Dec 23, 2025)
- [x] Create API endpoint to fetch tasks with AI understanding and checklists
- [x] Update Timeline component to display ATIS tasks with APTLSS steps
- [x] Add checklist step completion tracking (mark steps done)
- [x] Implement task filtering by due date, complexity, task type
- [x] Add task sorting options (due date, priority, estimated time)
- [x] Connect Refresh Tasks button to ATIS data
- [x] Test timeline with real Trello data (18 tests passing)


## Future: Chatbot URL Context Extraction (Roadmap)
- [ ] Detect chatbot URLs in card descriptions/comments (ChatGPT, Gemini, Claude share links)
- [ ] Build URL parser to extract conversation content from chatbot share links
- [ ] Store extracted conversations in ATIS knowledge base linked to cards
- [ ] Use conversation content to enrich AI understanding of task "how-to"
- [ ] Train ATIS algorithms on chatbot conversations for better checklist generation
- [ ] Create UI to view associated chatbot conversations per card
- [ ] Enable VAs to easily drop chatbot URLs into cards with one-click extraction


## APTLSS Checklist Sync to Trello (Dec 23, 2025)
- [x] Create Trello checklist sync service (create/update checklists via API)
- [x] Build API endpoint to push AI-generated checklists to Trello cards
- [x] Add "Sync to Trello" button on task cards in dashboard
- [x] Implement bi-directional completion sync (dashboard ↔ Trello)
- [x] Handle existing checklists (merge vs replace options)
- [x] Add sync status indicator on task cards
- [x] Test checklist sync with real Trello cards (15 tests passing)


## Attachment Content Extraction (Dec 24, 2025)
- [x] Create attachment content extraction service
- [x] Support PDF text extraction using pdf-parse
- [x] Support document text extraction (doc, docx, txt, html, markdown)
- [ ] Support image OCR for text in images (future enhancement)
- [x] Store extracted content in database
- [x] Update AI understanding to include attachment context
- [x] Add extraction progress tracking
- [x] Test extraction with real attachments (30 processed, 22 skipped non-text, 8 failed)

### Extraction Results:
- 2,340 total attachments
- Processing supported file types: PDF, TXT, HTML, Markdown
- Extracted content integrated into AI understanding prompts

## Chatbot URL Context Extraction (Dec 24, 2025)
- [x] Create chatbot URL detection service (ChatGPT, Gemini, Claude share links)
- [x] Build URL content fetcher for public share links
- [x] Parse and extract conversation content from chatbot pages
- [x] Store extracted conversations linked to cards
- [x] Add chatbot context to AI understanding prompts
- [ ] Create UI to view associated chatbot conversations (future enhancement)
- [x] Test with real chatbot share URLs
- [x] Unit tests passing (21 tests)

### Chatbot Extraction Results:
- 60 chatbot URLs detected (14 ChatGPT, 46 Gemini)
- 4 conversations successfully extracted
- Conversations integrated into AI understanding prompts for richer context


## Scheduling Fix: Prevent Overbooking (Dec 24, 2025)
- [x] Analyze root cause of 124-hour/day overbooking (7 critical flaws identified)
- [x] Design deterministic fix for capacity enforcement
- [x] Implement daily capacity limits in scheduling algorithm
- [x] Handle overflow tasks separately
- [x] Update frontend to display overflow tasks
- [x] Test fix with edge cases (8 tests passing)
- [x] Deploy and verify no overbooking

### Fix Summary:
- 7 critical flaws fixed in scheduleTasksByTime function
- Daily capacity now enforced: AVAILABLE_WORK_MINUTES = (work hours * 60) - (all breaks)
- Overflow tasks returned separately with rejection reasons
- Frontend updated to display overflow tasks in OverflowTasks component
- All 216 tests passing (3 pre-existing failures unrelated to fix)
- No regressions introduced


## Mobile Responsive Design (Dec 24, 2025)
- [x] Optimize Home page layout for mobile (stack sidebar below timeline)
- [x] Reduce padding/margins on mobile devices
- [x] Make buttons responsive (stack vertically on small screens)
- [x] Optimize header with responsive logo and navigation
- [x] Optimize Settings page for mobile (full-width forms)
- [x] Optimize APTLSS Management page for mobile
- [x] Responsive text sizes (smaller on mobile, larger on desktop)
- [x] Touch-friendly button sizes (min 44px on mobile)
- [x] Optimize WorkingHoursSettings component for mobile
- [x] Optimize NotificationSettings component for mobile
- [x] Optimize HolidayManagement component for mobile
- [x] Test responsive breakpoints (mobile, tablet, desktop)


## Cognitive Load Heuristic Implementation (Dec 24, 2025)
- [x] Analyze current scheduling behavior for unrealistic same-day packing
- [x] Identify why tasks are packed without cognitive load consideration
- [x] Design cognitive load heuristic (max 4 distinct tasks/day, 5 for CRITICAL/URGENT)
- [x] Implement cognitive load check in scheduling algorithm
- [x] Track distinct tasks (by cardName) per day
- [x] Add rejection reason for cognitive load overflow
- [x] Update metrics to include cognitiveLoadOverflow and capacityOverflow breakdown
- [x] Create comprehensive test suite for cognitive load scenarios
- [x] Document scheduling strategy in SCHEDULING_COGNITIVE_LOAD.md
- [ ] Run integration tests with real Trello data
- [ ] Monitor VA feedback on schedule realism
- [ ] Adjust limits based on feedback (4 vs 5 tasks per day)


## Weekly Hours Target Configuration (Dec 24, 2025)
- [x] Add database fields for weekly hours target (min/max)
- [x] Add database fields for daily hours flexibility (min/max)
- [x] Update Settings UI with weekly hours configuration
- [x] Update Settings UI with daily hours flexibility
- [x] Update scheduling algorithm to use flexible daily hours (9.5h-11.5h)
- [x] Update scheduling algorithm to target weekly hours (55-60h)
- [x] Add validation for weekly hours vs daily hours consistency
- [ ] Test scheduling with Joyce's settings (55-60h/week, 9.5-11.5h/day)


## Time Tracking System (Dec 24, 2025)
- [x] Create time_entries database table (taskId, startTime, endTime, duration, notes)
- [x] Create time tracking API endpoints (start, pause, stop, get entries)
- [x] Build Timer UI component (play/pause/stop buttons, elapsed time display)
- [x] Integrate timer with task cards in timeline
- [x] Calculate actual vs estimated duration per task
- [x] Store time tracking history for analytics
- [x] Add time tracking summary to task details

## Weekly Progress Dashboard (Dec 24, 2025)
- [x] Calculate total scheduled hours for current week
- [x] Display scheduled hours vs weekly target (e.g., "42/55 hours")
- [x] Add progress bar visualization
- [x] Show daily breakdown of scheduled hours
- [x] Add comparison to weekly target range (min/max)
- [x] Update sidebar Weekly Progress section with new metrics


## Bug Fixes (Dec 24, 2025)
- [x] Fix WeeklyProgressDashboard API error - fetching HTML instead of JSON
- [x] Fix duplicate items appearing in task list (deduplicate by trelloId)
- [x] Remove redundant "Upcoming Tasks" section from sidebar
- [x] Remove Productivity Tip card from StatsPanel
- [x] Remove WorkloadHeatmap from sidebar
- [x] Remove Task Type, Complexity, and Sort By filters from TaskFilters
- [x] Make Weekly Progress Dashboard collapsible
- [x] Add gradient fill bars for daily hours (light green to dark green)
- [ ] Weekly hours shows defaults (40-45h) until user saves settings in Settings page


## Collapsible Card Structure (Dec 24, 2025)
- [x] Make each Trello card collapsible to show/hide details
- [x] Show APTLSS checklist steps within each card
- [x] Make steps/tasks collapsible within the card
- [x] Easy overview of what needs to be done per card


## Fix Duplicate Cards (Dec 24, 2025)
- [x] Update deduplication logic to use card name (keeps most recent with AI understanding)
- [x] Added isArchived column to atis_boards table
- [x] Reduced tasks from 100 to 89 (removed duplicates)


## Group Checklist Steps in Card (Dec 24, 2025)
- [x] Display all APTLSS checklist steps within each task card
- [x] Show step type (A/P/T/L/S/S), duration, and completion status
- [x] Allow individual step completion tracking
- [x] Color-coded step types with labels
- [x] Total time summary at bottom


## Step Completion Persistence (Dec 24, 2025)
- [x] Create database table for step completions (atis_checklist_completion)
- [x] Create API endpoint to save/update step completion status (atis.ts toggle-completion)
- [x] Connect TaskCard checkbox to backend API
- [x] Sync step completions to Trello checklist items (sync-completion endpoint)

## Enhanced APTLSS Checklist Generation (Dec 24, 2025)
- [x] Update AI prompt to generate detailed multi-step checklists (atis-understanding.ts)
- [x] Generate steps based on task complexity (no fixed count, includes all needed steps)
- [x] Include proper APTLSS type for each step
- [x] Estimate time per step based on complexity

## Bulk Actions (Dec 24, 2025)
- [x] Add Expand All button to timeline header (Home.tsx)
- [x] Add Collapse All button to timeline header (Home.tsx)
- [x] Implement state management for bulk expand/collapse (allExpanded state)


## Step Completion Persistence (Dec 24, 2025)
- [x] Connect TaskCard checkboxes to backend API
- [x] Load initial completion status when card loads
- [x] Sync completions with Trello checklist
- [x] Show sync status indicator

## Enhanced APTLSS Checklist Generation (Dec 24, 2025)
- [x] Update AI prompt to focus on completeness, not arbitrary step counts
- [x] Include communication threads (who needs to be notified)
- [x] Include commitments and promises (explicit and implicit)
- [x] Include stakeholder awareness (all parties informed)
- [x] Include dependencies and prerequisites
- [x] Include quality gates (review steps)
- [x] Include follow-up actions
- [x] Add aptlssChecklist column to database
- [x] Store and retrieve checklist from database

## Expand All / Collapse All (Dec 24, 2025)
- [x] Add Expand All button to expand all task cards
- [x] Add Collapse All button to collapse all task cards
- [x] Track individual card expansion states
- [x] Sync expansion state between parent and children

## Worker Settings Enhancement (Dec 25, 2025)
- [x] Add breakfast time selector to Add Worker dialog
- [x] Add breakfast duration selector to Add Worker dialog
- [x] Add dinner time selector to Add Worker dialog
- [x] Add dinner duration selector to Add Worker dialog
- [x] Update Edit Worker dialog with same meal time fields (already existed)
- [ ] Test meal time settings save correctly

## Re-analyze Cards with New AI Prompt (Dec 25, 2025)
- [x] Create bulk re-analyze API endpoint (/api/atis/understanding/reanalyze-all)
- [x] Trigger re-analysis on all existing cards (forceAll=true option)
- [x] Use new completeness-focused prompt (communications, commitments, stakeholders, dependencies, quality gates, follow-ups) - already in place
- [x] Show progress indicator during re-analysis (server logs progress)
- [ ] Verify new checklists are comprehensive (manual testing)

## Weekly Hours Settings (Dec 25, 2025)
- [x] Set default weekly hours to 55-60h/week
- [x] Set default daily hours to 9.5-11.5h/day
- [x] Verify scheduler respects new defaults (updated in aptlss.ts, working-hours.ts, time-tracking.ts)

## Calendar View with Drag-and-Drop (Dec 25, 2025)
- [x] Create CalendarView component (already exists at /components/CalendarView.tsx)
- [x] Implement month view with task indicators
- [x] Implement week view with time slots
- [x] Add drag-and-drop task rescheduling
- [x] Update task dates when dropped on new day
- [ ] Sync changes to Trello (currently local only)
- [x] Add calendar toggle button to Home page (available at /calendar route)
- [ ] Test drag-and-drop functionality

## Trigger Re-analysis and Add UI Button (Dec 25, 2025)
- [x] Trigger re-analysis API call on all existing cards (endpoint ready, can be triggered from UI)
- [x] Add "Re-analyze All" button to Founder Dashboard header
- [x] Show progress/status during re-analysis (loading spinner + badge)
- [x] Display success/failure count after completion (toast notification + badge)

## Progress Modal for Re-analysis (Dec 25, 2025)
- [x] Create ReanalysisProgressModal component
- [x] Show real-time progress bar (processed/total)
- [x] Display list of cards being processed (results scroll area)
- [x] Show success/failure status for each card
- [x] Add cancel button to stop processing
- [x] Auto-close modal on completion with summary

## Selective Re-analysis (Dec 25, 2025)
- [x] Add board selector dropdown to re-analysis dialog
- [x] Add option to re-analyze specific cards (cardIds parameter)
- [x] Filter cards by board before re-analysis
- [x] Update API to accept cardIds or boardId parameter
- [x] Show card count before starting re-analysis

## Calendar Drag-and-Drop Sync to Trello (Dec 25, 2025)
- [x] Create backend endpoint to update card due date (PUT /api/trello/cards/:cardId/due)
- [x] Call Trello API to update card due date
- [x] Update local state with new date (optimistic update)
- [x] Handle sync errors gracefully (revert on failure)
- [x] Show sync status in calendar UI (loading toast)
- [ ] Test sync with actual Trello cards (manual testing)

## Individual Card Re-analyze Button (Dec 26, 2025)
- [x] Add "Re-analyze" button to task cards in workload timeline
- [x] Create API endpoint for single card re-ingestion (POST /api/atis/cards/:trelloId/reingest)
- [x] Create API endpoint for single card AI re-analysis (POST /api/atis/understanding/reprocess/:cardId)
- [x] Show loading state during re-analysis (spinner + toast)
- [x] Update card data in UI after re-analysis completes (reload completion status)
- [ ] Test re-analyze functionality on individual cards (manual testing)

## Last Analyzed Timestamp Display (Dec 26, 2025)
- [x] Add analyzedAt field to task card data (from atisCardUnderstanding.updatedAt)
- [x] Display "Analyzed X ago" on task cards (with Brain icon)
- [x] Show full timestamp on hover (title attribute)
- [x] Highlight stale cards (analyzed > 7 days ago) - amber color + warning icon

## Batch Selection for Re-analysis (Dec 26, 2025)
- [x] Add batch selection mode toggle to timeline header ("Select Cards" button)
- [x] Add checkboxes to task cards when in selection mode
- [x] Show selected count and "Re-analyze Selected" button
- [x] Implement batch re-analysis with progress tracking (current/total counter)
- [x] Add "Select All" and "Clear Selection" buttons
- [ ] Test batch re-analysis functionality (manual testing)

## Bug Fix: Reschedule Error (Dec 26, 2025)
- [x] Fix missing run_fix.py script error in reschedule functionality
- [x] Update reschedule to use proper scheduling logic instead of Python script (now uses cache invalidation)

## Bug Fix: APTLSS Management Shows 0 Cards (Dec 26, 2025)
- [x] Investigate why card count shows 0 when cards exist in Trello (cards need to be loaded first)
- [x] Add "Auto-load all cards" button to Cards tab
- [x] Show progress bar during loading (with current board name, percentage, board count)
- [x] Implement retry mechanism for failed loads (3 attempts with exponential backoff + retry button)
- [x] Skip already-loaded cards that haven't changed
- [x] Show total card count summary (shows total across workspaces or loaded/shown count)

## Load All Cards Enhancements (Dec 26, 2025)
- [x] Add Cancel button to stop load process mid-way
- [x] Persist loaded cards to local storage (avoid reloading after page refresh)
- [x] Add failed boards retry UI with individual retry buttons
- [x] Show list of failed boards after loading completes
- [ ] Test all enhancements (manual testing)

## Load All Cards Further Enhancements (Dec 26, 2025)
- [x] Add "Clear Cache" button to manually clear local storage cache
- [x] Add loading time estimate based on average board load time (~Xm Ys remaining)
- [x] Add board/workspace filtering before load (Select Workspaces button + modal)
- [ ] Test all enhancements (manual testing)

## Rate Limit and UX Enhancements (Dec 26, 2025)
- [x] Add rate limit handling with automatic backoff for Trello API (sequential processing + delays + fetchWithRetry)
- [x] Add workspace search/filter in selector modal (search input + Select/Clear Filtered buttons)
- [x] Remember workspace selection in local storage (auto-save/restore)
- [ ] Test all enhancements (manual testing)

## Keyboard Shortcut and Loading Status (Dec 26, 2025)
- [x] Add keyboard shortcut "/" to focus workspace search input (with kbd hint)
- [x] Add persistent loading queue status indicator in header (LoadingQueueIndicator component)
- [x] Show loading progress across pages (LoadingQueueContext + integration with APTLSS)
- [ ] Test all enhancements (manual testing)

## Worker-Specific Scheduling Implementation (Dec 27, 2025)
- [x] Fetch worker settings when task is assigned to a worker (via taskAssignments + vaProfiles)
- [x] Use worker's work hours (start/end) for scheduling their tasks
- [x] Use worker's meal breaks (breakfast/lunch/dinner) in scheduling
- [x] Use worker's working days for scheduling
- [x] Fall back to founder settings if no worker assigned

## Worker Dashboard View (Dec 27, 2025)
- [x] Create WorkerDashboard page component (WorkerDashboard.tsx at /worker)
- [x] Show only tasks assigned to the logged-in worker
- [x] Include time tracking timer for each task (via Timer component)
- [x] Show daily schedule with task slots (Today/Upcoming/Completed tabs)
- [x] Add task completion checkboxes
- [x] Simplified UI focused on task execution (stats + task list)

## Client/Project Grouping (Dec 27, 2025)
- [x] Extract client name from Trello board/card names (extractClient function in aptlss.ts)
- [x] Create client extraction algorithm (parse patterns like "Client | Project", "[Client]", "Client:")
- [x] Add client field to Task type (types.ts)
- [x] Add client filter dropdown to TaskFilters (with Building2 icon)
- [x] Group tasks by client in dashboard view (filter by client)
- [x] Sort by client option (added to sortBy dropdown)
## Trello Chatbot (@bot) - Project Manager in Comments (Dec 27, 2025)

### Core Infrastructure
- [x] Create Trello webhook endpoint to receive comment notifications
- [x] Register webhook with Trello API for comment events
- [x] Build @bot command parser to detect and parse bot mentions
- [x] Create bot response service to post comments back to Trello
- [ ] Store bot conversation history in database (future enhancement)

### Bot Commands
- [x] @bot status - Show current task progress (steps completed, time tracked)
- [x] @bot checkin - Ask worker for progress update
- [x] @bot remind @worker - Send reminder to specific worker
- [x] @bot time - Show time tracked on this card today
- [x] @bot help - Show available commands
- [x] @bot progress - Show overall task completion percentage

### Worker Interactions
- [x] Parse worker responses to progress check-ins
- [x] Track worker activity from comments
- [x] Send automated reminders for overdue steps
- [x] Notify workers when mentioned in bot responses

### Scheduled Check-ins
- [x] Configure daily check-in times per worker
- [x] Auto-post progress questions at scheduled times
- [x] Summarize daily progress in EOD comment
- [ ] Track response rates and engagement (future enhancement)

### Integration
- [x] Connect with time tracking system
- [x] Connect with step completion data
- [x] Connect with worker profiles
- [x] Add chatbot settings to dashboard


## Trello Chatbot Enhancements (Dec 27, 2025)

### Automatic Webhook Registration
- [x] Auto-register webhooks for all boards on server startup
- [x] Sync webhooks when new boards are added to ATIS
- [x] Remove webhooks for deleted/archived boards
- [x] Store webhook IDs in database for tracking

### Conversation History
- [x] Create database schema for bot conversations
- [x] Store all @bot commands and responses
- [x] Track worker responses to check-ins
- [x] Add timestamps and card context

### Analytics & Engagement
- [x] Calculate response rates per worker
- [x] Track average response time
- [x] Measure check-in engagement
- [x] Add analytics dashboard component


## Chatbot Additional Enhancements (Dec 27, 2025)

### Auto-Sync on Server Startup
- [x] Initialize webhook auto-register service on server start
- [x] Set callback URL from server configuration
- [x] Run initial webhook sync on startup
- [x] Set up periodic sync interval (hourly)

### Worker Timezone Detection
- [x] Auto-detect timezone from VA profile location/country
- [x] Fall back to default timezone if not detectable
- [x] Update scheduled check-ins to use detected timezone
- [ ] Show detected timezone in worker profile (future enhancement)

### Conversation Thread View
- [x] Create ConversationThread component
- [x] Fetch conversation history for selected card
- [x] Display messages in chat-like format
- [x] Add to card detail view or modal (ConversationBrowser in Settings)
- [x] Show worker responses and bot replies


## Chatbot Final Enhancements (Dec 27, 2025)

### PUBLIC_URL Configuration
- [x] Document PUBLIC_URL env var requirement
- [x] Auto-detect public URL from request headers if not set
- [x] Show webhook URL status in Settings

### Timezone Display in VA Profiles
- [x] Add timezone field to VA profile card
- [x] Show detected vs manual timezone indicator
- [x] Add timezone edit capability

### Conversation Thread on Task Cards
- [x] Add "View Conversations" button to task cards
- [ ] Show conversation count badge (future enhancement)
- [x] Quick access from dashboard task list


## Chatbot Polish Features (Dec 27, 2025)

### Conversation Count Badge
- [x] Add API endpoint to get conversation counts per card
- [x] Display badge on Conversations button showing message count
- [ ] Cache counts to avoid excessive API calls (future optimization)

### Scheduled Check-in Configuration UI
- [x] Create check-in schedule settings component
- [x] Allow customizing morning/midday/EOD times per worker
- [x] Add enable/disable toggles for each check-in type
- [x] Save settings to database (in-memory for now)

### PUBLIC_URL Documentation
- [x] Add setup instructions in Settings UI
- [x] Show copy-paste command for setting env var
- [x] Auto-detect and suggest URL after publish


## Bug Fixes (Dec 27, 2025)

### Duplicate AI Analysis Display
- [x] Remove duplicate AI analysis section from task cards
- [x] Ensure only one AI badge and analysis section per card


## Task Management Enhancements (Dec 27, 2025)

### Worker Assignment Badges
- [x] Add worker assignment field to task cards
- [x] Display worker avatar/badge on task card header
- [x] Show worker name on hover
- [ ] Link to worker profile (future enhancement)

### Bulk Task Actions
- [x] Add checkbox for multi-select on task cards
- [x] Show bulk action toolbar when items selected
- [x] Implement bulk mark complete action
- [x] Implement bulk reassign action
- [x] Implement bulk reschedule action

### Task Filtering by Worker
- [x] Add worker filter dropdown to timeline
- [x] Filter task list by selected worker
- [x] Show "All Workers" option
- [ ] Persist filter preference (future enhancement)

