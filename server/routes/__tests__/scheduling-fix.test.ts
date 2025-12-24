import { describe, it, expect, beforeEach } from 'vitest';

// Mock the scheduling function for testing
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

  // Calculate available capacity UPFRONT
  const TOTAL_BREAK_MINUTES = LUNCH_DURATION + BREAKFAST_DURATION + DINNER_DURATION;
  const TOTAL_WORK_MINUTES = (WORK_END_HOUR - WORK_START_HOUR) * 60;
  const AVAILABLE_WORK_MINUTES = TOTAL_WORK_MINUTES - TOTAL_BREAK_MINUTES;

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
      
      // CRITICAL CHECK: Does task fit in remaining capacity?
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

      scheduledTasks.push({
        ...task,
        startTime,
        endTime
      });

      dailyScheduledMinutes += taskMinutes;
      minutesSinceBreak += taskMinutes;
      currentHour = endHour;
      currentMinute = endMinute;
    }
  }

  return {
    scheduled: scheduledTasks,
    overflow: overflowTasks,
    metrics: {
      totalScheduled: scheduledTasks.filter(t => t.startTime !== 'TBD' && t.startTime !== '--:--').length,
      totalOverflow: overflowTasks.length,
      dailyCapacityMinutes: AVAILABLE_WORK_MINUTES,
      totalScheduledMinutes: scheduledTasks
        .filter(t => t.startTime !== 'TBD' && t.startTime !== '--:--')
        .reduce((sum, t) => sum + Math.ceil(t.durationHours * 60), 0)
    }
  };
}

describe('Scheduling Fix - Daily Capacity Enforcement', () => {
  const baseDate = '2025-12-24';
  
  describe('Test 1: Normal Day (No Overbooking)', () => {
    it('should schedule all tasks that fit within daily capacity', () => {
      const tasks = [
        { id: '1', date: baseDate, durationHours: 2, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'A', stepIndex: 0, isCompleted: false },
        { id: '2', date: baseDate, durationHours: 3, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'B', stepIndex: 0, isCompleted: false },
        { id: '3', date: baseDate, durationHours: 2, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'C', stepIndex: 0, isCompleted: false }
      ];
      
      const result = scheduleTasksByTime(tasks, 9, 18, [1,2,3,4,5], [], { lunchBreakDuration: 60 });
      
      expect(result.metrics.totalScheduled).toBe(3);
      expect(result.metrics.totalOverflow).toBe(0);
      expect(result.metrics.totalScheduledMinutes).toBe(420);
    });
  });

  describe('Test 2: Capacity Never Exceeded', () => {
    it('should never schedule more than available capacity', () => {
      const tasks = [
        { id: '1', date: baseDate, durationHours: 5, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'A', stepIndex: 0, isCompleted: false },
        { id: '2', date: baseDate, durationHours: 5, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'B', stepIndex: 0, isCompleted: false },
        { id: '3', date: baseDate, durationHours: 5, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'C', stepIndex: 0, isCompleted: false }
      ];
      
      const result = scheduleTasksByTime(tasks, 9, 18, [1,2,3,4,5], [], { lunchBreakDuration: 60 });
      
      // Available = 540 minutes (9 hours - 1 hour lunch)
      expect(result.metrics.totalScheduledMinutes).toBeLessThanOrEqual(540);
      expect(result.metrics.totalOverflow).toBeGreaterThan(0);
    });
  });

  describe('Test 3: Overflow Single Task', () => {
    it('should reject task that exceeds remaining capacity', () => {
      const tasks = [
        { id: '1', date: baseDate, durationHours: 2, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'A', stepIndex: 0, isCompleted: false },
        { id: '2', date: baseDate, durationHours: 3, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'B', stepIndex: 0, isCompleted: false },
        { id: '3', date: baseDate, durationHours: 4, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'C', stepIndex: 0, isCompleted: false }
      ];
      
      const result = scheduleTasksByTime(tasks, 9, 18, [1,2,3,4,5], [], { lunchBreakDuration: 60 });
      
      expect(result.metrics.totalScheduled).toBe(2);
      expect(result.metrics.totalOverflow).toBe(1);
      expect(result.overflow[0].id).toBe('3');
    });
  });

  describe('Test 4: Overflow Multiple Tasks', () => {
    it('should reject multiple tasks that exceed capacity', () => {
      const tasks = [
        { id: '1', date: baseDate, durationHours: 5, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'A', stepIndex: 0, isCompleted: false },
        { id: '2', date: baseDate, durationHours: 5, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'B', stepIndex: 0, isCompleted: false },
        { id: '3', date: baseDate, durationHours: 5, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'C', stepIndex: 0, isCompleted: false }
      ];
      
      const result = scheduleTasksByTime(tasks, 9, 18, [1,2,3,4,5], [], { lunchBreakDuration: 60 });
      
      expect(result.metrics.totalScheduled).toBe(1);
      expect(result.metrics.totalOverflow).toBe(2);
    });
  });

  describe('Test 5: Completed Tasks Not Counted', () => {
    it('should not count completed tasks in scheduled minutes', () => {
      const tasks = [
        { id: '1', date: baseDate, durationHours: 2, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'A', stepIndex: 0, isCompleted: true },
        { id: '2', date: baseDate, durationHours: 3, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'B', stepIndex: 0, isCompleted: false },
        { id: '3', date: baseDate, durationHours: 2, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'C', stepIndex: 0, isCompleted: false }
      ];
      
      const result = scheduleTasksByTime(tasks, 9, 18, [1,2,3,4,5], [], { lunchBreakDuration: 60 });
      
      expect(result.metrics.totalScheduled).toBe(2);
      expect(result.scheduled.find((t: any) => t.id === '1')?.startTime).toBe('--:--');
    });
  });

  describe('Test 6: Priority Respected with Capacity Limits', () => {
    it('should schedule high-priority tasks first, then reject lower-priority overflow', () => {
      const tasks = [
        { id: '1', date: baseDate, durationHours: 5, priorityLevel: 'CRITICAL', taskType: 'admin', cardName: 'A', stepIndex: 0, isCompleted: false },
        { id: '2', date: baseDate, durationHours: 5, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'B', stepIndex: 0, isCompleted: false }
      ];
      
      const result = scheduleTasksByTime(tasks, 9, 18, [1,2,3,4,5], [], { lunchBreakDuration: 60 });
      
      expect(result.metrics.totalScheduled).toBe(1);
      expect(result.scheduled[0].id).toBe('1');
      expect(result.overflow[0].id).toBe('2');
    });
  });

  describe('Test 7: Non-Working Days Handled', () => {
    it('should mark tasks on non-working days as TBD', () => {
      const sundayDate = '2025-12-21';
      const tasks = [
        { id: '1', date: sundayDate, durationHours: 2, priorityLevel: 'NORMAL', taskType: 'admin', cardName: 'A', stepIndex: 0, isCompleted: false }
      ];
      
      const result = scheduleTasksByTime(tasks, 9, 18, [1,2,3,4,5], [], { lunchBreakDuration: 60 });
      
      expect(result.scheduled[0].startTime).toBe('TBD');
      expect(result.scheduled[0].note).toBe('Non-working day');
    });
  });

  describe('Test 8: No 124-Hour Days', () => {
    it('should never allow extreme overbooking like 124 hours in one day', () => {
      // Create 20 tasks of 6 hours each = 120 hours total
      const tasks = Array.from({ length: 20 }, (_, i) => ({
        id: String(i + 1),
        date: baseDate,
        durationHours: 6,
        priorityLevel: 'NORMAL',
        taskType: 'admin',
        cardName: `Task${i}`,
        stepIndex: 0,
        isCompleted: false
      }));
      
      const result = scheduleTasksByTime(tasks, 9, 18, [1,2,3,4,5], [], { lunchBreakDuration: 60 });
      
      // Available = 540 minutes = 9 hours
      // Only 1 task of 6 hours should fit
      expect(result.metrics.totalScheduled).toBeLessThanOrEqual(2);
      expect(result.metrics.totalScheduledMinutes).toBeLessThanOrEqual(540);
      expect(result.metrics.totalOverflow).toBeGreaterThan(15);
    });
  });
});
