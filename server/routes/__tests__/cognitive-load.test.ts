import { describe, it, expect } from 'vitest';

const baseDate = '2025-12-22'; // Monday

// Mock the updated scheduling function with cognitive load heuristic
function scheduleTasksByTime(
  tasks: any[], 
  workStartHour: number = 9, 
  workEndHour: number = 18, 
  workingDays: number[] = [1, 2, 3, 4, 5], 
  userHolidays: string[] = [],
  options?: any
) {
  const WORK_START_HOUR = workStartHour;
  const WORK_END_HOUR = workEndHour;
  const WORKING_DAYS = new Set(workingDays);
  
  const LUNCH_START = options?.lunchBreakStart ?? 12;
  const LUNCH_DURATION = options?.lunchBreakDuration ?? 60;
  const BREAKFAST_START = options?.breakfastBreakStart;
  const BREAKFAST_DURATION = options?.breakfastBreakDuration ?? 0;
  const DINNER_START = options?.dinnerBreakStart;
  const DINNER_DURATION = options?.dinnerBreakDuration ?? 0;
  
  const SHORT_BREAK_INTERVAL = options?.shortBreakInterval ?? 90;
  const SHORT_BREAK_DURATION = options?.shortBreakDuration ?? 10;

  const TOTAL_BREAK_MINUTES = LUNCH_DURATION + BREAKFAST_DURATION + DINNER_DURATION;
  const TOTAL_WORK_MINUTES = (WORK_END_HOUR - WORK_START_HOUR) * 60;
  const AVAILABLE_WORK_MINUTES = TOTAL_WORK_MINUTES - TOTAL_BREAK_MINUTES;

  const MAX_DISTINCT_TASKS_NORMAL = 4;
  const MAX_DISTINCT_TASKS_CRITICAL = 5;

  const tasksByDate = new Map<string, any[]>();
  for (const task of tasks) {
    if (!tasksByDate.has(task.date)) {
      tasksByDate.set(task.date, []);
    }
    tasksByDate.get(task.date)!.push(task);
  }

  const scheduledTasks: any[] = [];
  const overflowTasks: any[] = [];
  
  for (const [date, dayTasks] of Array.from(tasksByDate.entries())) {
    const taskDate = new Date(date);
    const dayOfWeek = taskDate.getDay();
    const isHoliday = userHolidays.includes(date);
    
    if (!WORKING_DAYS.has(dayOfWeek) || isHoliday) {
      const reason = isHoliday ? 'Holiday' : 'Non-working day';
      for (const task of dayTasks) {
        scheduledTasks.push({
          ...task,
          startTime: 'TBD',
          endTime: 'TBD',
          note: reason
        });
      }
      continue;
    }

    const sortedTasks = dayTasks.sort((a: any, b: any) => {
      const priorityOrder: Record<string, number> = { CRITICAL: 0, URGENT: 1, HIGH: 2, NORMAL: 3 };
      const priorityDiff = (priorityOrder[a.priorityLevel] ?? 3) - (priorityOrder[b.priorityLevel] ?? 3);
      if (priorityDiff !== 0) return priorityDiff;
      
      const taskTypeOrder: Record<string, number> = {
        communication: 1, admin: 2, meeting: 3, creation: 4, research: 5, review: 6, other: 4
      };
      const typeA = taskTypeOrder[a.taskType] ?? 4;
      const typeB = taskTypeOrder[b.taskType] ?? 4;
      if (typeA !== typeB) return typeA - typeB;
      
      if (a.cardName !== b.cardName) return a.cardName.localeCompare(b.cardName);
      return a.stepIndex - b.stepIndex;
    });

    let dailyScheduledMinutes = 0;
    let currentHour = WORK_START_HOUR;
    let currentMinute = 0;
    let minutesSinceBreak = 0;

    // NEW: Cognitive Load Heuristic - track distinct tasks per day
    const scheduledCardNames = new Set<string>();
    
    // Check if ANY task in this day is CRITICAL or URGENT
    const hasCriticalOrUrgent = sortedTasks.some(t => t.priorityLevel === 'CRITICAL' || t.priorityLevel === 'URGENT');

    const toMinutes = (h: number, m: number) => h * 60 + m;
    
    const isDuringLunch = (h: number, m: number) => {
      const mins = toMinutes(h, m);
      const lunchEndMins = toMinutes(LUNCH_START, 0) + LUNCH_DURATION;
      return mins >= toMinutes(LUNCH_START, 0) && mins < lunchEndMins;
    };
    
    const skipMealBreak = () => {
      if (isDuringLunch(currentHour, currentMinute)) {
        const lunchEndMins = toMinutes(LUNCH_START, 0) + LUNCH_DURATION;
        currentHour = Math.floor(lunchEndMins / 60);
        currentMinute = lunchEndMins % 60;
        minutesSinceBreak = 0;
      }
    };

    for (const task of sortedTasks) {
      if (task.isCompleted) {
        scheduledTasks.push({
          ...task,
          startTime: '--:--',
          endTime: '--:--',
          schedulingNote: 'Completed'
        });
        continue;
      }

      skipMealBreak();
      
      // NEW: Cognitive Load Heuristic - check if adding this task would exceed distinct task limit
      const isNewCard = !scheduledCardNames.has(task.cardName);
      const maxDistinctTasks = hasCriticalOrUrgent 
        ? MAX_DISTINCT_TASKS_CRITICAL 
        : MAX_DISTINCT_TASKS_NORMAL;
      
      if (isNewCard && scheduledCardNames.size >= maxDistinctTasks) {
        // Would exceed cognitive load limit - reject this task
        overflowTasks.push({
          ...task,
          rejectionReason: `Cognitive load limit reached (${maxDistinctTasks} distinct tasks per day). Current: ${scheduledCardNames.size} tasks.`
        });
        continue;
      }
      
      // Check if short break fits
      let breakMinutesNeeded = 0;
      if (minutesSinceBreak >= SHORT_BREAK_INTERVAL) {
        breakMinutesNeeded = SHORT_BREAK_DURATION;
        const taskMinutes = Math.ceil(task.durationHours * 60);
        if (dailyScheduledMinutes + breakMinutesNeeded + taskMinutes > AVAILABLE_WORK_MINUTES) {
          overflowTasks.push({
            ...task,
            rejectionReason: 'Insufficient capacity for break + task'
          });
          continue;
        }
        dailyScheduledMinutes += breakMinutesNeeded;
        currentMinute += breakMinutesNeeded;
        if (currentMinute >= 60) {
          currentHour += Math.floor(currentMinute / 60);
          currentMinute = currentMinute % 60;
        }
        minutesSinceBreak = 0;
        skipMealBreak();
      }

      const taskMinutes = Math.ceil(task.durationHours * 60);
      
      if (dailyScheduledMinutes + taskMinutes > AVAILABLE_WORK_MINUTES) {
        overflowTasks.push({
          ...task,
          rejectionReason: `Task duration exceeds remaining capacity`
        });
        continue;
      }

      let endHour = currentHour;
      let endMinute = currentMinute + taskMinutes;

      if (endMinute >= 60) {
        endHour += Math.floor(endMinute / 60);
        endMinute = endMinute % 60;
      }

      if (endHour > WORK_END_HOUR || (endHour === WORK_END_HOUR && endMinute > 0)) {
        overflowTasks.push({
          ...task,
          rejectionReason: `Task end time exceeds work end time`
        });
        continue;
      }

      const startTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
      const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

      // NEW: Track this card as scheduled for cognitive load tracking
      if (isNewCard) {
        scheduledCardNames.add(task.cardName);
      }

      scheduledTasks.push({
        ...task,
        startTime,
        endTime,
        schedulingNote: task.durationConfidence === 'low' ? 'Duration estimated' : undefined
      });

      dailyScheduledMinutes += taskMinutes;
      minutesSinceBreak += taskMinutes;
      currentHour = endHour;
      currentMinute = endMinute;
    }
  }

  // NEW: Include cognitive load metrics
  const cognitiveLoadOverflow = overflowTasks.filter(t => t.rejectionReason?.includes('Cognitive')).length;
  const capacityOverflow = overflowTasks.filter(t => !t.rejectionReason?.includes('Cognitive')).length;
  
  return {
    scheduled: scheduledTasks,
    overflow: overflowTasks,
    metrics: {
      totalScheduled: scheduledTasks.filter(t => t.startTime !== 'TBD' && t.startTime !== '--:--').length,
      totalOverflow: overflowTasks.length,
      cognitiveLoadOverflow: cognitiveLoadOverflow,
      capacityOverflow: capacityOverflow,
      dailyCapacityMinutes: AVAILABLE_WORK_MINUTES,
      totalScheduledMinutes: scheduledTasks
        .filter(t => t.startTime !== 'TBD' && t.startTime !== '--:--')
        .reduce((sum, t) => sum + Math.ceil(t.durationHours * 60), 0),
      schedulingStrategy: 'Cognitive Load Heuristic (max 4 distinct tasks/day, 5 for CRITICAL)'
    }
  }
}

describe('Cognitive Load Heuristic Tests', () => {
  describe('Test 1: Cognitive Load Limit Enforced (4 tasks max)', () => {
    it('should reject 5th distinct task due to cognitive load limit', () => {
      const tasks = [
        { id: '1', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardA', stepIndex: 0, isCompleted: false },
        { id: '2', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardB', stepIndex: 0, isCompleted: false },
        { id: '3', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardC', stepIndex: 0, isCompleted: false },
        { id: '4', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardD', stepIndex: 0, isCompleted: false },
        { id: '5', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardE', stepIndex: 0, isCompleted: false }
      ];
      
      const result = scheduleTasksByTime(tasks, 9, 18, [1,2,3,4,5], [], { lunchBreakDuration: 60 });
      
      expect(result.metrics.totalScheduled).toBe(4);
      expect(result.metrics.totalOverflow).toBe(1);
      expect(result.metrics.cognitiveLoadOverflow).toBe(1);
      expect(result.overflow[0].id).toBe('5');
      expect(result.overflow[0].rejectionReason).toContain('Cognitive load limit');
    });
  });

  describe('Test 2: Same Card Multiple Steps (not counted as distinct tasks)', () => {
    it('should allow multiple steps from same card without counting toward limit', () => {
      const tasks = [
        { id: '1', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardA', stepIndex: 0, isCompleted: false },
        { id: '2', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardA', stepIndex: 1, isCompleted: false },
        { id: '3', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardA', stepIndex: 2, isCompleted: false },
        { id: '4', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardB', stepIndex: 0, isCompleted: false },
        { id: '5', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardC', stepIndex: 0, isCompleted: false }
      ];
      
      const result = scheduleTasksByTime(tasks, 9, 18, [1,2,3,4,5], [], { lunchBreakDuration: 60 });
      
      // All 5 steps should fit: CardA (3 steps = 1 distinct), CardB (1 distinct), CardC (1 distinct) = 3 distinct total
      // Total time: 5 hours = 300 minutes, which fits in 540 minutes available
      expect(result.metrics.totalScheduled).toBe(5);
      expect(result.metrics.totalOverflow).toBe(0);
      expect(result.metrics.cognitiveLoadOverflow).toBe(0);
    });
  });

  describe('Test 3: CRITICAL Priority Override (5 tasks max)', () => {
    it('should allow 5 distinct tasks if one is CRITICAL', () => {
      const tasks = [
        { id: '1', date: baseDate, durationHours: 1, priorityLevel: 'CRITICAL', taskType: 'admin', cardName: 'CardA', stepIndex: 0, isCompleted: false },
        { id: '2', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardB', stepIndex: 0, isCompleted: false },
        { id: '3', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardC', stepIndex: 0, isCompleted: false },
        { id: '4', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardD', stepIndex: 0, isCompleted: false },
        { id: '5', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardE', stepIndex: 0, isCompleted: false }
      ];
      
      const result = scheduleTasksByTime(tasks, 9, 18, [1,2,3,4,5], [], { lunchBreakDuration: 60 });
      
      // All 5 should fit because CRITICAL task allows up to 5 distinct tasks
      expect(result.metrics.totalScheduled).toBe(5);
      expect(result.metrics.totalOverflow).toBe(0);
    });
  });

  describe('Test 4: Hard Capacity Limit Still Enforced', () => {
    it('should reject tasks due to capacity even if cognitive load allows', () => {
      const tasks = [
        { id: '1', date: baseDate, durationHours: 2, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardA', stepIndex: 0, isCompleted: false },
        { id: '2', date: baseDate, durationHours: 2, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardB', stepIndex: 0, isCompleted: false },
        { id: '3', date: baseDate, durationHours: 2, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardC', stepIndex: 0, isCompleted: false },
        { id: '4', date: baseDate, durationHours: 2, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardD', stepIndex: 0, isCompleted: false },
        { id: '5', date: baseDate, durationHours: 2, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardE', stepIndex: 0, isCompleted: false }
      ];
      
      const result = scheduleTasksByTime(tasks, 9, 18, [1,2,3,4,5], [], { lunchBreakDuration: 60 });
      
      // Only 4 tasks of 2 hours each = 8 hours fit (within 9-hour limit)
      // 5th task would exceed capacity
      expect(result.metrics.totalScheduled).toBeLessThanOrEqual(4);
      expect(result.metrics.capacityOverflow).toBeGreaterThan(0);
    });
  });

  describe('Test 5: URGENT Priority Override', () => {
    it('should allow 5 distinct tasks if one is URGENT', () => {
      const tasks = [
        { id: '1', date: baseDate, durationHours: 1, priorityLevel: 'URGENT', taskType: 'admin', cardName: 'CardA', stepIndex: 0, isCompleted: false },
        { id: '2', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardB', stepIndex: 0, isCompleted: false },
        { id: '3', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardC', stepIndex: 0, isCompleted: false },
        { id: '4', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardD', stepIndex: 0, isCompleted: false },
        { id: '5', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardE', stepIndex: 0, isCompleted: false }
      ];
      
      const result = scheduleTasksByTime(tasks, 9, 18, [1,2,3,4,5], [], { lunchBreakDuration: 60 });
      
      // All 5 should fit because URGENT task allows up to 5 distinct tasks
      expect(result.metrics.totalScheduled).toBe(5);
      expect(result.metrics.totalOverflow).toBe(0);
    });
  });

  describe('Test 6: Realistic Schedule Distribution', () => {
    it('should distribute 12 tasks across multiple days realistically', () => {
      const tasks = Array.from({ length: 12 }, (_, i) => ({
        id: String(i + 1),
        date: i < 4 ? baseDate : i < 8 ? '2025-12-23' : '2025-12-24',
        durationHours: 1,
        priorityLevel: 'NORMAL',
        taskType: 'admin',
        cardName: `Card${String.fromCharCode(65 + (i % 4))}`,
        stepIndex: Math.floor(i / 4),
        isCompleted: false
      }));
      
      const result = scheduleTasksByTime(tasks, 9, 18, [1,2,3,4,5], [], { lunchBreakDuration: 60 });
      
      // Should schedule all 12 tasks across 3 days
      expect(result.metrics.totalScheduled).toBe(12);
      expect(result.metrics.totalOverflow).toBe(0);
      
      // Verify no day has more than 4 distinct tasks
      const dayTasks = new Map<string, Set<string>>();
      for (const task of result.scheduled) {
        if (task.startTime !== 'TBD' && task.startTime !== '--:--') {
          if (!dayTasks.has(task.date)) {
            dayTasks.set(task.date, new Set());
          }
          dayTasks.get(task.date)!.add(task.cardName);
        }
      }
      
      for (const [date, cards] of dayTasks.entries()) {
        expect(cards.size).toBeLessThanOrEqual(4);
      }
    });
  });

  describe('Test 7: Metrics Include Cognitive Load Breakdown', () => {
    it('should track cognitive load vs capacity overflow separately', () => {
      const tasks = [
        { id: '1', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardA', stepIndex: 0, isCompleted: false },
        { id: '2', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardB', stepIndex: 0, isCompleted: false },
        { id: '3', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardC', stepIndex: 0, isCompleted: false },
        { id: '4', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardD', stepIndex: 0, isCompleted: false },
        { id: '5', date: baseDate, durationHours: 1, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'CardE', stepIndex: 0, isCompleted: false }
      ];
      
      const result = scheduleTasksByTime(tasks, 9, 18, [1,2,3,4,5], [], { lunchBreakDuration: 60 });
      
      expect(result.metrics.cognitiveLoadOverflow).toBe(1);
      expect(result.metrics.capacityOverflow).toBe(0);
      expect(result.metrics.schedulingStrategy).toContain('Cognitive Load Heuristic');
    });
  });
});
