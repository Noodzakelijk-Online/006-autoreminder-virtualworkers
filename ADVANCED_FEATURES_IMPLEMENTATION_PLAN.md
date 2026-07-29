# Advanced Features Implementation Plan
## VA Task Dashboard - Three Major Features

---

## Overview

This document outlines the implementation plans for three major missing features:

1. **Advanced Scheduling** - Calendar drag-and-drop, batch re-analysis, keyboard shortcuts
2. **ATIS Phases 3-10** - Advanced task analysis with 8 additional phases
3. **Universal Card Execution System (UCES)** - Decision generation, artifacts, learning system

---

# FEATURE 1: ADVANCED SCHEDULING

## 1.1 Current State

**What's Already Implemented**:
- ✅ Basic task scheduling algorithm
- ✅ Working hours configuration
- ✅ Holiday calendar integration
- ✅ Bulk rescheduling API
- ✅ Timeline visualization
- ✅ Timezone support

**What's Missing**:
- ❌ Calendar drag-and-drop UI
- ❌ Trello sync on schedule changes
- ❌ Batch re-analysis with progress tracking
- ❌ Advanced keyboard shortcuts
- ❌ Conflict resolution UI
- ❌ Schedule optimization suggestions

## 1.2 Feature Breakdown

### Feature 1.2.1: Calendar Drag-and-Drop

**Objective**: Allow users to drag tasks between days/times on a calendar view

**Components to Create**:
- `CalendarView.tsx` - Main calendar component with drag-and-drop
- `DraggableTaskCard.tsx` - Task card that can be dragged
- `DropZone.tsx` - Drop target for specific time slots
- `CalendarGrid.tsx` - Grid layout for calendar

**Backend Requirements**:
- `POST /api/tasks/reschedule-single` - Update single task date/time
- Validate new time slot against working hours
- Check for conflicts with other tasks
- Sync changes back to Trello

**Frontend Logic**:
```typescript
// Drag start: capture task and original position
onDragStart(task, originalDate, originalTime)

// Drag over: show drop zones for valid time slots
onDragOver(date, time) → validate against working hours

// Drop: update task with new date/time
onDrop(task, newDate, newTime) → call API → update UI

// Undo: restore original position if API fails
onError() → revert to original position
```

**Data Flow**:
```
User drags task
  ↓
Frontend validates new time slot
  ↓
API call: POST /api/tasks/reschedule-single
  ↓
Backend checks conflicts
  ↓
Update database
  ↓
Sync to Trello
  ↓
Update UI
  ↓
Show success/error toast
```

**Constraints**:
- Cannot schedule outside working hours
- Cannot overlap with other tasks
- Cannot schedule on holidays
- Cannot schedule on non-working days
- Must respect task dependencies

### Feature 1.2.2: Batch Re-Analysis with Progress Tracking

**Objective**: Re-analyze multiple tasks and show progress in real-time

**Components to Create**:
- `BatchReAnalysisDialog.tsx` - Dialog to trigger batch operation
- `ProgressTracker.tsx` - Real-time progress display
- `ReAnalysisResults.tsx` - Summary of changes

**Backend Requirements**:
- `POST /api/tasks/batch-re-analyze` - Start batch operation
- `GET /api/tasks/batch-re-analyze/:jobId` - Get progress
- `WebSocket /ws/batch-progress` - Real-time updates

**Frontend Logic**:
```typescript
// User selects tasks to re-analyze
selectedTasks = [task1, task2, task3, ...]

// Start batch operation
jobId = await startBatchReAnalysis(selectedTasks)

// Poll for progress
while (progress < 100) {
  progress = await getProgress(jobId)
  updateUI(progress)
  await sleep(500ms)
}

// Show results
showResults(jobId)
```

**Progress Tracking**:
```
Total tasks: 50
Completed: 15/50 (30%)
Current: Analyzing "Blog post - Announcement"
Estimated time: 2 minutes

[████░░░░░░░░░░░░░░░░░░░░░░░░░] 30%
```

**Results Display**:
```
Re-Analysis Complete

Changes:
- 15 tasks rescheduled
- 3 tasks marked as complete
- 2 tasks flagged for manual review
- 5 tasks have new insights

[View Details] [Apply All] [Discard]
```

### Feature 1.2.3: Advanced Keyboard Shortcuts

**Objective**: Enable power users to perform common actions via keyboard

**Shortcuts to Implement**:
```
Ctrl+D          - Open calendar drag-and-drop
Ctrl+R          - Trigger batch re-analysis
Ctrl+Shift+R    - Reschedule selected tasks
Ctrl+E          - Export schedule
Ctrl+I          - Show insights
Ctrl+?          - Show shortcuts help
Ctrl+Z          - Undo last change
Ctrl+Y          - Redo last change

Arrow Keys      - Navigate between tasks
Enter           - Open selected task
Space           - Mark task complete
Delete          - Remove task (with confirmation)

J/K             - Next/Previous task (Vim-style)
H/L             - Previous/Next day
G               - Go to today
```

**Implementation**:
- Create `useKeyboardShortcuts.ts` hook
- Create `KeyboardShortcutsHelp.tsx` component
- Store shortcuts in `shared/constants/shortcuts.ts`
- Add settings to customize shortcuts

## 1.3 Database Schema Changes

**Extend tasks table**:
```sql
ALTER TABLE tasks ADD COLUMN scheduledStartTime DATETIME;
ALTER TABLE tasks ADD COLUMN scheduledEndTime DATETIME;
ALTER TABLE tasks ADD COLUMN lastRescheduledAt DATETIME;
ALTER TABLE tasks ADD COLUMN lastRescheduledBy VARCHAR(64);
ALTER TABLE tasks ADD COLUMN rescheduleReason VARCHAR(255);
```

**New table: task_schedule_history**:
```sql
CREATE TABLE task_schedule_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  taskId VARCHAR(64) NOT NULL,
  previousStartTime DATETIME,
  previousEndTime DATETIME,
  newStartTime DATETIME,
  newEndTime DATETIME,
  changedBy VARCHAR(64),
  reason VARCHAR(255),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (taskId) REFERENCES tasks(id)
);
```

**New table: batch_operations**:
```sql
CREATE TABLE batch_operations (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(64) NOT NULL,
  operationType VARCHAR(50),
  totalTasks INT,
  completedTasks INT,
  status VARCHAR(20),
  progress DECIMAL(5,2),
  startedAt DATETIME,
  completedAt DATETIME,
  results JSON,
  FOREIGN KEY (userId) REFERENCES users(openId)
);
```

## 1.4 API Endpoints

**New Endpoints**:
```typescript
POST /api/tasks/reschedule-single
  Input: { taskId, newDate, newTime }
  Output: { success, task, conflicts }
  
POST /api/tasks/batch-re-analyze
  Input: { taskIds, strategy }
  Output: { jobId, estimatedTime }
  
GET /api/tasks/batch-re-analyze/:jobId
  Output: { progress, status, currentTask, eta }
  
GET /api/tasks/schedule-history/:taskId
  Output: [{ previousTime, newTime, reason, changedBy, date }]
  
POST /api/tasks/undo-reschedule/:taskId
  Output: { success, task }
```

## 1.5 Implementation Steps

**Phase 1: Drag-and-Drop Calendar** (3 days)
1. Create calendar grid component
2. Implement drag-and-drop logic
3. Add validation for time slots
4. Create reschedule API endpoint
5. Integrate Trello sync
6. Test with various scenarios

**Phase 2: Batch Re-Analysis** (3 days)
1. Create batch operation backend
2. Implement progress tracking
3. Create progress UI components
4. Add WebSocket for real-time updates
5. Create results display
6. Test with large batches

**Phase 3: Keyboard Shortcuts** (2 days)
1. Create shortcuts hook
2. Implement all shortcuts
3. Create help dialog
4. Add settings for customization
5. Test all combinations

## 1.6 Success Criteria

✅ **Drag-and-Drop**:
- Users can drag tasks to new dates/times
- Validation prevents invalid scheduling
- Changes sync to Trello
- Undo works correctly

✅ **Batch Re-Analysis**:
- Progress updates in real-time
- Can handle 100+ tasks
- Results are accurate
- Undo batch operation works

✅ **Keyboard Shortcuts**:
- All shortcuts work as documented
- Help dialog is accessible
- Shortcuts can be customized
- No conflicts with browser shortcuts

---

# FEATURE 2: ATIS PHASES 3-10

## 2.1 Current State

**What's Already Implemented**:
- ✅ Phase 1: Initial understanding (task overview)
- ✅ Phase 2: Clarification (ask questions)
- ✅ Database persistence for interview states
- ✅ Interview history tracking

**What's Missing**:
- ❌ Phases 3-10 (advanced analysis)
- ❌ Confidence scoring refinement
- ❌ Pattern detection
- ❌ Risk assessment
- ❌ Resource estimation
- ❌ Timeline optimization

## 2.2 ATIS Phases 3-10 Breakdown

### Phase 3: Decomposition
**Purpose**: Break task into subtasks and components

**Questions**:
- What are the main subtasks?
- What dependencies exist between subtasks?
- What is the critical path?
- What can be parallelized?

**Output**:
```json
{
  "subtasks": [
    { "name": "Research", "duration": "2h", "dependencies": [] },
    { "name": "Drafting", "duration": "3h", "dependencies": ["Research"] },
    { "name": "Review", "duration": "1h", "dependencies": ["Drafting"] }
  ],
  "criticalPath": ["Research", "Drafting", "Review"],
  "parallelizable": [],
  "estimatedTotal": "6h"
}
```

### Phase 4: Risk Assessment
**Purpose**: Identify potential risks and mitigation strategies

**Questions**:
- What could go wrong?
- What dependencies are risky?
- What external factors could impact this?
- What's the contingency plan?

**Output**:
```json
{
  "risks": [
    { "risk": "Unclear requirements", "probability": "high", "impact": "high", "mitigation": "Schedule clarification call" },
    { "risk": "Third-party API delay", "probability": "medium", "impact": "high", "mitigation": "Use fallback API" }
  ],
  "riskScore": 0.65,
  "contingencyTime": "2h"
}
```

### Phase 5: Resource Estimation
**Purpose**: Estimate required resources and skills

**Questions**:
- What skills are required?
- What tools/resources are needed?
- What's the learning curve?
- Are there skill gaps?

**Output**:
```json
{
  "requiredSkills": ["Python", "API integration", "Database design"],
  "skillGaps": ["Advanced caching"],
  "tools": ["VS Code", "Postman", "Docker"],
  "trainingNeeded": "2h",
  "estimatedSkillLevel": 7,
  "recommendedWorker": "Senior Developer"
}
```

### Phase 6: Timeline Optimization
**Purpose**: Create optimal schedule considering all factors

**Questions**:
- What's the optimal order?
- Where can we save time?
- What's the minimum viable timeline?
- What buffers are needed?

**Output**:
```json
{
  "optimizedTimeline": [
    { "phase": "Research", "start": "09:00", "end": "11:00", "buffer": "0.5h" },
    { "phase": "Drafting", "start": "11:30", "end": "14:30", "buffer": "1h" },
    { "phase": "Review", "start": "15:30", "end": "16:30", "buffer": "0.5h" }
  ],
  "totalTime": "6h",
  "bufferTime": "2h",
  "recommendedStartTime": "09:00",
  "recommendedEndTime": "17:00"
}
```

### Phase 7: Quality Assurance
**Purpose**: Define quality standards and testing strategy

**Questions**:
- What are the quality criteria?
- How will we test?
- What's the acceptance criteria?
- What edge cases should we cover?

**Output**:
```json
{
  "qualityCriteria": ["Code coverage > 80%", "Performance < 100ms", "Zero critical bugs"],
  "testingStrategy": "Unit + Integration + E2E",
  "acceptanceCriteria": ["All tests pass", "Code review approved"],
  "edgeCases": ["Empty input", "Large datasets", "Concurrent requests"],
  "estimatedTestTime": "2h"
}
```

### Phase 8: Documentation Requirements
**Purpose**: Identify documentation needs

**Questions**:
- What needs to be documented?
- Who is the audience?
- What format is needed?
- How much detail is required?

**Output**:
```json
{
  "documentation": [
    { "type": "API docs", "audience": "Developers", "format": "OpenAPI", "effort": "1h" },
    { "type": "User guide", "audience": "End users", "format": "Markdown", "effort": "2h" },
    { "type": "Architecture", "audience": "Architects", "format": "Diagrams", "effort": "1.5h" }
  ],
  "totalDocumentationTime": "4.5h"
}
```

### Phase 9: Dependencies & Blockers
**Purpose**: Identify external dependencies and potential blockers

**Questions**:
- What external dependencies exist?
- What could block progress?
- What approvals are needed?
- What's the critical path?

**Output**:
```json
{
  "externalDependencies": [
    { "item": "API access", "owner": "DevOps", "eta": "2 days", "risk": "medium" },
    { "item": "Design approval", "owner": "Design team", "eta": "1 day", "risk": "low" }
  ],
  "blockers": ["Waiting for design", "Missing API credentials"],
  "approvalsNeeded": ["Tech lead", "Product owner"],
  "criticalPath": ["Get API access", "Design approval", "Development"]
}
```

### Phase 10: Final Recommendations
**Purpose**: Provide final recommendations and confidence score

**Questions**:
- Is this task ready to start?
- What's the confidence level?
- What are the top recommendations?
- What should we monitor?

**Output**:
```json
{
  "readyToStart": true,
  "confidenceScore": 0.85,
  "recommendations": [
    "Start with research phase",
    "Schedule clarification call before starting",
    "Allocate extra buffer time for API integration",
    "Have backup plan for third-party API"
  ],
  "monitoringPoints": [
    "API response times",
    "Code review feedback",
    "Testing results"
  ],
  "nextSteps": ["Schedule kick-off meeting", "Assign to senior developer"]
}
```

## 2.3 Interview Flow

**User Journey**:
```
Phase 1: Initial Understanding
  ↓
Phase 2: Clarification
  ↓
Phase 3: Decomposition (auto-generate from phases 1-2)
  ↓
Phase 4: Risk Assessment (user confirms/modifies)
  ↓
Phase 5: Resource Estimation (auto-generate)
  ↓
Phase 6: Timeline Optimization (auto-generate)
  ↓
Phase 7: Quality Assurance (user confirms)
  ↓
Phase 8: Documentation (auto-generate)
  ↓
Phase 9: Dependencies (user identifies)
  ↓
Phase 10: Final Recommendations (auto-generate)
  ↓
Generate APTLSS Checklist
```

## 2.4 Database Schema

**New table: interview_phase_results**:
```sql
CREATE TABLE interview_phase_results (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sessionId VARCHAR(36),
  phase INT,
  result JSON,
  confidence DECIMAL(3,2),
  userModified BOOLEAN,
  createdAt DATETIME,
  FOREIGN KEY (sessionId) REFERENCES interview_sessions(id)
);
```

## 2.5 API Endpoints

**New Endpoints**:
```typescript
POST /api/interview/phase/:phaseNumber/analyze
  Input: { sessionId, previousPhaseResults }
  Output: { phaseResult, confidence, questions }
  
POST /api/interview/phase/:phaseNumber/confirm
  Input: { sessionId, phaseNumber, result }
  Output: { success, nextPhase }
  
GET /api/interview/:sessionId/aptlss-checklist
  Output: { checklist, confidence, recommendations }
```

## 2.6 Implementation Steps

**Phase 1: Phases 3-5** (4 days)
1. Create decomposition analysis
2. Create risk assessment
3. Create resource estimation
4. Integrate with LLM
5. Test accuracy

**Phase 2: Phases 6-8** (3 days)
1. Create timeline optimization
2. Create QA planning
3. Create documentation requirements
4. Integrate with LLM
5. Test output quality

**Phase 3: Phases 9-10** (2 days)
1. Create dependency identification
2. Create final recommendations
3. Integrate with LLM
4. Generate final APTLSS checklist
5. Test end-to-end flow

## 2.7 Success Criteria

✅ **All Phases Working**:
- Each phase generates accurate output
- Confidence scores are meaningful
- User can modify results
- Phases build on each other

✅ **APTLSS Generation**:
- Final checklist is comprehensive
- Covers all identified tasks
- Includes all recommendations
- Can be exported

---

# FEATURE 3: UNIVERSAL CARD EXECUTION SYSTEM (UCES)

## 3.1 Current State

**What's Already Implemented**:
- ✅ Basic task execution
- ✅ Task status tracking
- ✅ Trello sync

**What's Missing**:
- ❌ Decision options generation (A/B/C analysis)
- ❌ Artifact creation (drafts, templates)
- ❌ Learning system for pattern detection
- ❌ Cross-card semantic search
- ❌ Trello Power-Up development

## 3.2 Feature Breakdown

### Feature 3.2.1: Decision Options Generation (A/B/C Analysis)

**Objective**: Generate multiple execution approaches for each task

**Components to Create**:
- `DecisionOptionsPanel.tsx` - Display A/B/C options
- `OptionComparison.tsx` - Compare options side-by-side
- `OptionSelector.tsx` - Select preferred option

**Backend Requirements**:
- `POST /api/tasks/:taskId/generate-options` - Generate A/B/C options
- `POST /api/tasks/:taskId/select-option` - Record user choice

**Example Output**:
```json
{
  "taskId": "67e5ca392e52013c53693858",
  "title": "Blog post - Announcement",
  "options": [
    {
      "id": "option-a",
      "name": "Option A: Quick Draft",
      "description": "Write a quick 500-word draft using existing templates",
      "effort": "2 hours",
      "quality": "Medium",
      "pros": ["Fast", "Uses templates", "Easy review"],
      "cons": ["Less original", "May need heavy editing"],
      "steps": [
        "Open template",
        "Fill in key points",
        "Quick proofread",
        "Submit for review"
      ]
    },
    {
      "id": "option-b",
      "name": "Option B: Detailed Article",
      "description": "Write a comprehensive 2000-word article with research",
      "effort": "6 hours",
      "quality": "High",
      "pros": ["Comprehensive", "Original", "SEO optimized"],
      "cons": ["Time consuming", "Requires research"],
      "steps": [
        "Research topic",
        "Outline structure",
        "Write sections",
        "Add examples",
        "Proofread",
        "Submit"
      ]
    },
    {
      "id": "option-c",
      "name": "Option C: Collaborative",
      "description": "Outline + delegate writing to team members",
      "effort": "3 hours",
      "quality": "High",
      "pros": ["Distributed work", "Multiple perspectives", "Faster"],
      "cons": ["Coordination overhead", "Need team availability"],
      "steps": [
        "Create outline",
        "Assign sections",
        "Collect drafts",
        "Consolidate",
        "Final review"
      ]
    }
  ],
  "selectedOption": "option-a",
  "reasoning": "Quick turnaround needed for announcement"
}
```

### Feature 3.2.2: Artifact Creation (Drafts, Templates)

**Objective**: Generate drafts and templates to accelerate task execution

**Components to Create**:
- `ArtifactGenerator.tsx` - Generate artifacts
- `ArtifactPreview.tsx` - Preview generated artifacts
- `ArtifactLibrary.tsx` - Browse and reuse artifacts

**Backend Requirements**:
- `POST /api/tasks/:taskId/generate-artifact` - Generate draft/template
- `GET /api/artifacts/:taskId` - Get generated artifacts
- `POST /api/artifacts/:taskId/save` - Save artifact for reuse

**Example Artifacts**:

**Artifact 1: Blog Post Template**
```markdown
# [Title]

## Introduction
- Hook: [Your hook here]
- Context: [Background information]
- Thesis: [Main point]

## Section 1: [Topic]
- Key point 1
- Key point 2
- Key point 3

## Section 2: [Topic]
- Key point 1
- Key point 2
- Key point 3

## Conclusion
- Summary of key points
- Call to action
- Next steps

---
Word count: ~2000
Estimated read time: 8 minutes
```

**Artifact 2: Code Template**
```python
# [Module Name]
"""
[Description]

Usage:
    [example usage]
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

class [ClassName]:
    """[Class description]"""
    
    def __init__(self, [params]):
        """Initialize [class name]"""
        [initialization code]
    
    def [method_name](self, [params]) -> [return_type]:
        """[Method description]"""
        [method implementation]
        return [result]

if __name__ == "__main__":
    [example usage]
```

### Feature 3.2.3: Learning System for Pattern Detection

**Objective**: Learn from past task executions to improve future recommendations

**Components to Create**:
- `PatternAnalyzer.ts` - Analyze task patterns
- `LearningDashboard.tsx` - Display learned patterns
- `PatternRecommendations.tsx` - Show recommendations based on patterns

**Backend Requirements**:
- `POST /api/learning/record-execution` - Record task execution
- `GET /api/learning/patterns` - Get detected patterns
- `GET /api/learning/recommendations/:taskId` - Get recommendations

**Example Patterns**:
```json
{
  "patterns": [
    {
      "id": "pattern-1",
      "name": "Blog posts take 4-6 hours",
      "description": "Historical data shows blog posts consistently take 4-6 hours",
      "confidence": 0.92,
      "sampleSize": 15,
      "tasks": ["Blog post - Announcement", "Blog post - Tutorial", "Blog post - Case study"],
      "factors": [
        { "factor": "Research required", "impact": "+2h" },
        { "factor": "Use template", "impact": "-1h" },
        { "factor": "Complex topic", "impact": "+1.5h" }
      ]
    },
    {
      "id": "pattern-2",
      "name": "Code reviews are faster on Mondays",
      "description": "Code reviews submitted on Mondays are reviewed 30% faster",
      "confidence": 0.78,
      "sampleSize": 42,
      "recommendation": "Submit code reviews on Monday morning for faster turnaround"
    }
  ]
}
```

### Feature 3.2.4: Cross-Card Semantic Search

**Objective**: Find similar tasks and reuse solutions

**Components to Create**:
- `SemanticSearch.tsx` - Search interface
- `SimilarTasksPanel.tsx` - Display similar tasks
- `SolutionReuse.tsx` - Reuse solutions from similar tasks

**Backend Requirements**:
- `POST /api/search/semantic` - Semantic search
- `GET /api/tasks/:taskId/similar` - Find similar tasks
- `GET /api/tasks/:taskId/solutions` - Get solutions from similar tasks

**Example Usage**:
```
User searches: "How do I write a technical blog post?"

Results:
1. "Blog post - API Documentation" (95% similar)
   - Solution: Use code examples, structure with headers
   - Time taken: 5 hours
   - Artifacts: Template, code samples

2. "Blog post - Tutorial" (87% similar)
   - Solution: Step-by-step format, screenshots
   - Time taken: 6 hours
   - Artifacts: Tutorial template, screenshot guide

3. "Blog post - Case Study" (82% similar)
   - Solution: Problem-solution-results format
   - Time taken: 4 hours
   - Artifacts: Case study template
```

### Feature 3.2.5: Trello Power-Up Development

**Objective**: Create a Trello Power-Up for seamless integration

**Components to Create**:
- Trello Power-Up manifest
- Card back section showing APTLSS checklist
- Board button for batch operations
- Card button for decision options

**Trello Power-Up Features**:

**1. Card Back Section**:
```
┌─────────────────────────────────┐
│ APTLSS Checklist                │
├─────────────────────────────────┤
│ ✓ Analysis complete             │
│ ✓ Planning done                 │
│ ○ Testing in progress           │
│ ○ Learning phase pending        │
│ ○ Staging ready                 │
│ ○ Shipping ready                │
│                                 │
│ Confidence: 85%                 │
│ Estimated time: 6 hours         │
│                                 │
│ [View Details] [Edit]           │
└─────────────────────────────────┘
```

**2. Board Button**:
- "Re-analyze all cards"
- "Generate decision options"
- "View patterns"
- "Export schedule"

**3. Card Button**:
- "Start interview"
- "View options"
- "Generate artifacts"
- "Find similar tasks"

## 3.3 Database Schema

**New table: task_options**:
```sql
CREATE TABLE task_options (
  id VARCHAR(36) PRIMARY KEY,
  taskId VARCHAR(64),
  optionName VARCHAR(100),
  description TEXT,
  effort VARCHAR(50),
  quality VARCHAR(50),
  pros JSON,
  cons JSON,
  steps JSON,
  createdAt DATETIME,
  FOREIGN KEY (taskId) REFERENCES tasks(id)
);
```

**New table: artifacts**:
```sql
CREATE TABLE artifacts (
  id VARCHAR(36) PRIMARY KEY,
  taskId VARCHAR(64),
  type VARCHAR(50),
  name VARCHAR(255),
  content LONGTEXT,
  createdAt DATETIME,
  FOREIGN KEY (taskId) REFERENCES tasks(id)
);
```

**New table: execution_patterns**:
```sql
CREATE TABLE execution_patterns (
  id VARCHAR(36) PRIMARY KEY,
  patternName VARCHAR(255),
  description TEXT,
  confidence DECIMAL(3,2),
  sampleSize INT,
  factors JSON,
  createdAt DATETIME
);
```

**New table: semantic_embeddings**:
```sql
CREATE TABLE semantic_embeddings (
  id VARCHAR(36) PRIMARY KEY,
  taskId VARCHAR(64),
  embedding LONGBLOB,
  createdAt DATETIME,
  FOREIGN KEY (taskId) REFERENCES tasks(id)
);
```

## 3.4 API Endpoints

**New Endpoints**:
```typescript
POST /api/tasks/:taskId/generate-options
  Output: { options: Option[] }
  
POST /api/tasks/:taskId/select-option/:optionId
  Output: { success, selectedOption }
  
POST /api/tasks/:taskId/generate-artifact/:type
  Input: { type: "template" | "draft" }
  Output: { artifact }
  
GET /api/tasks/:taskId/similar
  Output: { similarTasks: Task[] }
  
GET /api/learning/patterns
  Output: { patterns: Pattern[] }
  
POST /api/learning/record-execution
  Input: { taskId, actualTime, quality, notes }
  Output: { success }
```

## 3.5 Implementation Steps

**Phase 1: Decision Options** (3 days)
1. Create decision options generator
2. Create comparison UI
3. Integrate with LLM
4. Test with various task types

**Phase 2: Artifacts** (3 days)
1. Create artifact generator
2. Create artifact library
3. Implement artifact storage
4. Test artifact quality

**Phase 3: Learning System** (3 days)
1. Create pattern detection
2. Create learning dashboard
3. Implement recommendation engine
4. Test with historical data

**Phase 4: Semantic Search** (3 days)
1. Create semantic embeddings
2. Create search interface
3. Implement similarity matching
4. Test search accuracy

**Phase 5: Trello Power-Up** (4 days)
1. Create Power-Up manifest
2. Implement card back section
3. Implement board button
4. Implement card button
5. Test on Trello

## 3.6 Success Criteria

✅ **Decision Options**:
- Generates 3 distinct options for each task
- Options are actionable and realistic
- User can select preferred option
- Selection influences task execution

✅ **Artifacts**:
- Templates are high quality
- Drafts are useful starting points
- Artifacts can be reused
- Library is searchable

✅ **Learning System**:
- Detects meaningful patterns
- Confidence scores are accurate
- Recommendations improve over time
- Patterns are actionable

✅ **Semantic Search**:
- Finds truly similar tasks
- Similarity scores are accurate
- Solutions can be reused
- Search is fast

✅ **Trello Power-Up**:
- Power-Up works seamlessly
- All features accessible from Trello
- No need to leave Trello
- Real-time sync with dashboard

---

## Summary

| Feature | Complexity | Timeline | Priority |
|---------|-----------|----------|----------|
| Advanced Scheduling | Medium | 8 days | High |
| ATIS Phases 3-10 | High | 9 days | High |
| UCES | Very High | 13 days | Medium |
| **Total** | **Very High** | **30 days** | - |

---

## Implementation Order

1. **Week 1**: Advanced Scheduling (drag-and-drop, batch operations)
2. **Week 2**: ATIS Phases 3-10 (complete interview system)
3. **Week 3-4**: UCES (decision options, artifacts, learning, search, power-up)

**Total Estimated Time**: 30 days (4-5 weeks)

---

## Next Steps

1. Review this plan
2. Approve the approach
3. Begin Phase 1: Advanced Scheduling
4. Proceed incrementally through each feature

**Ready for implementation after approval.**
