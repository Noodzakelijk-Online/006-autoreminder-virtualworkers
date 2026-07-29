# VA Task Dashboard - System Architecture
## Knowledge-First Design for Accurate Task Breakdown

---

# OVERVIEW

This architecture is designed to solve the core problem: generating accurate, non-hallucinated task breakdowns by understanding the FULL context of all Trello data.

**Key Principle:** You can't work with 100% accuracy with less than 100% of the input. The system must load and understand ALL cards to reason accurately about ANY card.

---

# ARCHITECTURE LAYERS

## LAYER 1: DATA INGESTION PIPELINE

**Purpose:** Get ALL data from Trello into our system

```
┌─────────────────────────────────────────────────────────────┐
│                    TRELLO API                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 INGESTION SERVICE                            │
│                                                              │
│  1. Fetch all workspaces                                    │
│  2. Fetch all boards per workspace                          │
│  3. Fetch all cards per board                               │
│  4. For each card:                                          │
│     - Title, description, labels, due date                  │
│     - All attachments (download + extract content)          │
│     - All comments (with timestamps, authors)               │
│     - All activity/history                                  │
│     - Checklist items (with completion status)              │
│     - Assigned members                                       │
│  5. Store raw data in database                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│         [PLANNED] ATTACHMENT PROCESSOR                       │
│         (Not yet implemented - see ARCHITECTURE-ACTUAL.md)   │
│                                                              │
│  For each attachment type:                                  │
│  - PDF → Extract text (OCR if scanned)                     │
│  - DOCX → Extract text + structure                         │
│  - XLSX → Extract data + headers                           │
│  - Images → Vision AI description + OCR                    │
│  - Links → Fetch page content                              │
│  - Google Docs → API fetch (if accessible)                 │
│  - Email files → Parse content                             │
│                                                              │
│  Output: Extracted text/content per attachment              │
│                                                              │
│  Fallback: If extraction fails, flag as "unreadable"       │
│  so AI knows information might be missing                   │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Details

**Trello API Endpoints:**
- `GET /members/me/organizations` - All workspaces
- `GET /organizations/{id}/boards` - Boards per workspace
- `GET /boards/{id}/cards` - Cards per board
- `GET /cards/{id}?attachments=true&checklists=all&actions=commentCard` - Full card data

**[PLANNED] Attachment Processing Libraries:**
- PDF: `pdf-parse` + Tesseract for OCR
- DOCX: `mammoth`
- XLSX: `xlsx`
- Images: GPT-4 Vision API
- Links: `cheerio` for HTML parsing
- Email: `mailparser`

**Status:** Not yet implemented. System currently works with card titles, descriptions, and checklist items only.

---

## LAYER 2: KNOWLEDGE BASE

**Purpose:** Transform raw data into structured understanding

```
┌─────────────────────────────────────────────────────────────┐
│                 KNOWLEDGE BUILDER                            │
│                                                              │
│  For each card, AI generates:                               │
│                                                              │
│  CARD UNDERSTANDING                                         │
│  ├── goal: What is this trying to achieve?                 │
│  ├── deliverable: What tangible output?                    │
│  ├── entities: People, companies, systems, cases involved  │
│  ├── deadlines: Any dates/timeframes mentioned             │
│  ├── dependencies: What must happen before this?           │
│  ├── produces: What does completing this enable?           │
│  ├── domain: What area of work is this?                    │
│  ├── complexity: Simple / Medium / Complex                 │
│  ├── clarity_score: How clear is this card? (1-10)        │
│  └── missing_info: What's unclear or not specified?        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 RELATIONSHIP MAPPER                          │
│                                                              │
│  AI analyzes ALL card understandings together to find       │
│  TRUE relationships (not simple pattern matching):          │
│                                                              │
│  Relationship types:                                        │
│  - DEPENDS_ON: A needs B done first                        │
│  - ENABLES: A's output feeds into B                        │
│  - SAME_PROJECT: Both serve the same end goal              │
│  - SAME_ENTITY: Both involve same person/case/client       │
│  - CONTRADICTS: A and B conflict                           │
│  - DUPLICATES: A and B are essentially the same task       │
│                                                              │
│  Note: Same board does NOT imply related                    │
│  AI must reason about actual content relationships          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 ENTITY INDEX                                 │
│                                                              │
│  Extract and index all entities across all cards:           │
│                                                              │
│  - People: Names, roles, contact info                       │
│  - Organizations: Companies, courts, agencies               │
│  - Cases/Projects: Case numbers, project names              │
│  - Systems: Websites, tools, platforms                      │
│  - Documents: Referenced files, contracts, agreements       │
│  - Dates: Deadlines, appointments, milestones               │
│                                                              │
│  Each entity links back to all cards that mention it        │
│  Enables: "Show me all cards involving Client X"            │
└─────────────────────────────────────────────────────────────┘
```

### Knowledge Builder Prompt Structure

```
Given this Trello card with full context:

TITLE: {title}
DESCRIPTION: {description}
ATTACHMENTS: {extracted_content_from_each_attachment}
COMMENTS: {all_comments_chronologically}
DUE DATE: {due_date}
LIST: {current_list}

Analyze this card and provide:

1. GOAL: What is this card trying to achieve? (1-2 sentences)
2. DELIVERABLE: What tangible output marks this as complete?
3. ENTITIES: List all people, organizations, cases, systems mentioned
4. DEADLINES: Any dates or timeframes mentioned (extract from attachments too)
5. DEPENDENCIES: What must happen or exist before this can be done?
6. PRODUCES: What does completing this enable or unblock?
7. COMPLEXITY: Simple (< 2 hours) / Medium (2-8 hours) / Complex (> 8 hours)
8. CLARITY_SCORE: 1-10, how clear is what needs to be done?
9. MISSING_INFO: What's unclear or would help to know?

Only include information actually present in the card. Do not invent or assume.
```

---

## LAYER 3: BREAKDOWN GENERATOR

**Purpose:** Create accurate checklists using full knowledge base

```
┌─────────────────────────────────────────────────────────────┐
│              BREAKDOWN GENERATOR                             │
│                                                              │
│  Input: Target card ID                                      │
│                                                              │
│  Step 1: GATHER CONTEXT                                     │
│  ├── Card's full data (title, desc, attachments, comments) │
│  ├── Card's understanding from knowledge base               │
│  ├── Related cards and their understandings                │
│  ├── Relevant entities and where else they appear          │
│  └── Any existing checklist items (preserve completed)      │
│                                                              │
│  Step 2: ASSESS SUFFICIENCY                                 │
│  ├── Can AI determine the deliverable? (yes/no)            │
│  ├── Can AI determine required actions? (yes/no)           │
│  ├── Is there ambiguity that could lead to wrong work?     │
│  └── Decision: Generate / Request more info                 │
│                                                              │
│  Step 3: GENERATE BREAKDOWN (if sufficient)                 │
│  ├── AI simulates doing the work step by step              │
│  ├── Each step: concrete action + time estimate            │
│  ├── Preserve any completed items from existing checklist  │
│  ├── Include context from related cards where relevant     │
│  └── Use conservative time estimates when uncertain         │
│                                                              │
│  Step 4: VALIDATE                                           │
│  ├── Does completing all steps achieve the goal?           │
│  ├── Are all steps specific and actionable?                │
│  ├── Are time estimates realistic?                         │
│  ├── Is anything assumed that's not in the source?         │
│  └── Self-correction loop if issues found                   │
│                                                              │
│  Output: Validated checklist ready for Trello               │
└─────────────────────────────────────────────────────────────┘
```

### Sufficiency Check

A card has **insufficient information** if:
- AI cannot determine what the deliverable is
- AI cannot determine what actions are needed
- Title + description are so vague that multiple completely different interpretations are possible

**Examples:**
- ❌ "Fix website" → Insufficient (what's broken? which website?)
- ❌ "Call John" → Insufficient (about what? which John?)
- ✅ "Fix broken contact form on company website" → Sufficient
- ✅ "Call John Smith to discuss invoice #1234" → Sufficient

Note: Lack of attachments or comments alone is NOT insufficient if title+description are clear.

### Breakdown Generation Prompt

```
You are generating a task breakdown for a virtual worker.

CARD CONTEXT:
{full_card_data}

CARD UNDERSTANDING:
{from_knowledge_base}

RELATED CARDS:
{related_cards_and_their_understandings}

EXISTING CHECKLIST (preserve completed items):
{existing_checklist_with_completion_status}

RULES:
1. Only include steps grounded in the card content - no hallucinations
2. Each step must be concrete and actionable
3. Include time estimate for each step (be conservative - round up when uncertain)
4. Tell WHAT to do and HOW LONG, not HOW to do it
5. Preserve any already-completed checklist items exactly as they are
6. If information from related cards is relevant, incorporate it
7. If you must make an assumption, state it explicitly

Generate the checklist in this format:
[ ] Step description (Xh Ym)
[x] Already completed step (preserved)
[ ] Next step (Xh Ym)
...

After the checklist, note:
- Total estimated time
- Any assumptions made
- Any information that would improve accuracy if provided
```

---

## LAYER 4: REAL-TIME SYNC

**Purpose:** Keep knowledge base current as Trello changes

```
┌─────────────────────────────────────────────────────────────┐
│                 WEBHOOK RECEIVER                             │
│                                                              │
│  Register webhooks for all boards                           │
│                                                              │
│  Trello sends events for:                                   │
│  - Card created/updated/deleted                             │
│  - Comment added                                            │
│  - Attachment added/removed                                 │
│  - Checklist item completed                                 │
│  - Card moved between lists                                 │
│                                                              │
│  For each event:                                            │
│  1. Update raw data in database                             │
│  2. Re-process affected attachments (if new)               │
│  3. Re-generate card understanding                          │
│  4. Re-calculate relationships (affected cards only)        │
│  5. If checklist changed externally → detect and handle    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              CHECKLIST MONITOR                               │
│                                                              │
│  Watches for changes that might require checklist updates:  │
│                                                              │
│  - New comments with significant information                │
│    → May need to add steps                                  │
│  - New attachments that change scope                        │
│    → May need to revise breakdown                           │
│  - Worker modifications to checklist                        │
│    → Learn from the change                                  │
│  - Completed items                                          │
│    → Update tracking, check if card is done                │
│                                                              │
│  Decision engine determines:                                │
│  - Minor update: Just update knowledge base                │
│  - Significant update: Add new steps to checklist          │
│  - Major change: Flag for review                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## LAYER 5: TIME TRACKING & LEARNING

**Purpose:** Capture reality and improve over time

```
┌─────────────────────────────────────────────────────────────┐
│                 TIME TRACKER                                 │
│                                                              │
│  When worker completes a step in Trello:                    │
│  1. Webhook notifies our system                             │
│  2. Worker enters actual time in dashboard                  │
│     (minimal friction: just enter minutes)                  │
│  3. System records:                                         │
│     - step_id                                               │
│     - estimated_minutes                                     │
│     - actual_minutes                                        │
│     - variance_percent                                      │
│     - timestamp                                             │
│  4. Update daily/weekly totals                              │
│                                                              │
│  Variance threshold: 25% over estimate = flag               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 LEARNING ENGINE                              │
│                                                              │
│  1. GLOBAL CALIBRATION                                      │
│     - Track overall accuracy: estimates vs actuals          │
│     - Detect systematic bias                                │
│     - Calculate correction factor                           │
│     - Apply to new estimates                                │
│                                                              │
│  2. OUTCOME FEEDBACK                                        │
│     - Feed actual times back to AI context                 │
│     - Include in prompts: "Previous similar work took X"   │
│     - AI adjusts reasoning based on real data              │
│                                                              │
│  3. MODIFICATION LEARNING                                   │
│     - When worker changes a breakdown:                      │
│       - Capture original vs modified                       │
│       - Capture reason if provided                         │
│       - Feed back to improve future generation             │
│                                                              │
│  No category-based learning (tasks too varied)              │
│  Instead: Global calibration + AI reasoning improvement     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## LAYER 6: USER INTERFACES

### Worker Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│              WORKER DASHBOARD                                │
│                                                              │
│  TODAY'S TASKS (priority order)                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 1. [Card Name] - [Board]                    Est: 2h 30m ││
│  │    [ ] Step 1 (45m)                                     ││
│  │    [ ] Step 2 (1h)                                      ││
│  │    [ ] Step 3 (45m)                                     ││
│  │    [Link to Trello card]                                ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 2. [Card Name] - [Board]                    Est: 1h 15m ││
│  │    ...                                                  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  COMING UP (Next 2-3 days)                                  │
│  - [Card] - Due: Dec 24                                     │
│  - [Card] - Due: Dec 26                                     │
│                                                              │
│  TODAY'S PROGRESS                                           │
│  ████████░░░░░░░░ 4.5h / 9.5h planned                      │
│                                                              │
│  [Mark Unavailable Today]                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘

TIME LOGGING (when step completed):
┌─────────────────────────────────────────────────────────────┐
│  Step completed: "Research competitor pricing"              │
│  Estimated: 45 minutes                                      │
│                                                              │
│  Actual time: [____] minutes                                │
│                                                              │
│  [Save]                                                     │
└─────────────────────────────────────────────────────────────┘
```

### Founder Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│              FOUNDER DASHBOARD                               │
│                                                              │
│  THIS WEEK                                                  │
│  ┌──────────────┬──────────────┬──────────────┐            │
│  │  Planned     │   Actual     │   Variance   │            │
│  │  45.5 hours  │  42.3 hours  │   -7%        │            │
│  └──────────────┴──────────────┴──────────────┘            │
│                                                              │
│  TODAY                                                      │
│  ┌──────────────┬──────────────┬──────────────┐            │
│  │  Planned     │   Completed  │   Remaining  │            │
│  │  9.5 hours   │  4.5 hours   │   5 hours    │            │
│  └──────────────┴──────────────┴──────────────┘            │
│                                                              │
│  TASK STATUS                                                │
│  To Do: 12 cards │ Doing: 3 │ On Hold: 2 │ Done: 45       │
│                                                              │
│  RECENT COMPLETIONS                                         │
│  ✓ [Card Name] - Est: 2h, Actual: 2h 15m (+12%)           │
│  ✓ [Card Name] - Est: 45m, Actual: 40m (-11%)             │
│  ✓ [Card Name] - Est: 1h 30m, Actual: 2h 45m (+83%) ⚠️    │
│                                                              │
│  SIGNIFICANT VARIANCES (>25%)                               │
│  ⚠️ [Card Name] - took 83% longer than estimated           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Morning Email Briefing

```
Subject: Your Tasks for Monday, Dec 23 - 9.5 hours planned

Good morning!

TODAY'S PRIORITIES
==================

1. Fix broken contact form on company website
   Board: Website Maintenance
   Next steps:
   - Diagnose form submission error (30m)
   - Fix PHP handler (45m)
   - Test all form fields (30m)
   Estimated: 1h 45m
   Due: Today
   → https://trello.com/c/xxxxx

2. Research competitor pricing for Q1 proposal
   Board: Sales
   Next steps:
   - Gather pricing from 5 competitors (1h 30m)
   - Create comparison spreadsheet (45m)
   - Write summary memo (1h)
   Estimated: 3h 15m
   Due: Dec 24
   → https://trello.com/c/xxxxx

3. [More cards...]

TOTAL PLANNED: 9h 30m

---

COMING UP (Next 2-3 days)
=========================
- Prepare Q1 proposal draft - Due Dec 24
- Client call prep for ABC Corp - Due Dec 26

---

ON HOLD (waiting)
=================
- Invoice follow-up - Waiting for: client response

---

Access your dashboard: https://[dashboard-url]
```

---

# DATA MODEL

```sql
-- Workspaces from Trello
workspaces (
  id UUID PRIMARY KEY,
  trello_id VARCHAR UNIQUE,
  name VARCHAR,
  last_synced TIMESTAMP
)

-- Boards from Trello
boards (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces,
  trello_id VARCHAR UNIQUE,
  name VARCHAR,
  last_synced TIMESTAMP
)

-- Cards from Trello
cards (
  id UUID PRIMARY KEY,
  board_id UUID REFERENCES boards,
  trello_id VARCHAR UNIQUE,
  list_name VARCHAR,
  title VARCHAR,
  description TEXT,
  due_date TIMESTAMP,
  assigned_member_id VARCHAR,
  raw_data JSONB,
  last_synced TIMESTAMP
)

-- Attachments with extracted content
attachments (
  id UUID PRIMARY KEY,
  card_id UUID REFERENCES cards,
  trello_id VARCHAR,
  filename VARCHAR,
  file_type VARCHAR,
  url VARCHAR,
  extracted_content TEXT,
  extraction_status VARCHAR, -- pending/success/failed/unreadable
  extracted_at TIMESTAMP
)

-- Comments from Trello
comments (
  id UUID PRIMARY KEY,
  card_id UUID REFERENCES cards,
  trello_id VARCHAR,
  author VARCHAR,
  text TEXT,
  created_at TIMESTAMP
)

-- AI-generated understanding of each card
card_understanding (
  id UUID PRIMARY KEY,
  card_id UUID REFERENCES cards UNIQUE,
  goal TEXT,
  deliverable TEXT,
  entities JSONB,
  deadlines JSONB,
  dependencies JSONB,
  produces JSONB,
  domain VARCHAR,
  complexity VARCHAR, -- simple/medium/complex
  clarity_score INTEGER, -- 1-10
  missing_info TEXT,
  generated_at TIMESTAMP
)

-- Relationships between cards
card_relationships (
  id UUID PRIMARY KEY,
  card_a_id UUID REFERENCES cards,
  card_b_id UUID REFERENCES cards,
  relationship_type VARCHAR, -- depends_on/enables/same_project/same_entity/contradicts/duplicates
  strength VARCHAR, -- weak/medium/strong
  reasoning TEXT,
  UNIQUE(card_a_id, card_b_id)
)

-- Extracted entities across all cards
entities (
  id UUID PRIMARY KEY,
  type VARCHAR, -- person/organization/case/system/document/date
  name VARCHAR,
  details JSONB,
  UNIQUE(type, name)
)

-- Links entities to cards where they appear
entity_mentions (
  id UUID PRIMARY KEY,
  entity_id UUID REFERENCES entities,
  card_id UUID REFERENCES cards,
  context TEXT, -- snippet where mentioned
  UNIQUE(entity_id, card_id)
)

-- Generated checklists (versioned)
checklists (
  id UUID PRIMARY KEY,
  card_id UUID REFERENCES cards,
  version INTEGER,
  status VARCHAR, -- active/superseded
  total_estimated_minutes INTEGER,
  assumptions TEXT,
  generated_at TIMESTAMP
)

-- Individual checklist items
checklist_items (
  id UUID PRIMARY KEY,
  checklist_id UUID REFERENCES checklists,
  trello_checklist_item_id VARCHAR,
  position INTEGER,
  description TEXT,
  estimated_minutes INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  actual_minutes INTEGER,
  was_modified BOOLEAN DEFAULT FALSE,
  original_description TEXT,
  modification_reason TEXT
)

-- Time logs for learning
time_logs (
  id UUID PRIMARY KEY,
  checklist_item_id UUID REFERENCES checklist_items,
  worker_id UUID REFERENCES workers,
  estimated_minutes INTEGER,
  actual_minutes INTEGER,
  variance_percent DECIMAL,
  logged_at TIMESTAMP
)

-- Learning data for system improvement
learning_data (
  id UUID PRIMARY KEY,
  type VARCHAR, -- calibration/modification/outcome
  data JSONB,
  created_at TIMESTAMP
)

-- Worker profiles
workers (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users,
  trello_member_id VARCHAR,
  name VARCHAR,
  email VARCHAR,
  timezone VARCHAR,
  working_hours_start TIME,
  working_hours_end TIME,
  working_days VARCHAR, -- e.g., "mon,tue,wed,thu,fri"
  calibration_factor DECIMAL DEFAULT 1.0,
  is_onboarding BOOLEAN DEFAULT TRUE,
  onboarding_tasks_completed INTEGER DEFAULT 0
)

-- Daily summaries for reporting
daily_summaries (
  id UUID PRIMARY KEY,
  worker_id UUID REFERENCES workers,
  date DATE,
  planned_minutes INTEGER,
  actual_minutes INTEGER,
  tasks_completed INTEGER,
  tasks_planned INTEGER,
  variance_percent DECIMAL,
  was_unavailable BOOLEAN DEFAULT FALSE
)
```

---

# BUILD ORDER

1. **Data Ingestion Pipeline** - Get all Trello data including attachments
2. **Attachment Processor** - Extract content from all file types
3. **Knowledge Builder** - Generate understanding for each card
4. **Relationship Mapper** - Detect true relationships between cards
5. **Breakdown Generator** - Create accurate checklists
6. **Trello Writer** - Push checklists back to Trello
7. **Webhook Receiver** - Real-time sync
8. **Time Tracking** - Capture actual vs estimated
9. **Learning Engine** - Improve over time
10. **User Interfaces** - Worker dashboard, Founder dashboard, Email briefings

---

*Document created: December 2024*
*Based on: Discovery session + Architecture design*
