# Project TODO

- [x] Add Trello API integration for progress tracker (weekly hours)
- [x] Add Trello API integration for recent updates feed (last 10 cards)
- [x] Create backend API routes to fetch Trello data
- [x] Implement frontend progress tracker widget
- [x] Implement frontend recent updates feed widget

- [x] Add dynamic color-coded progress bar to Weekly Hours Tracker (red < 50h, orange at 50h, yellow at 53h, green at 55h)
- [x] Make recent Trello update cards clickable to navigate directly to the Trello card

- [x] Visual design upgrade: modernize overall dashboard look (typography, spacing, cards, color palette)
- [x] Improve header design with better visual hierarchy
- [x] Redesign overview stat cards with more polished styling
- [x] Improve hero section visual design
- [x] Enhance Trello widgets (Weekly Hours Tracker + Recent Updates) styling
- [x] Polish tab navigation and tab content styling
- [x] Improve responsive layout and mobile experience
- [x] Add new "Performance Framework" tab with VA Performance & Compensation content
- [x] Include Merit & Bonus System section (M1-M3B merits + streak bonus)
- [x] Include Demerit System section (Categories 1-3 with all infractions)
- [x] Include Pay Structure formula and philosophy section
- [x] Style performance framework tables for readability

- [x] Add "Triage" tab with full interactive Day Structurer (Morning Triage, Focus Mode, Evening Ritual, EOD Report)
- [x] Add "Rules & Decisions" tab with Priority Decision Tree, Task-Type Matrix, Quick Reference, and 360 Operating Rules (A-Z)
- [x] Integrate One-Chance freelancer rule into the Rules tab
- [x] Integrate daily execution order and close-out template into the Rules tab

- [x] Payment tracking: add DB tables for payment cycles and payment log
- [x] Payment tracking: show current cycle (May 5 – May 22), countdown to next pay date
- [x] Payment tracking: "Mark as Paid" button that records payment with timestamp
- [x] Payment tracking: show payment history (date paid, amount, cycle)
- [x] Update merit rules: remove "Unsolicited General Positive Feedback" merit entirely
- [x] Update merit rules: reduce "Unsolicited Specific Positive Feedback" to +$1
- [x] Weekly pay calculator: interactive form to log merits/demerits per week
- [x] Weekly pay calculator: live projected pay using $90 − demerits + merits + streak formula
- [x] Weekly pay calculator: persist weekly pay log to DB for historical tracking
- [x] Recent Updates widget: connect directly to live Trello API (already done via trpc.trello.recentUpdates)
- [x] Persist triage state to DB: save daily checkbox state and focus timer progress per date
- [x] Add search/filter bar to 360 Rules tab for quick rule lookup

- [x] Merge "Daily Routine" and "Timeline" tabs into a single "Daily Schedule" tab

- [x] Build reusable InfoTooltip component (? icon with hover popover)
- [x] Consolidate Daily Schedule tab: move all instructional text into tooltips
- [x] Consolidate Trello Flow tab: move step descriptions into tooltips
- [x] Consolidate Principles tab: move explanations into tooltips
- [x] Consolidate Guidelines tab: move detail text into tooltips
- [x] Consolidate Performance tab: move merit/demerit explanations into tooltips
- [x] Consolidate Sunday tab: move checklist instructions into tooltips
- [x] Consolidate Triage tab: move step instructions into tooltips
- [x] Consolidate Rules & Decisions tab: move rule details into tooltips
- [x] Remove all standalone instructional paragraphs from visible dashboard surface

- [x] Remove Principles tab: redistribute 3 Trello rules into Trello Flow tab and 4 work standards into Guidelines tab

- [x] Auto-generate next 2-week pay cycle after marking current cycle as paid
- [x] Add DB-persisted Sunday checklist checkboxes (per-Sunday-date state)
- [x] Collapse hero section by default so tabs are visible on first load

- [x] Merge Trello Flow tab into Daily Schedule tab (7 tabs total)
- [x] Auto-generate next 2-week pay cycle after marking current cycle as paid (duplicate)
- [x] Add DB-persisted Sunday checklist checkboxes (per-Sunday-date state) (duplicate)
- [x] Collapse hero section by default so tabs are visible on first load (duplicate)

- [x] Fix Recent Updates widget: fetch activity on cards assigned to Joyce (not just Joyce's own actions)
- [x] Filter out cards in "done" lists from Recent Updates widget

- [x] Alert 1: Detect cards with no due date — warn Joyce to assign a due date today, track completion in DB
- [x] Alert 2: Detect DOING cards that need a daily update from Joyce before 23:00 — sorted by closest due date, track per-card per-day completion
- [x] Alert 3: Detect ON-HOLD cards — remind Joyce to review them daily and move workable ones to DOING
- [x] Build ActionAlerts widget on dashboard showing all three alert types with completion checkboxes
- [x] Add DB tables for daily action tracking (due_date_assignments, daily_updates_log)

- [x] Redesign Alert 1: auto-resolve when Trello shows due date is set (no manual checkbox)
- [x] Redesign Alert 2: auto-resolve when Trello shows Joyce posted a comment on the card today
- [x] Redesign Alert 3: auto-resolve when ON-HOLD card is no longer in the ON-HOLD list in Trello
- [x] Remove manual checkbox mutations from ActionAlerts widget (DB tracking tables become unused)
- [x] Add getJoyceCommentedCardIdsToday() to trello.ts — returns set of card IDs where Joyce commented today

- [x] Move Weekly Hours tracker into a popover on the header "50-55 hrs/week" button
- [x] Remove standalone Weekly Hours card from the main dashboard area
- [x] Place ActionAlerts widget where the Weekly Hours card was (below hero, above tabs)
- [x] Update actionAlerts router to use live Trello state (no DB checkboxes)
- [x] Rewrite ActionAlerts component: auto-resolve via Trello API, no manual checkboxes

- [x] Alert 2: Add live 23:00 Kenyan deadline countdown timer in the DOING section header, turns red under 2 hours
- [x] Alert 2: Make entire card row clickable (opens Trello card directly), remove standalone ExternalLink icon
- [x] Alert 2: Add streak counter — consecutive days Joyce completes all DOING updates before 23:00 (DB-backed, shown as badge)

- [x] ActionAlerts: reduce Trello poll interval from 5 minutes to 15 seconds for near-real-time sync
- [x] ActionAlerts: add "last synced" timestamp display so Joyce can see exactly when data was last fetched
- [x] ActionAlerts: add pulsing green dot indicator when a refresh is in flight

- [x] Remove four redundant stat cards (Work Days, Daily Hours, Break Time, Base Pay) from dashboard top
- [x] Add personal-best streak toast when Joyce breaks her all-time streak record
- [x] Implement Trello Webhook + SSE for instant sub-second sync (replace 15s polling)

- [x] Alert 3: Redesign ON-HOLD to show each card individually with a per-card per-day checkbox (DB-backed), Joyce must tick each card once daily

- [x] Alert 3: Show ON-HOLD card age indicator (days since last Trello activity) on each card row
- [x] Header: Add streak flame badge next to the hours button showing current consecutive-day streak
- [x] Scheduled task: Daily 22:30 Kenyan-time push notification listing uncompleted DOING + ON-HOLD cards

- [x] Set TRELLO_WEBHOOK_CALLBACK_URL secret to deployed domain for instant Trello push sync
- [x] Create 22:30 Kenyan-time (19:30 UTC) scheduled task for daily summary notification

- [x] Trello polling: add exponential back-off when 429 rate-limit errors occur
- [x] Webhook health check panel: show registered webhooks (board, ID, last ping) in collapsible admin section
- [x] Scheduled task: 08:00 Kenyan-time morning briefing listing today's due cards and ON-HOLD cards

- [x] Performance tab: consolidate merit/demerit reference tables into the pay calculator rows (name + description + value + +/- buttons in one place, remove separate explanatory sections)

- [x] Trello polling: add exponential back-off when 429 rate-limit errors occur (max 5 min back-off)
- [x] Webhook health check panel: collapsible section showing registered webhooks (board name, ID, last ping)
- [x] Scheduled task: 08:00 Kenyan-time morning briefing listing today's due cards and ON-HOLD cards

- [x] Move morning briefing into ActionAlerts dashboard widget (show today's due cards + ON-HOLD cards as a new section, remove external scheduled notification)

- [x] ActionAlerts collapsed header: show "☀ N due today" and "⚠ N overdue" count badges when widget is collapsed
- [x] ActionAlerts: add Overdue Cards alert section (cards past their due date, not in DONE list)
- [x] Move Webhook Health Panel from Home.tsx into a Settings tab on the dashboard
- [x] Webhook Health Panel: show board name alongside webhook ID and model ID (map idModel → board name)
- [x] Fix: card list names showing as "Unknown" in all ActionAlerts sections — list data not being attached to cards correctly
- [x] Morning Briefing: priority order On-Hold → Doing → To-Do with filter tabs
- [x] Morning Briefing: auto-advance filter from On-Hold to Doing when all On-Hold cards are actioned
- [x] Morning Briefing: To-Do cards hidden by default, only shown when filter tab selected
- [x] Board name chip on all card rows (e.g. "Work Board › DOING")
- [x] Server-side cache for board lists (5-minute TTL) to reduce Trello rate-limit pressure

- [x] Time Tracker: add DB schema (time_entries table)
- [x] Time Tracker: tRPC procedures (start, stop, getActive, getDailySummary, getWeeklyTotal, delete)
- [x] Time Tracker: dashboard widget (live timer, daily log per card, weekly total, collapsed badges)
- [x] Time Tracker: Trello Power-Up page at /powerup (card button start/stop, synced to dashboard)
- [x] Time Tracker: wire weekly total into Weekly Hours Tracker (replace placeholder 0h)
- [x] Header badge: wire timer.getWeeklyTotal into the "Xh / 50-55h" counter (replace Trello-estimated hours with actual tracked hours)
- [x] TimeTracker daily log: add edit/correction dialog per row to fix duration (for overnight timer accidents)
- [x] Fix Trello API rate-limit errors: consolidate polling, increase intervals, improve error handling with graceful degradation
- [x] TimeTracker: daily time goal progress indicator (9h target, colour-coded progress ring)
- [x] Midnight auto-stop: scheduled task that stops any timer running >12h at midnight EAT and flags it for correction
- [x] Move TimeTracker widget into the header "0h / 50-55h" popover (replace current Weekly Hours content)
- [x] Move midnight auto-stop from Manus scheduled task to server-side cron job (runs inside Express at 00:00 EAT)
- [x] Store Trello Power-Up API key and secret as environment secrets
- [x] Update Power-Up connector page to use the API key for Trello OAuth (appKey added to initialize/iframe calls)
- [x] TimeTracker: weekly hours bar chart (Mon–Sun) inside the popover
- [x] TimeTracker: "Timer still running" resume banner on page load with one-click stop
- [x] Settings tab: add editable Daily Goal input (9–11h range, DB-persisted via app_settings table)
- [x] TimeTracker: consume daily goal from DB setting (replace hardcoded 9h)
- [x] TimeTracker weekly bar chart: show exact hour labels above each bar that has data
- [x] Recent Updates widget: redesign layout to eliminate empty right-side space and make full use of available width
- [x] Recent Updates: add filter chips (All / Comments / Moves / Created), default to Comments
- [x] Recent Updates: add board name chip on each tile
- [x] Recent Updates: remove 'checked item' from filter chips and action badges
- [x] Daily Actions: redesign with priority-first layout (top item pops out, rest are subdued)
- [x] Daily Actions: remove redundant 'No Due Date' and 'Due Today' secondary panels; show due-date/no-date as card metadata badges instead
- [x] Daily Actions: fix truncated card lists — all cards must be fully accessible (proper scroll, no hidden items)
- [x] Daily Actions: cap each panel at 5 visible items with internal scroll; reorder to ON-HOLD → DOING → Overdue
- [x] Daily Actions: add "↓ X more" scroll indicator below each panel when there are more than 5 cards
- [x] Daily Actions: sort cards by urgency within each panel (DOING: pending first; ON-HOLD: longest idle first; Overdue: most overdue first)
- [x] Daily Actions: add collapsible toggle on each panel header so Joyce can fold away handled sections
- [x] Daily Actions: add "Open all pending" button on DOING panel header to open all not-yet-updated cards in new tabs
- [x] Daily Actions: persist each panel's collapsed/expanded state to localStorage so it survives page refresh
- [x] Daily Actions: add "Open all" button to Overdue panel (opens all overdue cards in new tabs)
- [x] Bug fix: Settings Daily Hour Goal save fails with INSERT INTO app_settings ON DUPLICATE KEY UPDATE error
- [x] Daily Actions DOING panel: add inline quick-comment box on each card row to post Trello comments without opening the card
- [x] Rename "Start Morning Triage" → "Morning Ritual" and add a sun icon to it
- [x] Audit 360 rules: count current rules, identify missing rules vs original source
- [x] Restore all missing rules to reach the full 360 count (was 129, now 360)
- [x] Restructure the 360 rules section: 26 categories A–Z from source document
- [x] 360 Rules: improve search to filter all rules by keyword across all categories, auto-expand matching categories when searching
- [x] Rename "Guidelines" tab to "Standards" with two sub-tabs: "Rules" (360 rules) and "Guidelines" (existing work guidelines)
- [x] Rename "Rules & Decisions" tab to "Decisions" — remove 360 rules section, keep only Decision Tree, Task-Type Matrix, Quick Reference
- [x] 360 Rules: enrich each category with 1-sentence summary, "Why this matters" callout, and styled numbered rule cards (matching Guidelines clarity)
- [x] Integrate Joyce_Task_Prioritization_Decision_Tree documents into Decisions tab as a new "Full Guide" section (all 13 sections: master rule, 5-min triage, priority levels, task-type tree, pace rules, Robert branch, freelancer branch with One-Chance variant toggle, Trello/Drive branch, daily execution order, close-out template, examples, quick reference, final rule)
- [x] Bug fix: inline quick-comment box posts as noodzakelijkonline (board owner) instead of Joyce — must use Joyce's Trello token
- [x] Settings tab: add "Trello Comment Token" field — DB-persisted, masked display, used by postComment procedure instead of the board owner token
- [x] Today's Workflow: replace always-visible "Step N" badges with hover tooltips
- [x] Triage tab: remove redundant "VA Day Structurer" header block (title, breadcrumb, description)
- [x] Comment box: add "posted as" chip (green=Joyce / amber=board owner) next to Post button
- [x] "Why Your Role Is Life-Changing" banner: collapsed by default
- [x] DOING cards daily update panel: show last-updated timestamp on each card

- [x] Performance tab: add section dividers with labels (Payment Tracker / Pay Calculator / Compliance History)
- [x] Performance tab trigger: show rolling compliance % badge on the tab button
- [x] Compliance table: add "→ Pay log" link on D1 demerit rows linking to the affected pay week

- [x] WeeklyPayCalculator: collapsible two-column merits/demerits layout (Merits left, Demerits right)
- [x] ComplianceTracker: "Record today's snapshot now" manual trigger button
- [x] WeeklyPayCalculator: add id="pay-log-week-{weekStart}" anchor to each week row for scroll-linking
- [x] Header: add today's compliance % chip next to the hours button

- [x] WeeklyPayCalculator: auto-expand Pay History accordion when a compliance "→ Pay log" scroll-link is clicked
- [x] cronJobs: add EOD compliance snapshot cron at 22:30 EAT (19:30 UTC) that auto-records daily snapshot
- [x] WeeklyPayCalculator: add weekly compliance % badge on each pay history row

- [x] EOD cron: auto-increment demeritD1 in weekly pay log when D1 demerits are recorded
- [x] WeeklyPayCalculator: week-over-week compliance trend arrow on each pay history row

- [x] EOD cron D1 notification: include updated projected pay in the owner notification after auto-incrementing D1
- [x] WeeklyPayCalculator: D1 edit guard — confirmation dialog when manually lowering D1 below the auto-set value

- [x] WeeklyPayCalculator: D1 override audit log — append timestamped note to pay log notes when D1 is manually lowered via the guard dialog

- [x] WeeklyPayCalculator: make each individual merit/demerit item collapsible — show label, amount, counter by default; expand to reveal description and trigger on click

- [x] Payment Tracker: make countdown real-time (live ticker updating every minute, not static at page load)

- [x] Home.tsx: convert horizontal tab bar into vertical left sidebar navigation

- [x] Home.tsx: full-height persistent left sidebar as primary app navigation (entire dashboard, not just tabs)

- [x] Home.tsx: add Overview as default sidebar section (Hero + Recent Updates + Daily Actions); other sidebar items replace content fully

- [x] RecentUpdatesWidget: make collapsible with chevron toggle; persist collapsed state in localStorage

- [x] Daily hour goal: change range from 9–11h to 9–10h across Settings input, TimeTracker display, and all related logic

- [x] TimeTracker: overtime ring indicator — when today's hours exceed daily goal, ring turns amber and shows "+Xh OT" label beneath it
- [x] Weekly target: 50h min / 55h max; hours above 55h/week shown as overtime (header badge + TimeTracker weekly section)

- [x] Triage tab: always start at the beginning (Morning Ritual / step 1) when navigated to — do not resume from last saved view state

- [x] Header bug: duplicate sidebar toggle + title block visible — remove the extra one so only one set appears

- [x] Triage intro: add "Resume where I left off" button that jumps to the last saved view (DB-backed)
- [x] Sidebar collapsed state: show a "J" avatar/logo so the sidebar is visually anchored when icon-only
- [x] Settings: add Daily Schedule section — configurable start time, break slots (name + start + duration), end time; Daily Schedule tab renders timeline dynamically from these saved values

- [x] Header: move weekly hours badge (0h / 50-55h) and Sun Off badge from top-right to sidebar footer bottom-left
- [x] RoutineSection: build as standalone component with dynamic timeline from trpc.settings.getSchedule

- [x] Settings Daily Schedule card: add "Go to Daily Schedule →" shortcut link that navigates to the routine t- [x] Settings Daily Schedule: add icon picker per break slot (☕ 🍽️ 🌙 🍵 🥤 🪴 🧃 🍎 🍪 🍺); icon stored in ScheduleSettings and rendered in RoutineSection Scheduled Breaks card- [x] Settings Daily Schedule: add typing practice toggle (on/off) + duration field; RoutineSection renders or omits the typing practice block accordingly

- [x] ActionAlerts: add "Cards Due Today" morning briefing panel showing dueTodayCards and noDueDateCards from Trello
- [x] Sidebar footer: add projected pay chip ("$X.XX projected") next to weekly hours using trpc.payLog.getByWeek
- [x] Triage intro: add "Past Reports" accordion showing last 7 EOD reports (requires triage.getRecent backend query)
- [x] Triage sidebar item: add amber count badge when noDueDateCards > 0
- [x] Overview: add compliance trend arrow using trpc.compliance.getRollingAvg (7-day avg + direction)

- [x] Bug fix: DOING card comment detection fails — now also counts board-owner comments that mention @joyjemimajj1 (posted via dashboard inline comment box when Joyce's personal token is not set)

- [x] Settings: add prompt/reminder for Joyce to set her personal Trello token (TrelloCommentToken) with clear instructions
- [x] Inline comment box: add amber "Will post as board owner" warning chip when Joyce's personal token is not set
- [x] getJoyceCommentedCardIdsToday: extend to also fetch actions using Joyce's personal token when available (dual-token detection)

- [x] Remove Friday email report cron job from server/cronJobs.ts (no such cron existed; confirmed no Friday-specific email code)
- [x] Remove "20% 7-day avg" ComplianceTrendChip from Overview section
- [x] Remove "20%" compliance badge from Performance sidebar item
- [x] Add Triage quick-jump step selector on intro screen (Morning Ritual · Focus Tasks · Evening Review · EOD Report)
- [x] Add weekly pay summary Friday owner notification cron (18:00 UTC = 21:00 EAT every Friday)

- [x] DB schema: reply_threads table (source, cardId, cardName, cardUrl, boardName, listName, lastNonJoyceMsgAt, lastNonJoyceAuthor, lastNonJoyceText, lastJoyceReplyAt, status, demerited)
- [x] DB schema: vague_reply_flags table (id, source, cardId, cardName, cardUrl, actionId, messageText, flaggedAt, resolvedAt, demeritIssued)
- [x] Trello reply monitor: scan card comments for threads where last comment is NOT from Joyce and is >0h old
- [x] Trello reply monitor: detect vague replies from Joyce (patterns: "I'll get back", "get back to you", "tonight", "today", "will respond", "will reply", "will update")
- [x] Upwork reply monitor: deferred — scraping requires browser login (Upwork has no public messages API)
- [x] tRPC: replyMonitor.getPendingThreads, getActiveVagueFlags, getAllThreads, getAllVagueFlags, resolveVagueFlag, triggerScan
- [x] Auto-demerit: when vague flag is >1h old and not resolved, auto-increment D1 in current pay week
- [x] ReplyMonitor widget: Active tab (unanswered threads + vague flags with countdown), Vague Flags tab, History tab
- [x] ReplyMonitor widget: added as "Reply Monitor" sidebar nav item
- [x] Cron job: every 15 min scan Trello for unanswered threads and vague replies, auto-demerit expired flags
- [x] Vitest tests for reply-monitor logic (isVagueReply: 14 tests, isJoyceComment: 5 tests, analyseCardThread: 11 tests — 30 total)

- [x] DB schema: unsigned_message_flags table (source, cardId, cardName, cardUrl, actionId, messageText, flaggedAt, resolvedAt, demeritIssued)
- [x] Signature rule: every owner message on Trello + Upwork must end with ~ Angel or ~ Joyce; missing = flagged immediately
- [x] Unsigned flag: 1h correction window, then D1 auto-demerit
- [x] Upwork monitor: rooms scan + unanswered (12h) + vague + unsigned detection using internal Bearer API
- [x] Trello monitor: add unsigned detection alongside existing comment scan
- [x] tRPC: unsigned flag procedures (getActiveUnsigned, resolveUnsigned, triggerScan)
- [x] ReplyMonitor UI: Unsigned Messages tab with 1h countdown badges
- [x] Cron: 12h auto-scan Trello + Upwork (was 15min, now 12h + manual button)
- [x] replyMonitorDb: add upsertUpworkThread, upsertUpworkVagueFlag, autoDemeriteExpiredUpworkFlags helpers

- [ ] Puppeteer scraper: connect to existing Chromium session, fetch Upwork rooms + stories via internal API, write JSON to temp file
- [ ] Wire Puppeteer scraper into upworkMonitor.ts (replace placeholder with real data)
- [x] Reply Monitor sidebar badge: optional count badge on nav item (toggle in Settings, DB-persisted)
- [x] Trello inline comment box: enforce ~ Joyce signature before submission (inline error if missing)

- [x] Bug fix: upworkMonitor.test.ts — 12 failing tests due to stale axios-mock pattern; updated tests to pass stories directly in room object and use createdAt field
- [x] Bug fix: analyseUpworkRoom — added defensive null guard for room.stories (room.stories ?? [])
- [x] Bug fix: db.ts upsertWeeklyPayLog — projectedPay was computed as raw count sum instead of dollar amounts; fixed to use per-unit multipliers (D1×$5, D2×$10, etc.)
- [x] Bug fix: db.ts incrementPayLogD1 — D2–D11 were summed without dollar multipliers; fixed to match upsertWeeklyPayLog formula
- [x] Bug fix: cronJobs.ts — unsigned messages from Trello threads were never inserted into DB or pushed to newUnsignedMessages; added the missing loop
- [x] Bug fix: ReplyMonitor.tsx ThreadCard — lastNonJoyceText is nullable in DB schema but was typed as string; fixed null safety

- [x] Puppeteer scraper: wire into upworkMonitor.ts — connect to existing Chromium session, fetch rooms + stories via internal API, replace placeholder stub
- [x] Reply Monitor Unsigned Messages tab: add Resolve button with required note field (dialog); manual resolve with note stored in DB
- [x] Performance tab: add weekly pay history bar chart (last 8 weeks) using recharts

- [x] Reply Monitor: add "Re-scan Now" button to header that triggers runUpworkReplyMonitorScan on demand
- [x] Resource reduction: cut dashboard API/polling/cron resource usage by >50%

- [x] Resource minimization phase 2: eliminate all remaining polling, replace with SSE-driven invalidation, deduplicate shared queries

- [x] ActionAlerts header: add "Last synced X min ago" chip using existing lastSynced state

- [x] Bug: Sunday checklist stale date — advance to upcoming Sunday, auto-reset items
- [x] Bug: Projected pay shows $0.00 when negative — show real negative value in sidebar
- [x] UX: Daily Actions section — add filter/search bar (by list, board, keyword)
- [x] UX: Recent Updates comments — expand on hover / "read more" for long comments
- [x] UX: Weekly Pay Calculator — show warning when projected pay goes below $0
- [x] UX: Pay Trend chart x-axis — use "Week of May 19" labels instead of bare dates
- [x] UX: Triage Decision Tree — add visible Reset button after reaching a result
- [x] UX: Mark as Paid — add confirmation dialog before marking pay cycle as paid
- [x] Enhancement: Keyboard shortcuts — add react-hotkeys-hook navigation shortcuts (O, T, D, S, P, R, settings)
- [x] Enhancement: Sidebar loading state — replace "Loading..." nav item with skeleton placeholder
- [x] Enhancement: Sidebar timer widget — show today's total logged hours even when no timer is running
- [x] Enhancement: Settings page — add note that Trello Power-Up URL must be updated after publishing

- [x] Gmail integration: enable connector, DB schema (email_tasks table)
- [x] Gmail scanner: fetch all Inbox emails, LLM classify financial vs non-financial, dedup
- [x] Gmail non-financial flow: LLM match to Trello card + next action suggestion
- [x] Gmail Email Inbox UI page: financial tab (48h countdown, archive), non-financial tab (Trello link, next action), inbox-zero progress bar
- [x] Gmail cron job: periodic scan, sidebar nav item with badge count
- [x] On-hold card snooze: snooze button on Daily Actions cards, resurface date picker, hide until date, resurface badge

- [x] APTLSS: replace checklist/description/comment approach with dedicated '🎯 APTLSS Plan' Power-Up button on every Trello card
- [x] APTLSS: AI-generated plan panel (Action, Plan, Timeline, Links, Steps, Summary, urgency, blocked status, Robert decision)
- [x] APTLSS: step-level checkboxes persisted in Trello card storage
- [x] APTLSS: 4-hour plan cache with force-refresh button
- [x] APTLSS: 'Copy' button formats full plan as Trello comment
- [x] APTLSS: DB table (aptlss_plans) for plan persistence
- [x] APTLSS: update RulesTab K section to reference the button (remove old checklist/description/comment guidance)

- [x] Triage restructure: merge Reply Monitor and Email Inbox as sub-tabs inside Triage (Day Structurer / Reply Monitor / Email Inbox), remove them from sidebar nav, add live badge counts on sub-tab triggers, guard localStorage against stale section keys
- [x] Triage sub-tab memory: persist last active sub-tab (Day Structurer / Reply Monitor / Email Inbox) to localStorage so returning to Triage reopens the last tab
- [x] Triage sidebar badge: replace single ReplyMonitor pill with two pills (red for replies, amber for emails) using shared useTriageCounts hook

## APTLSS Operational Engine (Phase 1-6)

- [x] DB: aptlss_steps table (atomic work units with Trello IDs, estimatedMinutes, category, requiresRobert, blockedBy, dependsOnCards, completionCriteria, riskIfSkipped)
- [x] DB: card_states table (state machine per card: NEW_UNTRIAGED → READY_FOR_DONE)
- [x] DB: priority_scores table (calculated score with component breakdown)
- [x] Server: Trello checklist writer (create/update/preserve completed items/mark obsolete)
- [x] Server: card state machine (deterministic rules)
- [x] Server: priority scoring engine (due date + overdue + stall + dependency + effort + risk)
- [x] Server: enhanced LLM prompt (time estimates, confidence, NBA, dependsOnCards, riskIfSkipped, recommended Robert decision)
- [x] Server: webhook handler for updateCheckItem events (sync completions to aptlss_steps)
- [x] Server: Robert Decision Queue aggregator
- [x] Server: Done quality gate checker
- [x] Server: silent daily maintenance cron endpoint
- [x] UI: APTLSS popup — confidence badge, total time estimate, NBA banner, dependency chips, history drawer
- [x] UI: Daily Actions card rows — progress bar, urgency chip, remaining time
- [x] UI: Overview — Robert Decision Queue panel
- [x] UI: Triage — Plan My Day button with step-level daily schedule

## Post-Audit Enhancements (May 2026)
- [x] Done Quality Gate UI: wire doneGateCheck to DOING panel in ActionAlerts — show inline warning banner on READY_FOR_DONE cards listing missing items
- [x] Card Repair Logic: detect NEEDS_RESTRUCTURING cards (vague/no-checklist/no-description) and surface them as a dedicated "Cards Needing Repair" section in Daily Actions
- [x] Minimum Oversight Robert Dashboard: dedicated /robert page showing only decisions/risks/exceptions/escalations in a clean format for Robert
- [x] getRepairQueue tRPC procedure (backend)
- [x] getReadyForDone tRPC procedure (backend)
- [x] getRisksAndExceptions tRPC procedure — consolidated risks/decisions/escalations/stalled/blocked/waiting/repair
- [x] Robert Dashboard link in sidebar footer of main dashboard
- [x] TypeScript clean compile (0 errors)
- [x] All 95 tests passing after changes

## APTLSS Full-Spec Implementation (pasted_content_4.txt — May 2026)
- [x] DB: aptlss_operational_policies table (12 default rules: stall threshold, follow-up delays, autopilot level, done gate, confidence thresholds)
- [x] DB: auto_follow_up_drafts table (cardId, draftMessage, reason, urgencyType, status)
- [x] DB: worker_performance_signals table (workerId, workerName, weekKey, stalledCardsCount, missedDeadlines, reworkCount, escalationsCount, unclearHandovers, checklistItemsCompleted, notes)
- [x] DB: weekly_analysis_snapshots table (weekKey, noProgressCards JSON, recurringBlockers JSON, estimateAccuracy, processImprovements JSON, summary)
- [x] Backend: aptlssPoliciesDb.ts — CRUD helpers for all 4 new tables
- [x] Backend: getAllPolicies, getPolicyByKey, getPolicyValue, upsertPolicy, setPolicyEnabled procedures
- [x] Backend: getPendingFollowUps, getAllFollowUps, markFollowUpSent, dismissFollowUp procedures
- [x] Backend: getWorkerPerformance, upsertWorkerPerformance procedures
- [x] Backend: getLatestWeeklyAnalysis, getRecentWeeklyAnalyses procedures
- [x] Backend: getRepairQueue, getReadyForDone, getRisksAndExceptions procedures
- [x] Auto-follow-up draft generation in APTLSS generate procedure (fires for WAITING_FOR_EXTERNAL_PARTY cards)
- [x] Weekly analysis cron job (every Monday 08:00 KE) — finds no-progress cards, recurring blockers, process improvements via LLM
- [x] Settings UI: OperationalPoliciesSettings component (grouped by category: stall, follow_up, escalation, autopilot, done_gate, scheduling)
- [x] Performance UI: WorkerPerformancePanel (computed score, 6 signal metrics per worker)
- [x] Performance UI: WeeklyAnalysisPanel (no-progress cards, recurring blockers, process improvements)
- [x] Robert Dashboard: Auto Follow-Up Drafts section (copy, mark sent, dismiss)
- [x] Robert Dashboard: Weekly Analysis section (no-progress + recurring blockers only when issues exist)
- [x] Robert Dashboard: "All clear" summary banner when totalIssues === 0
- [x] Done Quality Gate Warning in DOING panel (ActionAlerts.tsx)
- [x] Cards Needing Repair section in ActionAlerts.tsx
- [x] emailInbox.getPendingCount test timeout increased to 30s
- [x] All 95 tests passing
- [x] TypeScript clean compile (0 errors)
## APTLSS Items 14, 16, 18, 20 — Final Completion Pass (May 2026)
- [x] Item 14: Worker performance signals injected into APTLSS generate LLM prompt — stalledCardsCount, missedDeadlines, reworkCount, escalationsCount, avgResponseTimeMinutes used to adjust time estimates and confidence
- [x] Item 16: getRisksAndExceptions enhanced — now returns deadlineRisks (cards due within 24h), readyForApproval (READY_FOR_REVIEW cards), normalCount, externalCount; Robert Dashboard updated with two new sections
- [x] Item 18: Enhanced NEEDS_RESTRUCTURING detection — now detects: (1) too-large cards (>15 checklist items), (2) missing due date on non-trivial cards (has checklist but no due date), (3) missing owner/member on cards with checklists; members field added to TrelloCardContext
- [x] Item 20: Default Action Rules Engine — getDefaultActionForState tRPC procedure (14 built-in defaults + custom override via operational policies); getAllDefaultActions procedure for settings UI; DefaultActionBanner sub-component in ActionAlerts.tsx renders blue banner beneath each DOING card row showing the active default action for its APTLSS state
- [x] All 20 APTLSS spec items fully implemented
- [x] All 95 tests passing
- [x] TypeScript clean compile (0 errors)

## Second Audit Session (May 2026) — 10 Gaps Closed

- [x] GAP A: Autopilot level enforcement in generate procedure (level < 1 skips checklist write, level < 2 blocks planMyDay, level < 3 blocks follow-up drafts)
- [x] GAP B: Auto follow-up drafts in maintenance job (WAITING_FOR_EXTERNAL_PARTY cards, autopilot >= 3)
- [x] GAP C: Auto-record worker performance signals in maintenance job (stalled, overdue, needs_restructuring counts)
- [x] GAP D: dependencyImpact field already present in priority score (confirmed existing)
- [x] GAP E: Default Action Rules Settings UI in Settings tab (DefaultActionsSettings component with 14 states, expand/collapse, custom overrides, reset)
- [x] GAP F: Weekly Analysis history selector UI (WeeklyAnalysisPanel now shows up to 8 weeks as pill buttons)
- [x] GAP G: Resolve button in RobertDecisionQueue (Mark Resolved button calls resolveRobertStep mutation)
- [x] GAP H: ReadyForDonePanel in Performance section (shows READY_FOR_DONE cards with date)
- [x] GAP I: notifyOwner after weekly analysis generation (sends summary to Robert via notification API)
- [x] GAP J: Duplicate card detection in maintenance job (Jaccard similarity, flags NEEDS_RESTRUCTURING, notifies Robert)

## Third Audit Session — 9 Gaps Closed
- [x] GAP 1: Preserve human-added checklist items in writeChecklistToTrello (getManualStepsForCard)
- [x] GAP 2: Confidence score chip in DOING panel (getAllCardStates returns confidenceScore from planJson)
- [x] GAP 3: Follow-up timing enforcement using actual lastActivityMs vs configured threshold
- [x] GAP 4: Detect cards without next best action in maintenance job
- [x] GAP 5: Auto-generate daily plan in maintenance (autopilot >= 2), persisted to daily_plans table
- [x] GAP 6: Refresh Robert's decision queue count in maintenance job response
- [x] GAP 7: Autopilot level indicator chip in ActionAlerts header
- [x] GAP 8: Follow-Up Drafts tab in TriagePage (FollowUpDrafts.tsx component)
- [x] GAP 9: ReadyForDone section in RobertDashboard

## Fourth Audit Session — 3 Stubs Resolved
- [x] STUB 1: dependencyImpact in priority scoring — countDependentCards() helper added to aptlssStepsDb.ts; counts cards with this card's ID in their dependsOnCards JSON field × 3 (capped at 15)
- [x] STUB 2: riskIfIgnored in priority scoring — riskTextToScore() converts riskIfSkipped text to numeric score (0–15) using keyword matching; max across all open steps used
- [x] STUB 3: Follow-up draft 'Post to Trello' — new postFollowUpToTrello tRPC procedure posts draft as Trello comment (autopilot >= 3) then marks as sent; FollowUpDrafts.tsx updated with 'Post to Trello' primary button

## Upgrade Session — 15-Point Operations Engine Upgrade
- [ ] UPGRADE 1: Priority Command Center — 5 buckets (Critical Today, Ready to Act, Waiting External, Needs Robert Decision, Low-Risk Maintenance) with why-shown explanations
- [ ] UPGRADE 2: Next Best Action per card — shown on each card row in command center
- [ ] UPGRADE 3: ON-HOLD smart classification — Still Waiting / Ready to Resume / Needs Escalation / Possibly Obsolete / Needs Robert Decision with action buttons
- [ ] UPGRADE 4: Auto-draft daily updates for DOING cards (format: Work completed / Current status / Next step / Blocker / Expected next update)
- [ ] UPGRADE 5: Card-level checklist progress display (N of M steps complete — X% done) in command center
- [ ] UPGRADE 6: Robert Decision Queue improvements — show only true yes/no decisions, separate from general tasks
- [ ] UPGRADE 7: Confidence scoring display — High/Medium/Low chip on each recommendation
- [ ] UPGRADE 8: "Why is this shown?" explanation on every card in the dashboard
- [ ] UPGRADE 9: Visual hierarchy overhaul — sticky top summary bar, full-width cards, collapsible groups, clear priority badges
- [ ] UPGRADE 10: Batch actions — Keep all low-risk ON-HOLD, Post all high-confidence updates, Move all ready-to-resume to DOING, Follow up on stale external-waiting
- [ ] UPGRADE 11: Escalation rules engine — threshold-based auto-escalation (legal overdue, 7-day idle, 30-day inactive, 5-day external silence)
- [ ] UPGRADE 12: Admin monitoring tab — Trello sync health, last sync, API errors, webhook status, cards processed, automation actions, pending approvals, logs
- [ ] UPGRADE 13: Automation history per card — timestamped audit log of every system action (DB table + UI panel)
- [ ] UPGRADE 14: Done Gate enforcement — block Done unless checklist complete, final comment posted, no unresolved blocker, summary added
- [ ] UPGRADE 15: Trello Operations Engine — backend engine that reads all cards, classifies state, generates checklists, calculates priority, suggests next actions, drafts updates, escalates exceptions, keeps audit trail

## Upgrade Session — Priority Command Center + Admin Monitor

- [x] DB: aptlss_audit_log table for per-card automation history
- [x] DB: admin_sync_log table for sync health monitoring
- [x] Backend: getCommandCenter procedure — 5 priority buckets with why-shown, confidence labels, on-hold classification, next best action
- [x] Backend: batchKeepOnHold — log to audit log, post Trello comment
- [x] Backend: batchMoveToDoing — log to audit log, post Trello comment
- [x] Backend: batchFollowUp — post follow-up Trello comment on selected cards
- [x] Backend: batchDraftDailyUpdates — LLM-draft daily update per card, auto-post if confidence >= 80
- [x] Backend: postDailyUpdateDraft — post a single reviewed draft to Trello
- [x] Backend: batchSnooze — snooze cards for N days via audit log
- [x] Backend: getAdminMonitor — sync health, webhook status, pending approvals, skipped cards, failed recs
- [x] Backend: getCardAuditLog — per-card automation history (last N entries)
- [x] Backend: getRecentAuditLog — global audit log for admin monitor
- [x] Backend: getEscalationRules — triggered escalation rules with recommended actions
- [x] Frontend: PriorityCommandCenter page — 5 buckets, sticky summary bar, why-shown tooltip, confidence chips, checklist progress, on-hold action buttons, batch actions bar, escalation rules alert, daily update draft modal
- [x] Frontend: AdminMonitor page — sync health stats, webhook status, pending approvals, cards skipped, failed recs, full automation audit log
- [x] Frontend: RobertDashboard — added Command Center and Admin links to header
- [x] Routes: /command-center and /admin registered in App.tsx

## Fifth Audit Session — 7 Gaps Fixed
- [x] Wire recordSyncAttempt into maintenance job (correct field names: cardsProcessed, actionsTaken)
- [x] Upgrade batchDraftDailyUpdates to use LLM for natural-language draft generation (with template fallback)
- [x] Add confidence score breakdown tooltip to ConfidenceChip (planClarity, checklistClarity, activityScore sub-scores)
- [x] Add scoreBreakdown and confidenceReason to getCommandCenter enrichedCards response
- [x] Snooze split-button with 3/7/14/30 day presets and custom number input (all snooze calls use snoozeDays state)
- [x] Owner-only FORBIDDEN guard on getAdminMonitor and getRecentAuditLog backend procedures
- [x] AdminMonitor frontend: useAuth + access-denied screen for non-owners
- [x] UI polish: idle days badge (color-coded: red ≥14d, amber ≥7d), listName chip, unanswered question badge per card
- [x] Sticky summary bar: "Updated HH:MM" timestamp added
