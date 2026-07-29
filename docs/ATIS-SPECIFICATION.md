# ADAPTIVE TASK INTELLIGENCE SYSTEM (ATIS)
## Complete Technical Specification v1.0

---

# EXECUTIVE SUMMARY

ATIS is an intelligent task management system that:
1. Generates realistic, actionable task breakdowns from Trello cards
2. Tracks actual time and outcomes against estimates
3. Learns from data to continuously improve accuracy
4. Provides prioritization and capacity planning
5. Handles real-world complexity (blockers, scope changes, interruptions)

**Core Principle:** Trello data is the source of truth. AI fills gaps with trained knowledge. The system learns from YOUR data to get smarter over time.

---

# TABLE OF CONTENTS

1. [System Architecture](#1-system-architecture)
2. [Context Engine](#2-context-engine)
3. [Reasoning Engine](#3-reasoning-engine)
4. [Learning Engine](#4-learning-engine)
5. [Output Engine](#5-output-engine)
6. [Prioritization System](#6-prioritization-system)
7. [Capacity Planning](#7-capacity-planning)
8. [State Management](#8-state-management)
9. [Quality & Outcome Tracking](#9-quality--outcome-tracking)
10. [Communication System](#10-communication-system)
11. [Interruption Handling](#11-interruption-handling)
12. [Skill & Development Tracking](#12-skill--development-tracking)
13. [Card Quality Feedback](#13-card-quality-feedback)
14. [Onboarding System](#14-onboarding-system)
15. [Data Models](#15-data-models)
16. [User Flows](#16-user-flows)
17. [API Specifications](#17-api-specifications)
18. [Implementation Notes](#18-implementation-notes)

---

# 1. SYSTEM ARCHITECTURE

## 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ATIS SYSTEM                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   CONTEXT    │  │  REASONING   │  │   LEARNING   │  │    OUTPUT    │ │
│  │   ENGINE     │→ │   ENGINE     │→ │    ENGINE    │→ │    ENGINE    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
│         ↑                                    ↑                ↓          │
│         │                                    │                │          │
│  ┌──────┴───────────────────────────────────┴────────────────┴───────┐  │
│  │                        DATA LAYER                                  │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │  │
│  │  │ Trello  │ │Breakdowns│ │Time Logs│ │Patterns │ │ Workers │     │  │
│  │  │  Sync   │ │         │ │         │ │         │ │         │     │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     WORKFLOW SYSTEMS                               │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐     │  │
│  │  │Prioritizer │ │ Capacity   │ │   State    │ │   Q&A      │     │  │
│  │  │            │ │ Planner    │ │  Manager   │ │  System    │     │  │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SYSTEMS                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                     │
│  │   Trello    │  │  Dashboard  │  │Notifications│                     │
│  │    API      │  │     UI      │  │   (Email)   │                     │
│  └─────────────┘  └─────────────┘  └─────────────┘                     │
└─────────────────────────────────────────────────────────────────────────┘
```

## 1.2 Core Principles

1. **Trello is Source of Truth** - All task data originates from Trello. ATIS enhances, never replaces.

2. **No Hallucination** - AI uses only information from cards + trained knowledge. Never invents facts.

3. **Admit Uncertainty** - When unclear, flag it. Don't guess and produce garbage.

4. **Learn from Reality** - Every completed task feeds back into the system.

5. **Preserve Progress** - Never lose completed work when regenerating breakdowns.

6. **Accurate Data Over Easy Data** - Design for truth, not convenience.

---

# 2. CONTEXT ENGINE

## 2.1 Purpose

Gather and synthesize ALL available information about a task before generating a breakdown.

## 2.2 Data Collection Layers

### Layer 1: Card Data
```
- Card ID, Name, Description
- Labels (with meanings)
- Due date
- List position (workflow stage)
- Assigned members
- Custom fields
- Existing checklists (with completion status)
- Activity log (all changes with timestamps)
```

### Layer 2: Attachments
```
For each attachment:
- Type detection (document, spreadsheet, image, link, email)
- Content extraction:
  - Documents: Full text + structure (headings, sections)
  - Spreadsheets: Data structure + key figures
  - Images: Description + OCR text
  - Links: Page title + meta + main content (if accessible)
  - Emails: Sender, recipient, subject, body, action items
- Summary generation
```

### Layer 3: Comments
```
- All comments with authors and timestamps
- Chronological narrative
- Extracted: Questions asked, answers given, decisions made
- Identified: Clarifications, scope changes, blockers mentioned
```

### Layer 4: Board Context
```
- All other cards on board
- List structure (workflow stages)
- Board description
- Board labels and meanings
- Common patterns on this board
```

### Layer 5: Cross-Card Relationships
```
Identify relationships:
- Explicit: Card links, mentions
- Implicit:
  - Same project (naming patterns, labels)
  - Dependencies (sequential work)
  - Similar tasks (comparable scope/type)
  - Blocking/blocked relationships
```

### Layer 6: Historical Context
```
- Similar completed cards (by description similarity)
- How were they broken down?
- How long did they actually take?
- What issues arose?
- Worker's history with similar tasks
```

## 2.3 Trello Activity Cross-Reference

**Purpose:** Validate self-reported times against Trello activity.

```
Track:
- When card was opened/viewed
- When checklist items were checked
- When comments were added
- When attachments were added

Use for:
- Sanity check on reported times
- Detect likely under-reporting
- Infer work patterns
```

## 2.4 Context Document Output

```
CONTEXT DOCUMENT
================

CARD IDENTITY
-------------
Card: [Name]
Board: [Board Name] > [List Name]
Created: [Date] by [Person]
Due: [Date] or "Not set"
Labels: [List]
Assigned: [Workers]

CORE REQUEST
------------
[Extracted/summarized core ask - what needs to be done]

DELIVERABLE
-----------
Type: [Document/Email/Decision/Action/System/Other]
Format: [Specific format if known]
Recipient: [Specific person - never "stakeholders"]

KNOWN FACTS (from card data)
----------------------------
- [Fact 1] (source: description)
- [Fact 2] (source: attachment "file.pdf")
- [Fact 3] (source: comment by X on date)
...

ATTACHMENT SUMMARIES
--------------------
1. [filename] - [type] - [summary]
2. [filename] - [type] - [summary]
...

COMMENT NARRATIVE
-----------------
[Chronological summary of discussion]
Key decisions: [List]
Open questions: [List]

RELATED CARDS
-------------
- [Card name] - Relationship: [depends_on/blocks/similar/same_project]
- [Card name] - Relationship: [...]
...

HISTORICAL REFERENCE
--------------------
Similar completed: [Card name]
- Took: [X hours]
- Steps: [count]
- Issues: [summary]

EXISTING PROGRESS
-----------------
Checklist items completed:
- [x] [Item 1]
- [x] [Item 2]
Items to preserve: [count]

AMBIGUITY ASSESSMENT
--------------------
Clearly specified: [List what's clear]
Implied: [List what's implied]
Unknown: [List what's missing]
Blockers: [List anything that prevents proceeding]

CONFIDENCE: HIGH / MEDIUM / LOW
Reason: [Why this confidence level]
```

---

# 3. REASONING ENGINE

## 3.1 Purpose

Think through tasks like a competent human would - simulate the work mentally, then articulate it as concrete steps with realistic estimates.

## 3.2 Core Principles

1. **Simulate, Don't Categorize** - Walk through the work mentally, don't slot into predefined types.

2. **Concrete Over Abstract** - Specific actions, not vague verbs.

3. **Include the Invisible** - Reading time, thinking time, fixing mistakes, context switching.

4. **Acknowledge Uncertainty** - Flag what's unclear, don't guess.

5. **Preserve Human Agency** - Create decision points, don't decide for humans.

## 3.3 Reasoning Process

### Step 1: Goal Crystallization

```
Input: Context Document

Process:
1. What is actually being asked?
2. What is the tangible deliverable?
3. Who receives it?
4. How do we know it's good? (success criteria)
5. What constraints exist?

Output:
GOAL
----
Deliverable: [Specific tangible output]
For: [Specific person]
Success: [Concrete criteria]
Constraints: [List]

Validation:
- Is deliverable concrete?
- Is recipient specific (not "stakeholders")?
- Would someone else understand "done"?
```

### Step 2: Mental Simulation

```
Process:
1. Imagine sitting down to start RIGHT NOW
2. What's the very first action?
3. Then what? Then what? (continue until done)
4. Note every action, decision, wait point

Capture:
- Every action taken
- Every decision point
- Every piece of information needed
- Every tool/system used
- Every wait/dependency

Output:
MENTAL WALKTHROUGH
------------------
1. [First action]
2. [Second action]
...
n. [Final action]

Decision points: [List]
Information needed: [List]
Dependencies: [List]
```

### Step 3: Step Formulation

```
Rules for Good Steps:
- One action per step
- Specific object (not "the document" but "Q4 report draft")
- Clear completion state
- 15 min to 2 hours duration
- No hidden sub-steps

Naming Format:
[ACTION VERB] + [SPECIFIC OBJECT] + [QUALIFIER if needed]

Good: "Draft email to client re: project timeline"
Bad: "Handle client communication"

Good: "Research competitor pricing (top 5 competitors)"
Bad: "Look into competitors"

Action Verbs:
- Finding: Search, Find, Locate, Identify
- Reading: Read, Review, Scan, Analyze
- Creating: Write, Draft, Create, Design, Build
- Modifying: Edit, Update, Revise, Fix
- Communicating: Send, Email, Message, Call
- Organizing: Sort, Organize, Structure, Arrange
- Deciding: Decide, Choose, Select, Evaluate
- Checking: Verify, Validate, Check, Test, Proofread
```

### Step 4: Time Estimation

```
Process (for each step):
1. Visualize doing this step
2. Consider:
   - Volume of content/work
   - Thinking vs mechanical work
   - What could slow this down?
   - Realistic pace, not ideal pace
3. Estimate in minutes
4. Add buffer for unexpected (10-20%)

Estimation by Simulation:
- Don't use formulas or multipliers
- Mentally walk through: "Open browser, search for X, read through results, take notes..."
- Feel the weight of the work
- Include invisible work (re-reading, fixing, context-switching)

Sanity Checks:
- No step > 4 hours (break it down)
- No step < 10 minutes (too granular)
- Total proportional to task importance
```

### Step 5: Sequence Validation

```
Check Dependencies:
- Can each step be done after previous steps complete?
- Does each step produce something needed later?
- Any circular dependencies?

Check Logic:
- Gathering before analyzing?
- Analyzing before deciding?
- Deciding before creating?
- Creating before reviewing?
- Reviewing before delivering?

Identify Parallel Opportunities:
- Which steps have no dependencies?
- What can be done while waiting?
```

### Step 6: Completeness Check

```
Verify:
- All steps completed = deliverable done?
- Any gaps between steps?
- Final step actually delivers/completes?
- Total time proportional to importance?

Common Missing Steps:
- Review before sending
- Get approval if needed
- Format/polish deliverables
- Save/backup important work
- Communicate completion
```

### Step 7: Clarity Check

```
For Each Step:
- Action verb specific? (not "handle", "manage")
- Object specific? (not "the document")
- Scope clear?
- Completion obvious?

Flag Vague Language:
- "Handle" → What specifically?
- "Manage" → What actions?
- "Deal with" → How?
- "Stakeholders" → Who specifically?
- "Various" → Which ones?
- "Etc." → List them
```

### Step 8: Uncertainty Documentation

```
Output:
KNOWN UNKNOWNS
--------------
- [Unknown] → Assumed: [X] | Impact if wrong: [Y]
- [Unknown] → BLOCKER: Cannot proceed

ESTIMATION CONFIDENCE
---------------------
High confidence: [steps]
Medium confidence: [steps] - because: [reason]
Low confidence: [steps] - because: [reason]

Overall: HIGH / MEDIUM / LOW
```

### Step 9: Calibration Application

```
If historical data exists:
1. Apply worker calibration factor
2. Apply pattern calibration (if matched)
3. Apply board calibration
4. Document adjustments made

If no historical data:
1. Mark as "uncalibrated"
2. Apply conservative buffer (+20%)
3. Flag for accelerated feedback collection
```

## 3.4 Output Format

```
TASK BREAKDOWN
==============
Card: [Name]
Generated: [Timestamp]
Version: [N]

GOAL
----
[Goal statement]
Deliverable: [What]
For: [Who]
Success: [Criteria]

STEPS
-----
[ ] 1. [Description] | Est: XXm | Conf: High
[ ] 2. [Description] | Est: XXm | Conf: High
[x] 3. [Description] | Est: XXm | PRESERVED
[ ] 4. [Description] | Est: XXm | Conf: Medium
...

TOTAL: Xh Ym

PRESERVED FROM PREVIOUS
-----------------------
[Count] items carried over (marked [x])

ASSUMPTIONS
-----------
- [Assumption 1]
- [Assumption 2]

NEEDS CLARIFICATION
-------------------
- [Item if any]

CONFIDENCE: HIGH / MEDIUM / LOW
[Explanation]

CALIBRATION
-----------
Applied: [Yes/No]
Factors: [Worker: X, Pattern: Y, Board: Z]
Raw estimate: [Before calibration]
```

---

# 4. LEARNING ENGINE

## 4.1 Purpose

Capture reality and continuously improve estimation accuracy based on actual data.

## 4.2 Data Capture

### Per Step Completion

```
STEP COMPLETION EVENT
=====================
Identity:
- step_id, breakdown_id, card_id, worker_id

Timing:
- estimated_minutes: AI prediction
- actual_minutes: Worker reported
- timer_minutes: Timer recorded (if used)
- trello_activity_minutes: Inferred from Trello timestamps
- variance: actual / estimated
- variance_category: accurate|slight_over|slight_under|significant_over|significant_under

Timestamps:
- started_at: When work began
- completed_at: When marked done
- elapsed_clock_minutes: Wall clock time

Context:
- step_description: Text
- step_position: Order in breakdown
- was_modified: Did worker edit before doing?
- original_description: If modified

Quality:
- completed_correctly: First time, no revisions?
- revision_count: How many redos

Feedback:
- variance_reason: Why different than expected
- worker_comment: Free text
```

### Per Breakdown Completion

```
BREAKDOWN COMPLETION EVENT
==========================
Identity:
- breakdown_id, card_id, worker_id

Timing:
- total_estimated: Sum of estimates
- total_actual: Sum of actuals
- overall_variance: actual / estimated
- calendar_duration: First start to last complete

Execution:
- steps_as_planned: Count
- steps_modified: Count
- steps_added: Count
- steps_skipped: Count

Outcome:
- deliverable_accepted: yes/no/revisions_needed
- revision_rounds: Count
- final_accepted_at: Timestamp

Feedback:
- accuracy_rating: 1-5
- missing_steps: Free text
- unnecessary_steps: Free text
- unclear_steps: Free text
- general_feedback: Free text
```

## 4.3 Time Validation

### Cross-Reference Sources

```
1. SELF-REPORTED
   - Worker enters time manually
   - Quick select: "About right" / "Took longer" / "Was faster"
   - Exact entry: X minutes

2. TIMER
   - Optional start/stop timer
   - More accurate than recall
   - Captures actual work duration

3. TRELLO ACTIVITY
   - Card opened timestamp
   - Checklist item checked timestamp
   - Comments added timestamps
   - Infer work windows

4. PATTERN DETECTION
   - Compare reported vs timer vs Trello
   - Flag discrepancies
   - Identify likely under/over reporting
```

### Validation Logic

```
IF timer_used:
  primary_source = timer_minutes
  validate_against = trello_activity
ELSE:
  primary_source = self_reported
  validate_against = trello_activity

IF abs(primary - validate) > 30%:
  flag_for_review = true
  confidence = low
ELSE:
  confidence = high

Store all sources for analysis
```

## 4.4 Pattern Recognition

### Worker Patterns

```
WORKER LEARNING PROFILE
=======================
Overall:
- calibration_factor: e.g., 1.35 (takes 35% longer)
- calibration_confidence: high/medium/low
- sample_size: data points
- trend: improving/stable/worsening

By Time of Day:
- morning_variance (before noon)
- afternoon_variance (noon-5pm)
- evening_variance (after 5pm)

By Day of Week:
- monday_variance through friday_variance

By Complexity:
- simple_steps_variance (<30m estimated)
- medium_steps_variance (30-90m)
- complex_steps_variance (>90m)

By Position:
- first_step_of_day_variance
- last_step_of_day_variance
```

### Task Patterns

```
TASK PATTERN
============
Identification:
- pattern_id
- description: Human readable
- matching_keywords: Trigger words
- matching_context: Other signals

Statistics:
- sample_size
- average_actual_minutes
- median_actual_minutes
- percentile_10, percentile_90
- average_variance

Characteristics:
- typical_step_count
- common_substeps: Usually appear
- common_issues: Often go wrong
- common_additions: Often added during execution

Confidence: high/medium/low
```

### Board Patterns

```
BOARD PATTERN
=============
- board_id, board_name
- total_completed_tasks
- average_complexity
- average_accuracy
- board_calibration_factor
- common_task_types
- common_missing_steps
```

## 4.5 Calibration Application

```
CALIBRATION PROCESS
===================

1. START with AI raw estimate

2. WORKER CALIBRATION (if ≥10 data points)
   - Multiply by worker's calibration_factor
   - Weight recent data more heavily

3. PATTERN CALIBRATION (if pattern matched)
   - Blend with pattern's average_actual
   - Weight by pattern confidence and sample size

4. BOARD CALIBRATION (if ≥20 data points)
   - Apply board_calibration_factor
   - Lower weight than worker calibration

5. TIME-OF-DAY ADJUSTMENT (if data supports)
   - Adjust based on scheduled time

6. OUTPUT
   - Point estimate: X minutes
   - Range: Y to Z minutes (80% confidence)
   - Basis: Which calibrations applied
```

## 4.6 Cold Start Handling

```
NEW WORKER (< 10 data points):
- Use AI general knowledge for estimates
- Apply conservative buffer (+30%)
- Mark as "calibration period"
- Require time logging (no skipping)
- More frequent feedback prompts
- Show progress: "Calibration: X% complete"

NEW TASK TYPE (no pattern match):
- Use AI reasoning only
- Mark as "no historical data"
- Weight early data points 2x for learning
- Allow founder to seed: "Tasks like this typically take X"

NEW BOARD (< 20 data points):
- No board calibration applied
- Learn from early tasks
- Inherit from similar boards if available
```

## 4.7 Continuous Improvement

### Daily Processing
```
- Aggregate completion events from past 24 hours
- Update worker calibration factors
- Update pattern statistics
- Flag anomalies for review
```

### Weekly Processing
```
- Recalculate all factors with full history
- Prune weak patterns (insufficient data)
- Strengthen strong patterns
- Generate accuracy report
- Identify systematic issues
```

### Feedback to Reasoning
```
Based on learning data:
- "Tasks like X typically take longer" → Add to reasoning context
- "Step Y often added" → Include in checklist prompts
- "Sequence Z often reordered" → Adjust default logic
- "Worker W has specific patterns" → Include in worker context
```

---

# 5. OUTPUT ENGINE

## 5.1 Purpose

Format and deliver breakdowns to the right place in the right format.

## 5.2 Trello Sync

### Create Checklist

```
1. Check if APTLSS checklist exists
   - If yes → Update process
   - If no → Create new

2. Create checklist via API
   - Name: "APTLSS: [Card Name]"
   - Position: top

3. Add items in sequence
   - Format: "[Description] (Xh Xm)" or "(XXm)"

4. Add summary item
   - "--- Total: Xh Xm | Generated: [date]"

5. Store mappings
   - breakdown_id ↔ checklist_id
   - step_id ↔ checkitem_id
```

### Update Checklist

```
1. Fetch current state from Trello

2. Identify completed items
   - Map by checkitem_id
   - PRESERVE all completed items

3. For completed items:
   - Keep in breakdown
   - Mark as preserved
   - Maintain position

4. For incomplete items:
   - Replace with new AI steps
   - Or update estimates

5. Sync to Trello
   - Update changed items
   - Add new items
   - Remove obsolete incomplete items
   - NEVER remove completed items

6. Update database mappings
```

### Conflict Handling

```
Checklist modified since last sync:
- Detect via timestamp
- Fetch fresh data
- Merge intelligently

Item completed in Trello not dashboard:
- Trust Trello
- Update dashboard

Item completed in dashboard not Trello:
- Push to Trello
- Retry on failure

Checklist deleted:
- Recreate from dashboard
- Or flag for user decision
```

## 5.3 Display Formats

### Dashboard Card View
```
┌─────────────────────────────────────────┐
│ TASK: [Card Name]                       │
│ Total: Xh Xm | Confidence: ●●●○○       │
├─────────────────────────────────────────┤
│ [✓] Step 1                    30m  ████ │
│ [▶] Step 2 (in progress)      45m  █████│
│ [ ] Step 3                    20m  ██   │
│ [⏸] Step 4 (blocked)          1h   █████│
└─────────────────────────────────────────┘
```

### Detailed View
```
TASK BREAKDOWN
==============
[Full breakdown with all metadata]
```

### Worker Daily View
```
TODAY'S QUEUE
=============
Priority | Task              | Next Step           | Est
---------|-------------------|---------------------|-----
1 🔴     | Client proposal   | Draft intro section | 45m
2 🟡     | Research report   | Compile findings    | 1h
3 🟢     | Email responses   | Reply to 3 emails   | 30m
⏸ BLOCKED | Website update   | Waiting on assets   | --
```

---

# 6. PRIORITIZATION SYSTEM

## 6.1 Purpose

Answer "What should I work on RIGHT NOW?" - generate and maintain a prioritized work queue.

## 6.2 Priority Factors

```
PRIORITY CALCULATION
====================

1. DEADLINE PROXIMITY (weight: 30%)
   - Overdue: Maximum priority
   - Due today: Very high
   - Due this week: High
   - Due next week: Medium
   - No deadline: Low base

2. FOUNDER PRIORITY (weight: 25%)
   - Drop everything: Maximum
   - Urgent: Very high
   - High: High
   - Normal: Neutral
   - Low: Reduced

3. DEPENDENCY STATUS (weight: 20%)
   - Unblocks other tasks: Boost
   - Blocked by other tasks: Sink
   - No dependencies: Neutral

4. ESTIMATED DURATION (weight: 10%)
   - Fits in available time slot: Boost
   - Too long for remaining day: Consider for tomorrow

5. WORKER PERFORMANCE (weight: 10%)
   - Worker performs better on this type: Slight boost
   - Morning task for morning person: Boost

6. TASK AGE (weight: 5%)
   - Older tasks get slight boost to prevent stagnation
```

## 6.3 Daily Queue Generation

```
MORNING QUEUE GENERATION
========================

1. Gather all incomplete tasks assigned to worker

2. Calculate priority score for each

3. Consider worker's available hours today
   - Working hours - meetings - breaks

4. Fill queue to capacity
   - Highest priority first
   - Consider task duration fit

5. Handle blocked tasks
   - Show separately
   - Check if blockers resolved

6. Output prioritized list with:
   - Order
   - Task name
   - Next step
   - Estimated time
   - Why this priority

7. Allow manual reordering
   - Track adherence to queue
```

## 6.4 Dynamic Reprioritization

```
TRIGGERS FOR REPRIORITIZATION
=============================

- New urgent task added
- Deadline changed
- Task blocked/unblocked
- Significant time variance (running over)
- Founder override
- Worker request

PROCESS:
1. Recalculate all priorities
2. Generate new queue
3. Notify worker of changes
4. Log reason for change
```

---

# 7. CAPACITY PLANNING

## 7.1 Purpose

Prevent overload. Show committed vs available hours. Alert when deadlines are at risk.

## 7.2 Capacity Calculation

```
WORKER CAPACITY
===============

Available Hours:
- Working hours per day (from profile)
- Minus: Scheduled meetings
- Minus: Recurring breaks
- Minus: Buffer for unexpected (10%)
= Net available hours

Committed Hours:
- Sum of estimated hours for assigned tasks
- Grouped by: Today, This week, Next week

Capacity Status:
- Under capacity: Committed < Available
- At capacity: Committed ≈ Available (within 10%)
- Over capacity: Committed > Available
```

## 7.3 Capacity Dashboard

```
CAPACITY VIEW
=============

This Week:
┌─────────────────────────────────────────┐
│ Mon  Tue  Wed  Thu  Fri                 │
│ ████ ████ ████ ████ ████  Available     │
│ ███  ████ █████████ ███   Committed     │
│ OK   OK   OVER OVER OK                  │
└─────────────────────────────────────────┘

Summary:
- Available: 40 hours
- Committed: 47 hours
- Status: OVERBOOKED by 7 hours

Recommendations:
- Move "Research report" to next week (-3h)
- Delegate "Data entry" to other worker (-2h)
- Request deadline extension for "Proposal" (-2h)
```

## 7.4 Deadline Risk Alerts

```
DEADLINE RISK DETECTION
=======================

For each task with deadline:
1. Calculate: Remaining work hours
2. Calculate: Available hours before deadline
3. If remaining > available: RISK

Alert Levels:
- 🔴 CRITICAL: Will miss deadline at current pace
- 🟡 WARNING: Tight, no buffer for issues
- 🟢 OK: On track with buffer

Alert Content:
- Task name
- Deadline
- Estimated remaining: X hours
- Available before deadline: Y hours
- Shortfall: Z hours
- Suggested actions
```

---

# 8. STATE MANAGEMENT

## 8.1 Purpose

Handle real-world complexity: blocked tasks, scope changes, paused work.

## 8.2 Step States

```
STEP STATES
===========

not_started
  → Can transition to: in_progress, skipped

in_progress
  → Can transition to: completed, blocked, paused

blocked
  → Requires: blocker_description, expected_resolution
  → Can transition to: in_progress (when unblocked)

paused
  → Reason: End of day, switching tasks, break
  → Can transition to: in_progress (resume)

completed
  → Requires: actual_time logged
  → Terminal state (unless revision needed)

skipped
  → Reason: Not needed, descoped
  → Terminal state

needs_revision
  → From: completed (after review)
  → Can transition to: in_progress, completed
```

## 8.3 Blocked State Handling

```
BLOCKING FLOW
=============

1. Worker clicks "Blocked" on step
2. Prompt: "What's blocking this?"
   - Waiting for: [person/thing]
   - Expected resolution: [date/unknown]
3. Step shows as blocked in dashboard
4. Founder sees blocked items queue
5. Time tracking:
   - work_minutes: Time before block
   - wait_minutes: Time while blocked
   - Tracked separately

UNBLOCKING FLOW
===============

1. Worker clicks "Resume" or "Unblocked"
2. Confirm blocker resolved
3. Step returns to in_progress
4. Continue time tracking
```

## 8.4 Scope Change Handling

```
SCOPE CHANGE FLOW
=================

1. Worker flags "Scope has changed"

2. Prompt: "What changed?"
   - Added requirements
   - Removed requirements
   - Changed requirements
   - Free text description

3. Options:
   a) ADD STEPS
      - Worker describes new work
      - AI generates new steps
      - Inserted into breakdown
   
   b) REMOVE STEPS
      - Select steps to remove
      - Mark as "descoped"
      - Preserve for history
   
   c) MODIFY STEPS
      - Edit description
      - Update estimate
      - Note reason for change

4. Create new breakdown version
   - Original preserved
   - Changes tracked
   - Learning engine knows this is modified

5. Continue execution against new version
```

---

# 9. QUALITY & OUTCOME TRACKING

## 9.1 Purpose

Track not just time, but whether the work achieved its goal.

## 9.2 Outcome Capture

```
OUTCOME TRACKING
================

On Task Completion:
1. "Was the deliverable accepted?"
   - Yes, first time
   - Yes, after revisions
   - No, rejected
   - Pending review

2. If revisions:
   - How many rounds?
   - What needed fixing?

3. Link to evidence:
   - Approval message/email
   - Trello card moved to "Done"
   - Client confirmation
```

## 9.3 Quality Metrics

```
QUALITY METRICS
===============

Per Worker:
- First-time acceptance rate
- Average revision rounds
- Quality by task type
- Quality trend over time

Per Task Type:
- Typical acceptance rate
- Common revision reasons
- Quality predictors

Insights:
- "Research tasks have 90% acceptance"
- "Presentations need 1.5 revision rounds average"
- "Quality drops on Friday afternoons"
```

---

# 10. COMMUNICATION SYSTEM

## 10.1 Purpose

Structured Q&A between worker and founder. Capture context. Build knowledge base.

## 10.2 Question Flow

```
QUESTION FLOW
=============

1. Worker clicks "I have a question" on any step

2. System captures context:
   - Which card
   - Which step
   - What's been done so far
   - What's been tried

3. Worker enters question

4. Question goes to founder queue with full context

5. Founder answers

6. Answer attached to:
   - The specific step
   - The card for future reference
   - Knowledge base for similar tasks

7. Worker notified of answer

8. Work continues
```

## 10.3 Question Queue (Founder View)

```
QUESTION QUEUE
==============

┌─────────────────────────────────────────────────────────────┐
│ PENDING QUESTIONS (3)                                       │
├─────────────────────────────────────────────────────────────┤
│ 🔴 2 hours ago | Joyce | Client Proposal                    │
│ Q: Should I include competitor comparison section?          │
│ Context: Working on "Draft proposal" step                   │
│ [Answer] [View Full Context]                                │
├─────────────────────────────────────────────────────────────┤
│ 🟡 4 hours ago | Joyce | Research Report                    │
│ Q: Which data sources should I prioritize?                  │
│ Context: Working on "Gather data" step                      │
│ [Answer] [View Full Context]                                │
└─────────────────────────────────────────────────────────────┘
```

## 10.4 Knowledge Base

```
KNOWLEDGE BASE
==============

Questions and answers stored by:
- Task type
- Topic
- Keywords

Future similar tasks:
- Show relevant past Q&A
- "Note: Similar task had this question: [Q] Answer: [A]"

Reduces repeat questions
```

---

# 11. INTERRUPTION HANDLING

## 11.1 Purpose

Track interruptions. Understand patterns. Reduce impact.

## 11.2 Interruption Logging

```
INTERRUPTION LOG
================

Quick button: "I was interrupted"

Capture:
- When (timestamp)
- What interrupted (categories + free text):
  - Urgent request from founder
  - Client call/message
  - Technical issue
  - Meeting
  - Personal
  - Other
- Duration of interruption
- Did you return to task? (yes/no)
- Impact on focus (1-5)
```

## 11.3 Interruption Analytics

```
INTERRUPTION INSIGHTS
=====================

This Week:
- Total interruptions: 12
- Total time lost: 3.5 hours
- Most common source: Client messages (5)
- Peak interruption time: 2-4 PM

Patterns:
- "Joyce is interrupted 40% more on Mondays"
- "Client messages cause longest recovery time"
- "Morning focus blocks are rarely interrupted"

Recommendations:
- Consider batching client responses to 2x daily
- Protect morning hours for deep work
- Set up auto-responder during focus time
```

---

# 12. SKILL & DEVELOPMENT TRACKING

## 12.1 Purpose

Track not just speed, but capability growth. Identify training needs.

## 12.2 Skill Inference

```
SKILL TRACKING
==============

Inferred from:
- Task types completed successfully
- Quality ratings by task type
- Speed improvement over time
- Complexity handled

Skill Areas (auto-detected from tasks):
- Research
- Writing
- Data analysis
- Client communication
- Design
- Technical tasks
- Administrative
- [Custom based on your tasks]
```

## 12.3 Development Insights

```
DEVELOPMENT INSIGHTS
====================

Strengths:
- "Joyce excels at research tasks (95% acceptance, 20% faster than average)"
- "Strong improvement in writing quality over past month"

Growth Areas:
- "Data analysis tasks take 50% longer and have lower acceptance"
- "Client communication often needs revision"

Recommendations:
- "Consider training in data analysis tools"
- "Provide templates for client emails"
- "Assign more research tasks, fewer data tasks"
```

---

# 13. CARD QUALITY FEEDBACK

## 13.1 Purpose

Help founder create better cards. Reduce garbage-in-garbage-out.

## 13.2 Card Quality Assessment

```
CARD QUALITY SCORE
==================

Assessed on:
- Clarity of request (is it obvious what's needed?)
- Completeness (is all necessary info present?)
- Specificity (are details concrete?)
- Attachments (are referenced materials attached?)

Score: A / B / C / D / F

Feedback:
- "This card is missing: [specific info]"
- "Adding [X] would help create a better breakdown"
- "Similar cards usually include: [Y]"
```

## 13.3 Card Templates

```
CARD TEMPLATES
==============

Based on patterns, suggest templates:

"Research Task Template"
- Topic to research: [specific]
- Scope: [how deep]
- Output format: [document type]
- Key questions to answer: [list]
- Sources to check: [list or "any"]
- Deadline: [date]

"Client Deliverable Template"
- Client: [name]
- Deliverable: [what]
- Format: [specific]
- Key requirements: [list]
- Reference materials: [attach]
- Review needed: [yes/no]
- Deadline: [date]
```

---

# 14. ONBOARDING SYSTEM

## 14.1 Purpose

Handle new workers gracefully. Build calibration data quickly.

## 14.2 Onboarding Mode

```
ONBOARDING MODE
===============

Triggered: New worker (< 20 completed steps)

Settings:
- Conservative buffer: +30% on all estimates
- Required time logging: No skipping
- Frequent feedback prompts: After every step
- Simplified UI: Focus on essentials

Progress Tracking:
- "Calibration: 45% complete"
- "Need 11 more data points"
- "Estimated: 3 more days"

Graduation:
- After 20 steps with time data
- Calibration factor calculated
- Switch to normal mode
- "Calibration complete! Estimates are now personalized"
```

## 14.3 Founder Seeding

```
MANUAL CALIBRATION SEEDING
==========================

Founder can provide:
- "Research tasks typically take Joyce 2 hours"
- "She's faster at admin, slower at creative"
- "Add 20% buffer to all estimates initially"

System uses as starting point:
- Applied until real data overrides
- Marked as "founder-seeded"
- Gradually replaced by actual data
```

---

# 15. DATA MODELS

## 15.1 Task Breakdown

```typescript
interface TaskBreakdown {
  // Identity
  id: string;
  version: number;
  
  // Source
  cardId: string;
  cardName: string;
  boardId: string;
  boardName: string;
  
  // Context
  context: {
    cardDescription: string;
    attachmentSummaries: AttachmentSummary[];
    commentSummary: string;
    relatedCards: RelatedCard[];
    labels: string[];
    dueDate: string | null;
  };
  
  // Goal
  goal: {
    statement: string;
    deliverable: string;
    recipient: string;
    successCriteria: string[];
    constraints: string[];
  };
  
  // Steps
  steps: TaskStep[];
  
  // Estimates
  totalEstimatedMinutes: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  confidenceExplanation: string;
  
  // Calibration
  calibration: {
    applied: boolean;
    workerFactor: number | null;
    patternFactor: number | null;
    boardFactor: number | null;
    rawEstimateMinutes: number;
  };
  
  // Uncertainty
  assumptions: Assumption[];
  clarificationsNeeded: ClarificationItem[];
  
  // Reasoning
  reasoningTrace: string;
  
  // Status
  status: 'draft' | 'pending_approval' | 'approved' | 'in_progress' | 'completed' | 'cancelled';
  
  // Approval
  approvedBy: string | null;
  approvedAt: Date | null;
  
  // Outcome
  outcome: {
    deliverableAccepted: 'yes' | 'yes_with_revisions' | 'no' | 'pending' | null;
    revisionRounds: number;
    acceptedAt: Date | null;
    outcomeNotes: string | null;
  };
  
  // Scope changes
  scopeChanges: ScopeChange[];
  
  // Trello sync
  trelloChecklistId: string | null;
  lastSyncedAt: Date | null;
  syncStatus: 'synced' | 'pending' | 'error';
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: 'system' | 'manual';
}

interface TaskStep {
  id: string;
  position: number;
  description: string;
  
  // Estimation
  estimatedMinutes: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  estimationBasis: string;
  
  // State
  state: 'not_started' | 'in_progress' | 'blocked' | 'paused' | 'completed' | 'skipped' | 'needs_revision';
  
  // Blocking
  blockerDescription: string | null;
  blockerExpectedResolution: Date | null;
  blockedAt: Date | null;
  
  // Preservation
  wasPreserved: boolean;
  
  // Time tracking
  actualMinutes: number | null;
  timerMinutes: number | null;
  waitMinutes: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  
  // Quality
  completedCorrectly: boolean | null;
  revisionCount: number;
  
  // Variance
  varianceReason: string | null;
  varianceExplanation: string | null;
  
  // Dependencies
  dependsOn: string[];
  
  // Trello
  trelloCheckItemId: string | null;
}

interface ScopeChange {
  id: string;
  changedAt: Date;
  changeType: 'added' | 'removed' | 'modified';
  description: string;
  stepsAffected: string[];
  estimateImpact: number; // minutes added/removed
}
```

## 15.2 Time Log

```typescript
interface TimeLogEntry {
  id: string;
  
  // References
  stepId: string;
  breakdownId: string;
  cardId: string;
  workerId: string;
  
  // Timing
  estimatedMinutes: number;
  actualMinutes: number;
  timerMinutes: number | null;
  trelloInferredMinutes: number | null;
  waitMinutes: number;
  variance: number;
  varianceCategory: 'accurate' | 'slight_over' | 'slight_under' | 'significant_over' | 'significant_under';
  
  // Timestamps
  startedAt: Date | null;
  completedAt: Date;
  elapsedClockMinutes: number | null;
  
  // Context
  stepDescription: string;
  stepPosition: number;
  wasModified: boolean;
  originalDescription: string | null;
  
  // Quality
  completedCorrectly: boolean;
  revisionCount: number;
  
  // Feedback
  varianceReason: VarianceReason | null;
  workerComment: string | null;
  
  // Validation
  validationStatus: 'validated' | 'flagged' | 'unchecked';
  validationNotes: string | null;
  
  // Metadata
  loggedAt: Date;
  logMethod: 'timer' | 'manual' | 'quick_select';
}

type VarianceReason = 
  | 'estimate_unrealistic'
  | 'unexpected_complexity'
  | 'had_to_redo'
  | 'waiting_blocked'
  | 'interruptions'
  | 'scope_changed'
  | 'easier_than_expected'
  | 'had_prior_knowledge'
  | 'reused_existing_work'
  | 'other';
```

## 15.3 Learning Data

```typescript
interface WorkerLearningProfile {
  workerId: string;
  
  // Volume
  totalCompletedSteps: number;
  totalCompletedBreakdowns: number;
  dataStartDate: Date;
  dataEndDate: Date;
  
  // Calibration
  calibrationFactor: number;
  calibrationConfidence: 'high' | 'medium' | 'low';
  calibrationTrend: 'improving' | 'stable' | 'worsening';
  
  // Onboarding
  isOnboarding: boolean;
  onboardingProgress: number; // 0-100
  
  // Patterns
  timePatterns: TimePatterns;
  complexityPatterns: ComplexityPatterns;
  learnedPatterns: LearnedPattern[];
  
  // Quality
  firstTimeAcceptanceRate: number;
  averageRevisionRounds: number;
  
  // Interruptions
  averageInterruptionsPerDay: number;
  interruptionImpactMinutes: number;
  
  // Skills
  skills: SkillAssessment[];
  
  // Variance reasons
  commonVarianceReasons: {
    reason: VarianceReason;
    frequency: number;
    averageImpact: number;
  }[];
  
  lastUpdated: Date;
}

interface LearnedPattern {
  id: string;
  description: string;
  matchingKeywords: string[];
  matchingContext: string[];
  
  sampleSize: number;
  averageActualMinutes: number;
  medianActualMinutes: number;
  percentile10: number;
  percentile90: number;
  averageVariance: number;
  
  typicalStepCount: number;
  commonSubSteps: string[];
  commonIssues: string[];
  
  confidence: 'high' | 'medium' | 'low';
  lastUpdated: Date;
}

interface SkillAssessment {
  skillArea: string;
  proficiencyLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  basedOnTasks: number;
  averageQuality: number;
  averageSpeed: number; // relative to estimate
  trend: 'improving' | 'stable' | 'declining';
  lastAssessed: Date;
}
```

## 15.4 Questions & Communication

```typescript
interface Question {
  id: string;
  
  // Context
  cardId: string;
  breakdownId: string;
  stepId: string | null;
  workerId: string;
  
  // Content
  question: string;
  contextSnapshot: {
    cardName: string;
    stepDescription: string | null;
    workDoneSoFar: string;
    whatWasTried: string;
  };
  
  // Status
  status: 'pending' | 'answered' | 'dismissed';
  
  // Answer
  answer: string | null;
  answeredBy: string | null;
  answeredAt: Date | null;
  
  // Knowledge base
  addedToKnowledgeBase: boolean;
  knowledgeBaseId: string | null;
  
  // Metadata
  askedAt: Date;
  priority: 'high' | 'medium' | 'low';
}

interface KnowledgeBaseEntry {
  id: string;
  
  // Classification
  taskType: string;
  topic: string;
  keywords: string[];
  
  // Content
  question: string;
  answer: string;
  
  // Source
  sourceQuestionId: string;
  sourceCardId: string;
  
  // Usage
  timesReferenced: number;
  lastReferenced: Date | null;
  
  // Metadata
  createdAt: Date;
  createdBy: string;
}
```

## 15.5 Interruptions

```typescript
interface Interruption {
  id: string;
  
  // Context
  workerId: string;
  cardId: string | null;
  stepId: string | null;
  
  // Details
  interruptedAt: Date;
  resumedAt: Date | null;
  durationMinutes: number | null;
  
  // Classification
  source: 'founder_request' | 'client' | 'technical_issue' | 'meeting' | 'personal' | 'other';
  sourceDetail: string | null;
  
  // Impact
  returnedToTask: boolean;
  focusImpact: number; // 1-5
  
  // Metadata
  loggedAt: Date;
}
```

## 15.6 Capacity & Priority

```typescript
interface DailyQueue {
  id: string;
  workerId: string;
  date: Date;
  
  // Queue
  items: QueueItem[];
  
  // Capacity
  availableMinutes: number;
  committedMinutes: number;
  capacityStatus: 'under' | 'at' | 'over';
  
  // Generation
  generatedAt: Date;
  lastUpdatedAt: Date;
  
  // Tracking
  adherenceScore: number | null; // How well did worker follow queue
}

interface QueueItem {
  position: number;
  cardId: string;
  breakdownId: string;
  nextStepId: string;
  
  // Priority
  priorityScore: number;
  priorityFactors: {
    deadline: number;
    founderPriority: number;
    dependencies: number;
    duration: number;
    performance: number;
    age: number;
  };
  
  // Display
  cardName: string;
  nextStepDescription: string;
  estimatedMinutes: number;
  
  // Status
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped';
}

interface DeadlineRisk {
  id: string;
  cardId: string;
  breakdownId: string;
  
  // Risk assessment
  deadline: Date;
  remainingMinutes: number;
  availableMinutes: number;
  shortfallMinutes: number;
  
  riskLevel: 'critical' | 'warning' | 'ok';
  
  // Suggestions
  suggestions: string[];
  
  // Status
  acknowledged: boolean;
  acknowledgedBy: string | null;
  resolution: string | null;
  
  detectedAt: Date;
}
```

---

# 16. USER FLOWS

## 16.1 Generate Breakdown

```
FLOW: GENERATE BREAKDOWN
========================

1. SELECT
   - User selects card(s)
   - Clicks "Generate Breakdown"

2. GATHER CONTEXT
   - Fetch all card data
   - Extract attachments
   - Analyze comments
   - Find related cards
   - Check existing checklists
   - Build Context Document

3. REASON
   - Crystallize goal
   - Mental simulation
   - Formulate steps
   - Estimate times
   - Validate sequence
   - Check completeness
   - Document uncertainty
   - Apply calibration

4. PREVIEW
   - Show breakdown to user
   - Highlight preserved items
   - Show confidence level
   - Show any warnings
   - Show clarification needs

5. DECIDE
   - Approve → Sync to Trello, notify worker
   - Edit → Modify, then approve
   - Reject → Discard, optionally give feedback
   - Clarify → Answer questions, regenerate

6. COMPLETE
   - Update statuses
   - Log event
   - Done
```

## 16.2 Complete Step

```
FLOW: COMPLETE STEP
===================

1. MARK COMPLETE
   - Worker checks step checkbox

2. LOG TIME
   - Prompt: "How long did this take?"
   - Options: About right / Took longer / Was faster / Exact time / Skip
   - If timer running: Use timer value

3. VALIDATE TIME (background)
   - Compare sources: reported, timer, Trello activity
   - Flag discrepancies

4. VARIANCE EXPLANATION (if significant)
   - "This took longer/shorter than expected. What happened?"
   - Select reason or explain

5. SYNC
   - Update database
   - Sync to Trello
   - Update learning data

6. NEXT
   - Show next step
   - If all done: Prompt for breakdown feedback
```

## 16.3 Handle Blocker

```
FLOW: HANDLE BLOCKER
====================

1. BLOCK
   - Worker clicks "Blocked" on step
   - Enter: What's blocking? Expected resolution?
   - Step state → blocked
   - Work time stops, wait time starts

2. VISIBILITY
   - Step shows as blocked in worker view
   - Appears in founder's blocked queue
   - Capacity recalculated

3. UNBLOCK
   - Worker clicks "Resume" when resolved
   - Confirm blocker resolved
   - Step state → in_progress
   - Wait time recorded separately
```

## 16.4 Scope Change

```
FLOW: SCOPE CHANGE
==================

1. FLAG
   - Worker clicks "Scope Changed"

2. DESCRIBE
   - What changed?
   - Type: Added / Removed / Modified

3. UPDATE
   - Add steps: AI generates, worker confirms
   - Remove steps: Mark as descoped
   - Modify steps: Edit in place

4. VERSION
   - Create new breakdown version
   - Original preserved
   - Changes tracked

5. CONTINUE
   - Work against new version
   - Learning engine aware of change
```

## 16.5 Ask Question

```
FLOW: ASK QUESTION
==================

1. INITIATE
   - Worker clicks "I have a question" on step

2. CAPTURE CONTEXT
   - Card, step, work done, what tried
   - Auto-populated

3. ASK
   - Worker types question

4. QUEUE
   - Question appears in founder queue
   - Full context attached
   - Priority assigned

5. ANSWER
   - Founder sees context
   - Types answer
   - Optionally adds to knowledge base

6. NOTIFY
   - Worker notified
   - Answer attached to step
   - Work continues
```

## 16.6 Daily Queue

```
FLOW: DAILY QUEUE
=================

1. GENERATE (morning)
   - Calculate priorities for all tasks
   - Consider capacity
   - Build ordered queue

2. PRESENT
   - Worker sees prioritized list
   - Each item: Task, next step, estimate, why this priority

3. WORK
   - Worker follows queue
   - Can reorder if needed
   - System tracks adherence

4. UPDATE (throughout day)
   - Reprioritize on triggers
   - Notify of changes
   - Adjust for actual progress
```

## 16.7 Review Learning Data

```
FLOW: REVIEW LEARNING
=====================

1. OPEN DASHBOARD
   - Founder opens "Estimation Intelligence"

2. OVERVIEW
   - Overall accuracy
   - Trend
   - Data volume

3. DRILL DOWN
   - Worker performance
   - Patterns discovered
   - Insights generated
   - Raw data

4. ACT
   - Apply recommendations
   - Dismiss insights
   - Export data
   - Seed calibration manually
```

---

# 17. API SPECIFICATIONS

## 17.1 Breakdown APIs

```
POST /api/atis/breakdowns/generate
  Body: { cardIds: string[] }
  Response: { breakdowns: TaskBreakdown[] }

GET /api/atis/breakdowns/:id
  Response: TaskBreakdown

PUT /api/atis/breakdowns/:id/approve
  Response: TaskBreakdown

PUT /api/atis/breakdowns/:id/reject
  Body: { feedback?: string }
  Response: { success: true }

PUT /api/atis/breakdowns/:id/steps/:stepId/complete
  Body: { actualMinutes: number, varianceReason?: string }
  Response: TaskStep

PUT /api/atis/breakdowns/:id/steps/:stepId/block
  Body: { blockerDescription: string, expectedResolution?: Date }
  Response: TaskStep

PUT /api/atis/breakdowns/:id/steps/:stepId/unblock
  Response: TaskStep

POST /api/atis/breakdowns/:id/scope-change
  Body: { changeType: string, description: string, steps?: StepChange[] }
  Response: TaskBreakdown
```

## 17.2 Queue APIs

```
GET /api/atis/queue/:workerId/today
  Response: DailyQueue

PUT /api/atis/queue/:workerId/reorder
  Body: { itemOrder: string[] }
  Response: DailyQueue

GET /api/atis/capacity/:workerId
  Query: { startDate, endDate }
  Response: CapacityReport

GET /api/atis/risks
  Response: DeadlineRisk[]
```

## 17.3 Learning APIs

```
GET /api/atis/learning/worker/:workerId
  Response: WorkerLearningProfile

GET /api/atis/learning/patterns
  Response: LearnedPattern[]

GET /api/atis/learning/insights
  Response: Insight[]

POST /api/atis/learning/seed
  Body: { workerId, patterns: ManualPattern[] }
  Response: { success: true }
```

## 17.4 Communication APIs

```
POST /api/atis/questions
  Body: { cardId, stepId?, question: string }
  Response: Question

GET /api/atis/questions/pending
  Response: Question[]

PUT /api/atis/questions/:id/answer
  Body: { answer: string, addToKnowledgeBase?: boolean }
  Response: Question

GET /api/atis/knowledge-base
  Query: { taskType?, topic?, keywords? }
  Response: KnowledgeBaseEntry[]
```

## 17.5 Interruption APIs

```
POST /api/atis/interruptions
  Body: { cardId?, stepId?, source: string, sourceDetail?: string }
  Response: Interruption

PUT /api/atis/interruptions/:id/resume
  Body: { returnedToTask: boolean, focusImpact: number }
  Response: Interruption

GET /api/atis/interruptions/analytics
  Query: { workerId, startDate, endDate }
  Response: InterruptionAnalytics
```

---

# 18. IMPLEMENTATION NOTES

## 18.1 AI Integration

```
LLM Usage:
- Context synthesis: Summarize attachments, comments
- Reasoning: Generate breakdowns
- Pattern description: Human-readable pattern names
- Insights: Generate actionable insights

Model Selection:
- Use capable model (GPT-4 class) for reasoning
- Can use faster model for simple extraction
- Cache results where appropriate

Prompt Engineering:
- System prompt: ATIS principles, output format
- User prompt: Context document, specific request
- Few-shot examples for consistency
```

## 18.2 Trello Integration

```
API Usage:
- Fetch: Cards, checklists, attachments, comments, activity
- Create: Checklists, checklist items
- Update: Checklist items (check/uncheck, rename)
- Webhooks: Real-time updates (optional)

Rate Limits:
- Respect Trello rate limits
- Queue and batch requests
- Cache aggressively

Sync Strategy:
- Pull on demand
- Push on change
- Periodic reconciliation
```

## 18.3 Performance Considerations

```
Caching:
- Cache Trello data (TTL: 5 min)
- Cache Context Documents (TTL: until card changes)
- Cache Learning Profiles (TTL: 1 hour)

Background Processing:
- Learning updates: Async after completion
- Pattern recognition: Daily batch
- Calibration recalc: Weekly batch

Database:
- Index on: cardId, workerId, status, date ranges
- Partition time logs by month
- Archive old data after 1 year
```

## 18.4 Error Handling

```
Trello Errors:
- Retry with backoff
- Fall back to cached data
- Alert on persistent failure

AI Errors:
- Retry once
- Fall back to simpler prompt
- Return partial result with warning

Sync Errors:
- Queue for retry
- Show warning in UI
- Manual sync option
```

---

# APPENDIX A: GLOSSARY

- **ATIS**: Adaptive Task Intelligence System
- **Breakdown**: Structured list of steps with time estimates for a task
- **Calibration**: Adjustment of estimates based on historical data
- **Context Document**: Synthesized information about a task
- **Pattern**: Learned characteristics of similar tasks
- **Variance**: Difference between estimated and actual time

---

# APPENDIX B: CONFIGURATION

```typescript
interface ATISConfig {
  // Calibration
  minDataPointsForWorkerCalibration: 10;
  minDataPointsForPatternCalibration: 5;
  minDataPointsForBoardCalibration: 20;
  
  // Onboarding
  onboardingStepThreshold: 20;
  onboardingBufferPercent: 30;
  
  // Cold start
  coldStartBufferPercent: 20;
  
  // Variance thresholds
  significantVarianceThreshold: 0.3; // 30%
  
  // Time validation
  timeValidationDiscrepancyThreshold: 0.3; // 30%
  
  // Capacity
  dailyBufferPercent: 10;
  
  // Learning
  recentDataWeightMultiplier: 2;
  patternConfidenceThreshold: 0.7;
}
```

---

END OF SPECIFICATION
