# Scheduling with Cognitive Load Heuristic

## Problem Statement

The current scheduling algorithm enforces a hard 9-hour/day limit but packs tasks unrealistically:

**Example of Current Behavior:**
```
Day 1 (Monday):
  9:00-10:00  Task A (Communication)
  10:00-11:00 Task B (Admin)
  11:00-12:00 Task C (Meeting)
  12:00-13:00 LUNCH
  13:00-14:00 Task D (Research)
  14:00-15:00 Task E (Creation)
  15:00-16:00 Task F (Review)
  16:00-17:00 Task G (Communication)
  17:00-18:00 Task H (Admin)
  
Day 2 (Tuesday): EMPTY
```

**Why This Is Unrealistic:**
1. **Context Switching**: 8 different tasks in one day = 7 context switches
2. **Cognitive Load**: Switching between communication, admin, research, and creation tasks is mentally exhausting
3. **Real-World Behavior**: VAs naturally batch similar tasks or limit daily task count
4. **Estimation Accuracy**: With high context switching, actual time often exceeds estimates

---

## Solution: Cognitive Load Heuristic

### **Core Rule: "Maximum 4 Distinct Tasks Per Day"**

**Definition**: A "distinct task" is a unique `cardName` (from Trello). Multiple steps from the same card count as one task.

**Behavior:**
- If a day already has 4 distinct tasks scheduled, new tasks spill to the next day
- Exception: CRITICAL and URGENT priority tasks can exceed the limit (up to 5 tasks)
- Still respects the hard 9-hour/day limit as a secondary constraint
- Deterministic: No randomness, same input always produces same output

### **Secondary Rule: Task Grouping By Type**

When multiple tasks fit in a day, prioritize grouping by task type:
1. Communication tasks together
2. Admin tasks together
3. Meetings together
4. Creation/Research tasks together
5. Review tasks together

This reduces context switching within each task type.

---

## Implementation Details

### **Metrics Tracked**

For each day:
- `distinctTaskCount`: Number of unique `cardName` values scheduled
- `totalScheduledMinutes`: Total time scheduled
- `taskTypes`: Array of task types scheduled (for grouping analysis)

### **Decision Logic**

For each task, check in order:

1. **Is it CRITICAL or URGENT?**
   - If yes, allow up to 5 distinct tasks per day
   - If no, allow up to 4 distinct tasks per day

2. **Would adding this task exceed the distinct task limit?**
   - If yes, move to overflow (reason: "Cognitive load limit reached")
   - If no, continue to step 3

3. **Does it fit in remaining capacity (9 hours)?**
   - If yes, schedule it
   - If no, move to overflow (reason: "Exceeds daily capacity")

### **Example Output**

```
Day 1 (Monday):
  9:00-10:00  Task A (Communication) - DISTINCT TASK #1
  10:00-11:00 Task A.Step2 (Communication) - SAME CARD
  11:00-12:00 Task B (Admin) - DISTINCT TASK #2
  12:00-13:00 LUNCH
  13:00-14:00 Task C (Research) - DISTINCT TASK #3
  14:00-15:00 Task D (Creation) - DISTINCT TASK #4
  15:00-16:00 Task E (Communication) - WOULD BE TASK #5, OVERFLOW

Day 2 (Tuesday):
  9:00-10:00  Task E (Communication) - DISTINCT TASK #1
  10:00-11:00 Task F (Review) - DISTINCT TASK #2
  ...
```

---

## Why This Improves Realism

1. **Matches Human Behavior**: VAs naturally limit daily task variety
2. **Reduces Context Switching**: Fewer context switches = better focus
3. **Improves Estimation Accuracy**: With less switching, estimates are more accurate
4. **Prevents Burnout**: Realistic workload distribution
5. **Deterministic**: No randomness, fully predictable

---

## Backward Compatibility

- ✅ Maintains `{ scheduled, overflow, metrics }` return structure
- ✅ All existing tests pass (with updated expectations)
- ✅ Overflow tasks include clear rejection reason
- ✅ Metrics include new `distinctTaskCount` field
- ✅ No breaking changes to API

---

## Test Cases

### Test 1: Cognitive Load Limit Enforced
```
Input: 5 tasks (all NORMAL priority, all different cards)
Expected: 4 scheduled, 1 overflow
Reason: "Cognitive load limit reached (4 distinct tasks per day)"
```

### Test 2: Same Card Multiple Steps
```
Input: 1 card with 5 steps (total 5 hours)
Expected: All 5 steps scheduled (same card = 1 distinct task)
Reason: Steps from same card don't count toward limit
```

### Test 3: CRITICAL Priority Override
```
Input: 5 tasks (1 CRITICAL, 4 NORMAL, all different cards)
Expected: All 5 scheduled (CRITICAL allows up to 5)
Reason: "CRITICAL priority allows extended cognitive load"
```

### Test 4: Hard Capacity Limit Still Enforced
```
Input: 4 tasks (all NORMAL, all different cards, total 10 hours)
Expected: 3 scheduled, 1 overflow
Reason: "Exceeds daily capacity (9 hours)"
Precedence: Hard capacity limit > cognitive load limit
```

---

## Migration Path

1. Deploy with cognitive load heuristic enabled
2. Monitor VA feedback on schedule realism
3. Adjust limit (4 vs 5 tasks) based on feedback
4. Consider task complexity weighting in future iterations
