// FIXED VERSION: scheduleTasksByTime with deterministic daily capacity enforcement

interface SchedulingOptions {
  lunchBreakStart?: number;
  lunchBreakDuration?: number;
  breakfastBreakStart?: number;
  breakfastBreakDuration?: number;
  dinnerBreakStart?: number;
  dinnerBreakDuration?: number;
  shortBreakInterval?: number;
  shortBreakDuration?: number;
}

function scheduleTasksByTime(
  tasks: any[], 
  workStartHour: number = 9, 
  workEndHour: number = 18, 
  workingDays: number[] = [1, 2, 3, 4, 5], 
  userHolidays: string[] = [],
  options?: Partial<SchedulingOptions>
) {
  // Working hours configurable per user
  const WORK_START_HOUR = workStartHour;
  const WORK_END_HOUR = workEndHour;
  const WORKING_DAYS = new Set(workingDays);
  
  // Break settings (defaults)
  const LUNCH_START = options?.lunchBreakStart ?? 12;
  const LUNCH_DURATION = options?.lunchBreakDuration ?? 60; // minutes
  const BREAKFAST_START = options?.breakfastBreakStart;
  const BREAKFAST_DURATION = options?.breakfastBreakDuration ?? 0;
  const DINNER_START = options?.dinnerBreakStart;
  const DINNER_DURATION = options?.dinnerBreakDuration ?? 0;
  
  const SHORT_BREAK_INTERVAL = options?.shortBreakInterval ?? 90;
  const SHORT_BREAK_DURATION = options?.shortBreakDuration ?? 10;

  // ============================================================================
  // FIX #1: Calculate available capacity UPFRONT (accounting for all breaks)
  // ============================================================================
  const TOTAL_BREAK_MINUTES = LUNCH_DURATION + BREAKFAST_DURATION + DINNER_DURATION;
  const TOTAL_WORK_MINUTES = (WORK_END_HOUR - WORK_START_HOUR) * 60;
  const AVAILABLE_WORK_MINUTES = TOTAL_WORK_MINUTES - TOTAL_BREAK_MINUTES;
  
  console.log(`[Scheduling] Daily capacity: ${AVAILABLE_WORK_MINUTES} minutes (${TOTAL_WORK_MINUTES}min work - ${TOTAL_BREAK_MINUTES}min breaks)`);

  // Group tasks by date
  const tasksByDate = new Map<string, any[]>();
  for (const task of tasks) {
    if (!tasksByDate.has(task.date)) {
      tasksByDate.set(task.date, []);
    }
    tasksByDate.get(task.date)!.push(task);
  }

  // ============================================================================
  // FIX #2: Separate scheduled and overflow tasks (not mixed in single array)
  // ============================================================================
  const scheduledTasks: any[] = [];
  const overflowTasks: any[] = [];
  
  for (const [date, dayTasks] of Array.from(tasksByDate.entries())) {
    const taskDate = new Date(date);
    const dayOfWeek = taskDate.getDay();
    const isHoliday = userHolidays.includes(date);
    
    // Skip non-working days
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

    // Sort tasks by priority and type
    const sortedTasks = dayTasks.sort((a: any, b: any) => {
      const priorityOrder: Record<string, number> = { CRITICAL: 0, URGENT: 1, HIGH: 2, NORMAL: 3 };
      const priorityDiff = (priorityOrder[a.priorityLevel] ?? 3) - (priorityOrder[b.priorityLevel] ?? 3);
      if (priorityDiff !== 0) return priorityDiff;
      
      const taskTypeOrder: Record<string, number> = {
        communication: 1,
        admin: 2,
        meeting: 3,
        creation: 4,
        research: 5,
        review: 6,
        other: 4
      };
      const typeA = taskTypeOrder[a.taskType] ?? 4;
      const typeB = taskTypeOrder[b.taskType] ?? 4;
      if (typeA !== typeB) return typeA - typeB;
      
      if (a.cardName !== b.cardName) return a.cardName.localeCompare(b.cardName);
      return a.stepIndex - b.stepIndex;
    });

    // ========================================================================
    // FIX #3: Track cumulative scheduled time per day
    // ========================================================================
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
    
    const isDuringBreakfast = (h: number, m: number) => {
      if (!BREAKFAST_START || !BREAKFAST_DURATION) return false;
      const mins = toMinutes(h, m);
      const breakfastEndMins = toMinutes(BREAKFAST_START, 0) + BREAKFAST_DURATION;
      return mins >= toMinutes(BREAKFAST_START, 0) && mins < breakfastEndMins;
    };
    
    const isDuringDinner = (h: number, m: number) => {
      if (!DINNER_START || !DINNER_DURATION) return false;
      const mins = toMinutes(h, m);
      const dinnerEndMins = toMinutes(DINNER_START, 0) + DINNER_DURATION;
      return mins >= toMinutes(DINNER_START, 0) && mins < dinnerEndMins;
    };
    
    const skipMealBreak = () => {
      if (isDuringBreakfast(currentHour, currentMinute) && BREAKFAST_START) {
        const breakfastEndMins = toMinutes(BREAKFAST_START, 0) + BREAKFAST_DURATION;
        currentHour = Math.floor(breakfastEndMins / 60);
        currentMinute = breakfastEndMins % 60;
        minutesSinceBreak = 0;
      }
      if (isDuringLunch(currentHour, currentMinute)) {
        const lunchEndMins = toMinutes(LUNCH_START, 0) + LUNCH_DURATION;
        currentHour = Math.floor(lunchEndMins / 60);
        currentMinute = lunchEndMins % 60;
        minutesSinceBreak = 0;
      }
      if (isDuringDinner(currentHour, currentMinute) && DINNER_START) {
        const dinnerEndMins = toMinutes(DINNER_START, 0) + DINNER_DURATION;
        currentHour = Math.floor(dinnerEndMins / 60);
        currentMinute = dinnerEndMins % 60;
        minutesSinceBreak = 0;
      }
    };

    for (const task of sortedTasks) {
      // Skip completed tasks
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
      
      // ====================================================================
      // FIX #4: Check if short break fits in remaining capacity BEFORE adding it
      // ====================================================================
      let breakMinutesNeeded = 0;
      if (minutesSinceBreak >= SHORT_BREAK_INTERVAL) {
        breakMinutesNeeded = SHORT_BREAK_DURATION;
        // Check if break + task would exceed capacity
        const taskMinutes = Math.ceil(task.durationHours * 60);
        if (dailyScheduledMinutes + breakMinutesNeeded + taskMinutes > AVAILABLE_WORK_MINUTES) {
          // Task doesn't fit - REJECT it
          overflowTasks.push({
            ...task,
            rejectionReason: 'Insufficient capacity for break + task'
          });
          continue;
        }
        // Add break to scheduled time
        dailyScheduledMinutes += breakMinutesNeeded;
        currentMinute += breakMinutesNeeded;
        if (currentMinute >= 60) {
          currentHour += Math.floor(currentMinute / 60);
          currentMinute = currentMinute % 60;
        }
        minutesSinceBreak = 0;
        skipMealBreak();
      }

      // ====================================================================
      // FIX #5: Calculate task duration and check against remaining capacity
      // ====================================================================
      const taskMinutes = Math.ceil(task.durationHours * 60);
      
      // CRITICAL CHECK: Does task fit in remaining daily capacity?
      if (dailyScheduledMinutes + taskMinutes > AVAILABLE_WORK_MINUTES) {
        // Task doesn't fit - REJECT and move to overflow
        overflowTasks.push({
          ...task,
          rejectionReason: `Task duration (${taskMinutes}min) exceeds remaining capacity (${AVAILABLE_WORK_MINUTES - dailyScheduledMinutes}min)`
        });
        continue;
      }

      // Calculate end time
      let endHour = currentHour;
      let endMinute = currentMinute + taskMinutes;

      if (endMinute >= 60) {
        endHour += Math.floor(endMinute / 60);
        endMinute = endMinute % 60;
      }
      
      // Check if task spans meal breaks and push to after if needed
      const startMins = toMinutes(currentHour, currentMinute);
      const endMins = toMinutes(endHour, endMinute);
      
      const checkAndPushPastMealBreak = (breakStart: number | undefined, breakDuration: number) => {
        if (!breakStart || !breakDuration) return false;
        const breakStartMins = toMinutes(breakStart, 0);
        const breakEndMins = breakStartMins + breakDuration;
        if (startMins < breakStartMins && endMins > breakStartMins) {
          // Task spans this break, push to after
          currentHour = Math.floor(breakEndMins / 60);
          currentMinute = breakEndMins % 60;
          endHour = currentHour;
          endMinute = currentMinute + taskMinutes;
          if (endMinute >= 60) {
            endHour += Math.floor(endMinute / 60);
            endMinute = endMinute % 60;
          }
          return true;
        }
        return false;
      };
      
      checkAndPushPastMealBreak(BREAKFAST_START, BREAKFAST_DURATION);
      checkAndPushPastMealBreak(LUNCH_START, LUNCH_DURATION);
      checkAndPushPastMealBreak(DINNER_START, DINNER_DURATION);

      // ====================================================================
      // FIX #6: Final validation - does task fit in work hours?
      // ====================================================================
      if (endHour > WORK_END_HOUR || (endHour === WORK_END_HOUR && endMinute > 0)) {
        // Task pushed past end time - REJECT
        overflowTasks.push({
          ...task,
          rejectionReason: `Task end time (${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}) exceeds work end time (${WORK_END_HOUR}:00)`
        });
        continue;
      }

      // Schedule the task
      const startTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
      const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

      scheduledTasks.push({
        ...task,
        startTime,
        endTime,
        schedulingNote: task.durationConfidence === 'low' ? 'Duration estimated' : undefined
      });

      // Update tracking
      dailyScheduledMinutes += taskMinutes;
      minutesSinceBreak += taskMinutes;
      currentHour = endHour;
      currentMinute = endMinute;
    }

    console.log(`[Scheduling] ${date}: Scheduled ${scheduledTasks.filter(t => t.date === date && t.startTime !== 'TBD' && t.startTime !== '--:--').length} tasks (${dailyScheduledMinutes}/${AVAILABLE_WORK_MINUTES} minutes)`);
  }

  // ============================================================================
  // FIX #7: Return structured object with separate scheduled/overflow tasks
  // ============================================================================
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

export { scheduleTasksByTime };
