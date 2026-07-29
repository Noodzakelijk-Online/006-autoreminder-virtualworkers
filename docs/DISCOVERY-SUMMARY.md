# VA Task Dashboard - Discovery Summary
## Complete Requirements from Founder Interview

---

# EXECUTIVE SUMMARY

## The Core Problem
The founder pays $90/week for 55 hours of virtual worker time but suspects they're not getting full value. The worker struggles with:
- Identifying what needs to be done
- Figuring out the right order
- Estimating how long things take
- Staying focused and productive

## The Solution
An "AI manager" that micromanages on the founder's behalf - providing structure, tracking time, and ensuring accountability without the founder needing to be involved day-to-day.

## The #1 Fear
**Hallucinations and mess** - the system creating wrong checklists, wrong time allocations, or garbage that creates more work instead of less.

---

# USERS & ROLES

## Founder (You)
- **Involvement level:** Check in whenever you want, no notifications needed
- **Primary need:** Confidence that things are working, visibility into planned vs actual time
- **Dashboard shows:** Cards with accurate checklists, time allocations, daily progress, variance tracking

## Virtual Worker (Joyce)
- **Primary user:** Uses the tool all day
- **Primary need:** Know what to do, in what order, with clear time expectations
- **Interaction:** Marks tasks complete in Trello, logs actual time, can modify breakdowns if needed

---

# THE GOOD DAY

**Morning:**
1. Worker receives email briefing with today's tasks
2. Tasks total 9.5-10 hours of allocated work
3. Clear priority order from system

**Throughout day:**
1. Works through tasks in priority order
2. Marks steps complete in Trello (syncs to dashboard)
3. Logs actual time per step
4. If blocked → card moves to "On Hold"
5. If finishes early → pulls more work automatically

**End of day:**
1. All tasks completed within allocated time
2. System shows planned vs actual
3. System adjusts next day if needed

---

# TRELLO INTEGRATION

## Structure
- **29 workspaces**, ~359 cards total
- **4 lists per board:** To Do → Doing → On Hold → Done
- Worker only works on cards **assigned to her**
- No special labels or custom fields

## Card Content (varies wildly)
- Some: Just a title
- Some: Title + brief description
- Some: Detailed with attachments and comments
- **All relevant external info should be attached to the card** (worker's responsibility)

## System Behavior
- **Writes checklists directly to Trello cards**
- **Replaces existing checklists** (not merge)
- Worker marks complete in Trello → syncs to dashboard
- Worker moves cards between lists manually
- **Real-time sync** with Trello
- System does NOT create new cards

---

# CHECKLIST GENERATION

## What the System Must Do
1. Read ALL card context:
   - Title
   - Description
   - All attachments (any type)
   - All comments
   - Cross-reference with related cards

2. Generate accurate breakdown:
   - Realistic steps (not bogus)
   - Realistic order (not bogus)
   - Realistic time allocations (not bogus)

3. Extract deadlines from content:
   - Due dates from card
   - Deadlines mentioned in attachments (e.g., court documents)
   - Deadlines in comments

## What the System Must NOT Do
- Generate if insufficient information (ask worker to add context first)
- Hallucinate steps that aren't grounded in card content
- Create overly prescriptive "how to" instructions (just WHAT and HOW LONG)
- Invent stakeholders or requirements not in the card

## Living Document
- Checklist is continuously monitored
- If new comments/attachments added → system can add more steps
- If worker modifies breakdown → system learns from it

---

# TIME TRACKING

## How It Works
1. Each step has time estimate visible in checklist
2. Worker clicks "done" → enters actual minutes (minimal friction)
3. No notes required, just time
4. System shows variance: allocated vs actual

## Tolerance
- **25% over estimate** is where concern starts
- System tracks this automatically
- Founder sees discrepancy in dashboard

## Learning
- Track AI estimation accuracy over time
- If consistently over/underestimating → apply global correction
- Feed actual outcomes back to AI for future estimates
- **No category-based learning** (tasks too varied)
- Conservative high estimates when uncertain

## Validation Challenge
- Worker uses TeamViewer on founder's PC AND her own laptop
- Traditional time tracking won't work
- Must rely on self-reported time
- System should sanity-check against Trello activity timestamps

---

# PRIORITIZATION

## How Priority is Determined
- System decides based on multiple factors
- **Due dates are critical** (especially from external sources)
- Worker sees priority order, follows it
- Worker can work 9.5-11 hours/day (flexibility)

## Urgent Tasks
- Founder can add urgent task mid-day
- Interrupts current queue immediately
- Other tasks shift to accommodate
- Worker can extend day up to 11 hours

---

# EDGE CASES

## Sparse Cards (just a title)
- System asks worker to add context first
- Does NOT guess or generate rough breakdown

## Blocked Tasks
- Move to "On Hold" list
- Retry next day (24-48h wait typical)
- Clock pauses on blocked tasks

## Worker Sick/Unavailable
- Worker marks unavailable in system
- System automatically reschedules tasks

## Running Behind
- System handles internally
- Adjusts next day automatically
- Founder sees in end-of-day summary (option C)

## Finishes Early
- Worker pulls more work automatically

## Scope Creep Mid-Task
- Handled by time variance tracking
- Large difference between allocated vs actual is visible

---

# COMMUNICATION

## Worker Questions
- Asked in Trello card comments
- System monitors comments and learns from evolving discussion
- No separate Q&A system needed

## Morning Briefing
- Sent to worker's email
- Contains today's tasks with priority order

## Founder Dashboard
- Check whenever you want
- Shows: Progress, variance, completed tasks
- No push notifications

---

# CALIBRATION & LEARNING

## Timeline
- Should work well from day 1
- 1-2 weeks calibration acceptable if needed

## Approach
- No category-based calibration (tasks too varied)
- Track overall AI accuracy
- Apply global correction if needed
- Feed outcomes back to AI context
- Learn from worker's modifications to breakdowns

## Uncertainty Handling
- Use conservative high estimate
- Don't flag for review (minimize friction)

---

# WHAT SUCCESS LOOKS LIKE

## For Founder
- Confidence that 55 hours/week of actual work is happening
- Visibility into what's being done and how long it takes
- Data for conversations if productivity is low
- No day-to-day involvement required

## For Worker
- Clear daily task list with priorities
- Know exactly what to do and how long it should take
- Simple time logging (click done, enter minutes)
- Can modify breakdowns if needed (system learns)

## For the System
- Accurate checklists grounded in card content
- Realistic time estimates
- No hallucinations or garbage
- Continuous improvement from actual data

---

# MUST HAVE vs NICE TO HAVE

## Must Have (v1)
1. Full Trello context extraction (title, description, attachments, comments)
2. Accurate checklist generation (no hallucinations)
3. Realistic time estimates (conservative when uncertain)
4. Write checklists to Trello
5. Real-time sync with Trello
6. Time logging per step (actual vs estimated)
7. Variance tracking and display
8. Priority ordering of tasks
9. Morning email briefing
10. Founder dashboard with progress visibility

## Nice to Have (v2+)
1. Cross-card relationship detection
2. Deadline extraction from attachments
3. Learning from worker modifications
4. Sick day handling
5. Automatic "pull more work" when done early
6. On Hold list automation

---

# DESIGN PRINCIPLES

1. **Trello is source of truth** - all task data lives there
2. **No hallucinations** - only generate from actual card content
3. **Conservative estimates** - when uncertain, estimate high
4. **Minimal friction** - worker just clicks done and enters time
5. **Living checklists** - update as card evolves
6. **Learn from reality** - improve from actual outcomes
7. **Founder hands-off** - system manages, founder observes
8. **Worker empowered** - can modify breakdowns, system learns

---

# ANTI-PATTERNS TO AVOID

1. ❌ Generating checklists from sparse cards
2. ❌ Creating "how to" instructions (just what and how long)
3. ❌ Category-based time estimation (tasks too varied)
4. ❌ Requiring founder approval for breakdowns
5. ❌ Complex time logging (timers, notes, etc.)
6. ❌ Creating new Trello cards
7. ❌ Merging with existing checklists (replace instead)
8. ❌ Push notifications to founder

---

# OPEN QUESTIONS FOR IMPLEMENTATION

1. How to extract text/content from various attachment types?
2. How to detect deadlines in unstructured text (court documents, etc.)?
3. How to determine "related cards" for cross-reference?
4. What's the exact format of the morning email briefing?
5. How to handle real-time sync performance with 29 workspaces?
6. What's the threshold for "insufficient information" on a card?

---

# NEXT STEPS

1. Review this summary for accuracy
2. Clarify any open questions
3. Update ATIS specification based on discovery
4. Begin implementation with focus on:
   - Full context extraction (the foundation)
   - Accurate checklist generation (the core value)
   - Time tracking and variance display (the accountability)

---

*Document created: December 2024*
*Based on: 53 discovery questions with founder*
