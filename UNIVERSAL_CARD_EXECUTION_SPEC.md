# Universal Card Execution System (UCES)
## Complete Specification

**Version:** 1.0  
**Date:** January 4, 2026  
**Status:** Ready for Development  

---

## Executive Summary

The Universal Card Execution System transforms every Trello card into a self-executing task that produces decision-ready proposals with complete working artifacts. The system operates on the principle: **Robots First → Virtual Workers Second → Founder Last**.

Every card automatically receives:
1. Complete context analysis (from content, comments, attachments, and related cards)
2. Three decision options (A/B/C) with immediate artifacts
3. A knowledge base that grows and learns over time
4. Smart interview capability for gap-filling
5. Automatic Trello integration (comments, checklists, attachments)

The founder only intervenes when a decision is needed. Everything else is automated or delegated to the VA.

---

## Core Principles

### 1. Process-Based, Not Topic-Based

Every card follows the same execution pipeline regardless of type (legal, creative, technical, admin). This ensures consistency and reliability.

### 2. Robots First, VW Second, Founder Last

**Automation priority order:**
1. Fully automated tasks (file creation, analysis, drafting)
2. Tasks delegated to Joyce (VA) with clear instructions
3. Tasks requiring founder decision only

### 3. Work While Learning

The system starts working immediately with available information, runs interviews in parallel to fill gaps, and retroactively updates its work as new information arrives.

### 4. Context Awareness

The system understands the actual MEANING and CONTENT of each card, not just metadata. It builds semantic understanding through:
- Card description, comments, and all attachments
- Related cards' knowledge bases (queried dynamically)
- Historical patterns from previous similar cards

### 5. Traceability

Every decision, assumption, and artifact is traceable to its source. The system quotes exact snippets from evidence when relevant.

---

## System Architecture

### Phase 1: Pre-Analysis (Automatic)

**Trigger:** Card is created or modified

**Process:**
1. Extract all card metadata (title, description, comments, due date, labels, assigned members)
2. Analyze all attachments:
   - PDFs: Extract text and structure
   - Word/Excel: Parse content
   - Images: Run OCR
   - Video/Audio: Transcribe
   - Other formats: Extract metadata
3. Query related cards' knowledge bases for context
4. Determine card type (contextually, not from fixed categories)
5. Identify risks/compliance issues (deadlines, legal sensitivity, privacy, dependencies)
6. Build initial knowledge base entry

**Output:**
- Pre-analysis summary (what we know, what's unknown)
- Confidence level (0-100%)
- List of assumptions made
- Identified gaps

### Phase 2: Parallel Execution & Interview

**Trigger:** Pre-analysis complete

**Process:**
1. **Immediate Work:**
   - Create 3 decision options (A/B/C) with scope, effort, dependencies
   - Generate artifacts (drafts, templates, checklists, comparison tables)
   - Categorize and attach artifacts to card ([DRAFT], [TEMPLATE], [FINAL])
   - Identify blocking items
   - Create/update card structure (Objective, Context, Inputs, Constraints, Outputs, Decision Owner)

2. **Parallel Interview (if confidence < 100%):**
   - Generate interview questions based on gaps only
   - Prioritize by impact (high-impact questions first)
   - Ask one question at a time
   - Validate answers (reject vague responses, probe deeper)
   - Update work retroactively as new information arrives
   - Stop when confidence reaches acceptable level

**Output:**
- 3 decision options ready for approval
- Generated artifacts (attached to card)
- Updated card structure
- Interview transcript (if conducted)
- Updated confidence level

### Phase 3: Decision & Execution

**Trigger:** Founder approves one option

**Process:**
1. Post decision summary to Trello comment
2. Update card checklist with execution steps
3. Preserve any existing checked-off items
4. Merge new steps with existing ones (avoid duplicates)
5. Assign tasks to Joyce or automation
6. Set up monitoring for blockers

**Output:**
- Trello comment with decision and next steps
- Updated checklist with execution plan
- Clear assignment of who does what

### Phase 4: Execution & Learning

**Trigger:** Joyce starts executing or automation runs

**Process:**
1. Execute assigned tasks
2. Track completion and blockers
3. If Joyce edits/corrects steps: learn from the correction
4. Update card's knowledge base with learnings
5. Make this knowledge available to related cards

**Output:**
- Completed work
- Updated knowledge base
- Improved system understanding for future similar cards

---

## Knowledge Base System

### Per-Card Knowledge Base

Each card has its own knowledge base containing:
- Card objective and success criteria
- Context and history
- All extracted information from attachments
- Assumptions made and their status
- Decisions and rationale
- Execution steps and results
- Learnings and corrections

### Dynamic Querying Between Cards

When analyzing a new card, the system can query other cards' knowledge bases:
- **Semantic search:** "Does any card know about Woonzorgnet?" finds related disputes, contracts, communications
- **Contextual linking:** Not pre-defined; happens at query time
- **Cross-pollination:** Learnings from Card A automatically improve analysis of Card B

### Learning from Corrections

When Joyce or the founder corrects/edits something:
1. The correction is captured
2. The system analyzes WHY it was wrong
3. The pattern is added to the knowledge base
4. Future similar cards benefit from this learning

---

## Interview System

### When Interview Happens

- **Always optional:** Available to upgrade from high confidence to full confidence
- **Parallel execution:** Runs alongside initial work, not blocking it
- **Gap-focused:** Only asks about unknowns, skips what's already known

### Interview Characteristics

- **One question at a time:** User answers yes/no or brief response
- **Forced specificity:** Rejects vague answers ("the client" → "which specific person?")
- **Smart probing:** Asks "why?" and "what outcome?" to uncover real goals
- **Confidence tracking:** Shows confidence level increasing as gaps close
- **Retroactive updates:** As answers come in, the system updates its work

### Interview Questions

Generated dynamically based on:
- What's unknown (gaps in the 6 card structure fields)
- What's high-impact (goal before details)
- What's not already known from other cards
- Card-specific context

### Validation Rules

Every answer is validated for:
- **Specificity:** Not vague (e.g., "the client" rejected, "Woonzorgnet" accepted)
- **Measurability:** Can you verify when it's done?
- **Outcome-focus:** Is it a goal or just a task?
- **Completeness:** Does it answer the question fully?

---

## Universal Card Structure

Every card should have these 6 sections in the description:

### 1. Objective / Done Means
What success looks like in measurable terms. Example: "Get Woonzorgnet to pay €12,450 for unpaid WMO hours"

### 2. Context
What happened and why it matters. Example: "Joyce worked 450 hours in 2023 at €27.67/hour but was never paid. We've documented everything."

### 3. Inputs
Attachments and links needed. Example: "Time logs (spreadsheet), email correspondence (PDF), contract (PDF)"

### 4. Constraints
Deadlines, budget, tone, must/never. Example: "Deadline: Jan 31, 2026. Tone: formal/legal. Must include evidence."

### 5. Outputs Required
What deliverables are needed. Example: "Formal demand letter, tracking spreadsheet, evidence package"

### 6. Decision Owner
Who decides. Example: "Founder approves final letter before sending"

**System behavior:** If these sections are missing, the system auto-creates them and pre-fills with extracted information.

---

## Decision Options Format

Every card generates exactly 3 options:

### Option A: Recommended
- **Scope:** What it includes
- **Effort:** Time/resources needed
- **Dependencies:** What needs to happen first
- **What you need from me:** Specific inputs required

### Option B: Faster/Cheaper
- **Scope:** What's cut
- **Effort:** Time/resources saved
- **Trade-offs:** What you're sacrificing
- **What you need from me:** Specific inputs required

### Option C: Safer/More Thorough
- **Scope:** What's added
- **Effort:** Additional time/resources
- **Risk mitigation:** What's protected
- **What you need from me:** Specific inputs required

---

## Artifact Management

### Artifact Types

- **[DRAFT]** - Working versions, incomplete
- **[TEMPLATE]** - Reusable templates for similar tasks
- **[FINAL]** - Completed, approved versions
- **[EVIDENCE]** - Source documents, proof
- **[REFERENCE]** - Background info, examples

### Artifact Lifecycle

1. **Creation:** System creates artifacts immediately (not as steps to do)
2. **Storage:** Attached to Trello card with category prefix
3. **Categorization:** System reads content to determine type
4. **Cleanup:** Temporary artifacts ([DRAFT], [TEMPLATE]) auto-deleted when:
   - Final version is created
   - Card is completed/archived
   - 30 days have passed (configurable)

### Attachment Display

The Power-Up shows attachments in tabbed view:
- **Drafts** - All [DRAFT] items
- **Templates** - All [TEMPLATE] items
- **Finals** - All [FINAL] items
- **Evidence** - All [EVIDENCE] items
- **Reference** - All [REFERENCE] items

---

## Risk & Compliance Check

Automatically flagged for every card:

### Deadline Risk
- Is there a deadline?
- How much time remains?
- Is it realistic given the work?

### Legal/Compliance Risk
- Does this involve government/legal parties?
- Are there privacy concerns?
- Are there contractual obligations?
- What's the formal tone requirement?

### Dependency Risk
- What could block progress?
- What approvals are needed?
- What external factors matter?

### Execution Risk
- What could go wrong?
- What mitigations exist?
- What's the fallback plan?

---

## Trello Power-Up Integration

### Card-Level Features

**Button:** "VA Dashboard" (opens side panel)

**Side Panel Tabs:**
1. **Interview** - Chat interface + confidence meter
2. **Decisions** - The 3 options (A/B/C)
3. **Knowledge Base** - Summary of what the system knows
4. **Attachments** - Tabbed view (Drafts/Templates/Finals/Evidence/Reference)

### Power-Up Capabilities

- Read card content, comments, attachments
- Create/update checklists
- Add comments
- Upload attachments
- Query other cards' knowledge bases
- Store knowledge base data
- Trigger interview
- Show confidence level
- Display decision options

### Standalone Dashboard

Remains accessible outside Trello for:
- Board-level overview
- Historical analysis
- System settings
- Knowledge base management
- Analytics

---

## Confidence Scoring

### Calculation

Confidence is 0-100% based on:
- **Goal clarity:** Is the objective measurable? (0-20%)
- **Context completeness:** Do we understand the situation? (0-20%)
- **Input availability:** Do we have all needed information? (0-20%)
- **Constraint clarity:** Are deadlines/limits clear? (0-20%)
- **Success criteria:** Can we verify when it's done? (0-20%)

### Thresholds

- **0-40%:** Low confidence - interview required before proceeding
- **40-70%:** Medium confidence - proceed with assumptions, interview optional
- **70-100%:** High confidence - can skip interview, but it's available to reach 100%
- **100%:** Full confidence - ready for execution

### Progression

- Pre-analysis: Initial confidence based on card content
- Interview: Confidence increases with each validated answer
- Execution: Confidence increases as work confirms assumptions
- Learning: Future similar cards start with higher confidence

---

## Automation Confidence Levels

### High Confidence (Auto-Execute)
- Creating standard templates
- Drafting based on clear precedent
- Organizing existing information
- Extracting data from attachments
- Generating comparison tables

### Medium Confidence (Joyce Reviews First)
- Drafting novel documents
- Making assumptions about tone/approach
- Creating new processes
- Combining information from multiple sources

### Low Confidence (Founder Decides)
- Strategic choices
- Approvals needed
- Legal/compliance decisions
- Budget decisions
- Policy changes

---

## Traceability & Evidence

### Citation Rules

When the system references information:
1. Quote exact snippets from source
2. Link to the source (attachment, comment, related card)
3. Include context (where in the document, when it was added)

### Assumption Tracking

Every assumption is labeled:
- What the assumption is
- Why it was made
- What evidence supports it
- What would change if it's wrong

### Decision Audit Trail

Every decision is recorded:
- Who made it (founder, VA, automation)
- When it was made
- What options were available
- Why this option was chosen
- What changed as a result

---

## Execution Steps Format

When the system generates steps:

**Each step includes:**
- **Action:** What to do
- **Output:** What artifact/result is created
- **Where stored:** Location (Trello attachment, Drive folder, etc.)
- **Evidence needed:** What proof is required
- **Completion criteria:** How to know it's done
- **Owner:** Who does this (automation, Joyce, founder)
- **Blocker:** What could stop this

**Example:**
```
Step 1: Draft formal demand letter
- Action: Compose letter with claims, evidence references, and demands
- Output: Letter document (Word or PDF)
- Where stored: [DRAFT] Demand letter v1.docx (Trello attachment)
- Evidence needed: Time logs, contract, email proof
- Completion: Letter is complete and ready for review
- Owner: Automation (AI drafts) → Joyce (edits) → Founder (approves)
- Blocker: Need founder approval on tone before sending
```

---

## Error Handling & Fallbacks

### When Information is Missing

1. Make best-effort assumption
2. Clearly label it as assumption
3. Continue working
4. Allow correction via interview or manual input
5. Update knowledge base when corrected

### When Confidence is Too Low

1. Proceed with available information
2. Offer interview to fill gaps
3. Flag high-risk items for founder review
4. Don't block execution

### When Automation Fails

1. Escalate to Joyce with clear explanation
2. Provide manual alternative
3. Log the failure for learning
4. Suggest process improvement

---

## Learning System

### What the System Learns

1. **From corrections:** When Joyce edits a step, the system learns why
2. **From approvals:** When founder approves an option, the system learns what matters
3. **From execution:** When work is completed, the system learns what worked
4. **From related cards:** Patterns across similar cards

### How Learning Works

1. **Capture:** Every action is recorded (edit, approval, completion)
2. **Analyze:** System identifies the pattern
3. **Store:** Pattern is added to knowledge base
4. **Apply:** Future similar cards benefit from the pattern
5. **Verify:** System checks if the learning improved outcomes

### Example Learning

- **Observation:** Founder always removes "stakeholder coordination" steps
- **Pattern:** Founder works alone with Joyce, no external stakeholders
- **Learning:** Don't generate stakeholder steps for this founder
- **Application:** Future cards skip stakeholder-related steps automatically

---

## Performance & Scalability

### Expected Performance

- **Pre-analysis:** < 5 seconds for typical card
- **Interview:** 2-5 minutes per card (user-paced)
- **Artifact generation:** < 30 seconds for typical artifacts
- **Knowledge base query:** < 2 seconds across 100+ cards

### Scalability

- System handles 100+ cards efficiently
- Knowledge base queries remain fast (semantic indexing)
- Parallel processing for independent tasks
- Caching of frequently accessed information

---

## Security & Privacy

### Data Protection

- All card data stays within Trello
- Attachments are processed securely
- Knowledge bases are user-specific
- No data shared between different founders

### Access Control

- Only authenticated users can access their cards
- Joyce has full access to all cards
- Founder has full access to all cards
- External users have no access

### Compliance

- GDPR compliant (data minimization, right to deletion)
- SOC 2 ready (audit trails, access logs)
- Encryption in transit and at rest

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Pre-analysis engine
- [ ] Knowledge base per card
- [ ] Basic interview system
- [ ] Trello integration (comments, checklists)

### Phase 2: Execution (Weeks 3-4)
- [ ] Decision options generation
- [ ] Artifact creation and management
- [ ] Confidence scoring
- [ ] Power-Up development

### Phase 3: Learning (Weeks 5-6)
- [ ] Learning system
- [ ] Cross-card knowledge queries
- [ ] Pattern detection
- [ ] Retroactive updates

### Phase 4: Polish (Weeks 7-8)
- [ ] UI/UX refinement
- [ ] Performance optimization
- [ ] Testing and QA
- [ ] Documentation

---

## Success Metrics

### For the Founder

- **Time saved:** Reduce decision time from hours to minutes
- **Clarity:** Never need to re-explain a card
- **Completeness:** No forgotten steps or missing artifacts
- **Confidence:** Know every card is being handled optimally

### For Joyce (VA)

- **Efficiency:** Clear steps, all artifacts ready, no guessing
- **Autonomy:** Can complete most tasks without asking for clarification
- **Learning:** System improves over time, reducing manual work
- **Satisfaction:** Work feels organized and purposeful

### For the System

- **Accuracy:** Confidence level matches actual execution success
- **Learning:** Each card improves future similar cards
- **Automation:** Increasing % of work done without human intervention
- **Reliability:** Consistent quality across all card types

---

## Glossary

**Card:** A Trello card representing a task or project

**Knowledge Base:** The system's understanding of a card's context, built from content, comments, attachments, and learnings

**Confidence:** 0-100% measure of how well the system understands the card's goal and requirements

**Interview:** Conversational Q&A to fill gaps and increase confidence

**Decision Options:** Three approaches (A/B/C) for executing the card

**Artifact:** Output created by the system (draft, template, final document, etc.)

**Blocker:** Something that prevents progress and needs resolution

**Assumption:** Information the system inferred rather than explicitly stated

**Power-Up:** Trello integration that adds the system's features to cards

**VA (Virtual Worker):** Joyce, the assistant who executes tasks

**Founder:** You, who makes strategic decisions

---

## Questions & Next Steps

**For the Developer:**
1. Review this specification
2. Identify technical challenges
3. Propose implementation approach
4. Create detailed technical design

**For the Founder:**
1. Validate this matches your vision
2. Identify any missing requirements
3. Prioritize features for Phase 1
4. Approve to proceed with development

---

**Document Status:** Ready for Review  
**Last Updated:** January 4, 2026  
**Next Review:** After developer feedback
