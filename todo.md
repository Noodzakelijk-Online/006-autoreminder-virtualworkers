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
- [ ] Create responsive breakpoints (sm: 640px, md: 768px, lg: 1024px)
- [ ] Optimize Home page layout for mobile (stack sidebar below timeline)
- [ ] Make header responsive with collapsible menu
- [ ] Optimize Settings page forms for mobile
- [ ] Optimize APTLSS Management page for mobile
- [ ] Add touch-friendly button sizes and spacing
- [ ] Test on various screen sizes

## Loading Skeletons (Dec 16, 2025)
- [ ] Create TaskSkeleton component for task cards
- [ ] Create TimelineSkeleton component for workload timeline
- [ ] Create StatsSkeleton component for weekly progress
- [ ] Create SettingsSkeleton for settings page
- [ ] Replace loading spinners with skeleton components
- [ ] Add smooth fade transition when content loads

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
- [ ] Add search state to Home component
- [ ] Filter tasks by title as user types
- [ ] Filter tasks by card name
- [ ] Filter tasks by priority
- [ ] Show "No results" message when search has no matches
- [ ] Add clear search button
- [ ] Debounce search input for performance

## Mobile Hamburger Menu (Dec 16, 2025)
- [ ] Create MobileNav component with slide-out drawer
- [ ] Add hamburger menu button visible only on mobile
- [ ] Include all navigation items in drawer (Dashboard, APTLSS, Settings)
- [ ] Add user info and logout in drawer
- [ ] Add backdrop overlay when drawer is open
- [ ] Implement smooth slide animation
- [ ] Close drawer on navigation or outside click

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
- [ ] Create CalendarView component with month/week toggle
- [ ] Display tasks on calendar grid by scheduled date/time
- [ ] Add task cards showing title, duration, and status
- [ ] Implement day view for detailed hourly schedule
- [ ] Add navigation between months/weeks
- [ ] Color-code tasks by priority or card
- [ ] Show holidays and non-working days
- [ ] Implement drag-and-drop task rescheduling
- [ ] Update task dates when dropped on new day
- [ ] Add visual feedback during drag operations
- [ ] Sync rescheduled tasks back to scheduling algorithm

## Time Tracking (Dec 16, 2025)
- [ ] Create time_entries database table
- [ ] Add start/stop timer API endpoints
- [ ] Build timer UI component with play/pause/stop
- [ ] Track actual duration for each task
- [ ] Store time entries with start/end timestamps
- [ ] Calculate total time spent per task
- [ ] Compare actual vs estimated durations
- [ ] Add time tracking analytics to dashboard
- [ ] Show accuracy percentage for estimates
- [ ] Use historical data to improve future estimates
- [ ] Add manual time entry option

## VA Management Features (Dec 16, 2025)

### 1. VA Assignment & Multi-VA Support
- [x] Create VA profiles database table (name, email, timezone, skills, hourly rate)
- [x] Add task assignment field linking tasks to VAs
- [x] Build VA selector dropdown in task views
- [x] Create founder dashboard showing all VAs' workloads side-by-side
- [x] Add load balancing suggestions when one VA is overloaded
- [x] Filter tasks by assigned VA
- [ ] VA-specific login showing only their tasks

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
