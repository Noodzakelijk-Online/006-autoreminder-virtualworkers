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
