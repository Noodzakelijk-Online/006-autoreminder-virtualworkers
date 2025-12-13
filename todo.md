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
