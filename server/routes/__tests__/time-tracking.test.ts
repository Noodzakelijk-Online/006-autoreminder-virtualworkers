import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock time tracking functions for unit testing
interface TimeEntry {
  id: number;
  taskId: string;
  vaId: number;
  founderId: number;
  startTime: Date;
  endTime: Date | null;
  durationMinutes: number | null;
  notes: string | null;
}

// Simulated in-memory database for testing
let timeEntries: TimeEntry[] = [];
let nextId = 1;

function resetDatabase() {
  timeEntries = [];
  nextId = 1;
}

function startTimer(taskId: string, userId: number, notes?: string): TimeEntry | { error: string } {
  // Check for existing active timer
  const activeTimer = timeEntries.find(e => e.founderId === userId && e.endTime === null);
  if (activeTimer) {
    return { error: 'Timer already active' };
  }

  const entry: TimeEntry = {
    id: nextId++,
    taskId,
    vaId: userId,
    founderId: userId,
    startTime: new Date(),
    endTime: null,
    durationMinutes: null,
    notes: notes || null,
  };
  timeEntries.push(entry);
  return entry;
}

function stopTimer(userId: number, notes?: string): TimeEntry | { error: string } {
  const activeTimer = timeEntries.find(e => e.founderId === userId && e.endTime === null);
  if (!activeTimer) {
    return { error: 'No active timer found' };
  }

  const endTime = new Date();
  const durationMinutes = Math.round((endTime.getTime() - activeTimer.startTime.getTime()) / 60000);
  
  activeTimer.endTime = endTime;
  activeTimer.durationMinutes = durationMinutes;
  if (notes) activeTimer.notes = notes;
  
  return activeTimer;
}

function pauseTimer(userId: number): TimeEntry | { error: string } {
  const activeTimer = timeEntries.find(e => e.founderId === userId && e.endTime === null);
  if (!activeTimer) {
    return { error: 'No active timer found' };
  }

  const endTime = new Date();
  const durationMinutes = Math.round((endTime.getTime() - activeTimer.startTime.getTime()) / 60000);
  
  activeTimer.endTime = endTime;
  activeTimer.durationMinutes = durationMinutes;
  activeTimer.notes = activeTimer.notes ? `${activeTimer.notes} (paused)` : '(paused)';
  
  return activeTimer;
}

function getActiveTimer(userId: number): TimeEntry | null {
  return timeEntries.find(e => e.founderId === userId && e.endTime === null) || null;
}

function getTaskTimeEntries(taskId: string, userId: number): { entries: TimeEntry[], totalMinutes: number } {
  const entries = timeEntries.filter(e => e.founderId === userId && e.taskId === taskId);
  const totalMinutes = entries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
  return { entries, totalMinutes };
}

function getWeeklySummary(userId: number, weekStart: Date, weekEnd: Date): { 
  totalMinutes: number, 
  byDate: Record<string, number>,
  byTask: Record<string, number>
} {
  const entries = timeEntries.filter(e => {
    return e.founderId === userId && 
           e.startTime >= weekStart && 
           e.startTime <= weekEnd &&
           e.durationMinutes !== null;
  });

  const totalMinutes = entries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
  
  const byDate: Record<string, number> = {};
  const byTask: Record<string, number> = {};
  
  entries.forEach(e => {
    const dateStr = e.startTime.toISOString().split('T')[0];
    byDate[dateStr] = (byDate[dateStr] || 0) + (e.durationMinutes || 0);
    byTask[e.taskId] = (byTask[e.taskId] || 0) + (e.durationMinutes || 0);
  });

  return { totalMinutes, byDate, byTask };
}

describe('Time Tracking System', () => {
  beforeEach(() => {
    resetDatabase();
  });

  describe('Start Timer', () => {
    it('should start a new timer for a task', () => {
      const result = startTimer('task-1', 1, 'Working on task');
      
      expect(result).not.toHaveProperty('error');
      const entry = result as TimeEntry;
      expect(entry.taskId).toBe('task-1');
      expect(entry.founderId).toBe(1);
      expect(entry.endTime).toBeNull();
      expect(entry.durationMinutes).toBeNull();
      expect(entry.notes).toBe('Working on task');
    });

    it('should not allow starting a second timer', () => {
      startTimer('task-1', 1);
      const result = startTimer('task-2', 1);
      
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toBe('Timer already active');
    });

    it('should allow different users to have active timers', () => {
      const result1 = startTimer('task-1', 1);
      const result2 = startTimer('task-2', 2);
      
      expect(result1).not.toHaveProperty('error');
      expect(result2).not.toHaveProperty('error');
    });
  });

  describe('Stop Timer', () => {
    it('should stop an active timer and calculate duration', () => {
      // Start timer
      const startResult = startTimer('task-1', 1);
      expect(startResult).not.toHaveProperty('error');
      
      // Simulate time passing (modify startTime)
      const entry = startResult as TimeEntry;
      entry.startTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
      
      // Stop timer
      const stopResult = stopTimer(1);
      expect(stopResult).not.toHaveProperty('error');
      
      const stoppedEntry = stopResult as TimeEntry;
      expect(stoppedEntry.endTime).not.toBeNull();
      expect(stoppedEntry.durationMinutes).toBeGreaterThanOrEqual(29);
      expect(stoppedEntry.durationMinutes).toBeLessThanOrEqual(31);
    });

    it('should return error if no active timer', () => {
      const result = stopTimer(1);
      
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toBe('No active timer found');
    });
  });

  describe('Pause Timer', () => {
    it('should pause an active timer', () => {
      startTimer('task-1', 1, 'Initial note');
      const result = pauseTimer(1);
      
      expect(result).not.toHaveProperty('error');
      const entry = result as TimeEntry;
      expect(entry.endTime).not.toBeNull();
      expect(entry.notes).toContain('(paused)');
    });

    it('should allow resuming after pause by starting new timer', () => {
      startTimer('task-1', 1);
      pauseTimer(1);
      
      // Should be able to start a new timer for same task
      const result = startTimer('task-1', 1, 'Resumed');
      expect(result).not.toHaveProperty('error');
    });
  });

  describe('Get Active Timer', () => {
    it('should return active timer if exists', () => {
      startTimer('task-1', 1);
      const active = getActiveTimer(1);
      
      expect(active).not.toBeNull();
      expect(active?.taskId).toBe('task-1');
    });

    it('should return null if no active timer', () => {
      const active = getActiveTimer(1);
      expect(active).toBeNull();
    });

    it('should return null after timer is stopped', () => {
      startTimer('task-1', 1);
      stopTimer(1);
      
      const active = getActiveTimer(1);
      expect(active).toBeNull();
    });
  });

  describe('Task Time Entries', () => {
    it('should return all entries for a task', () => {
      // Create multiple entries for same task
      startTimer('task-1', 1);
      const entry1 = timeEntries[0];
      entry1.startTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      stopTimer(1);
      
      startTimer('task-1', 1);
      const entry2 = timeEntries[1];
      entry2.startTime = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
      stopTimer(1);
      
      const result = getTaskTimeEntries('task-1', 1);
      
      expect(result.entries.length).toBe(2);
      expect(result.totalMinutes).toBeGreaterThan(80); // ~90 minutes total
    });

    it('should not include entries from other tasks', () => {
      startTimer('task-1', 1);
      stopTimer(1);
      
      startTimer('task-2', 1);
      stopTimer(1);
      
      const result = getTaskTimeEntries('task-1', 1);
      expect(result.entries.length).toBe(1);
    });
  });

  describe('Weekly Summary', () => {
    it('should calculate total minutes for the week', () => {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      // Create entries within the week
      startTimer('task-1', 1);
      const entry1 = timeEntries[0];
      entry1.startTime = new Date(weekStart.getTime() + 24 * 60 * 60 * 1000); // Tuesday
      stopTimer(1);
      
      const summary = getWeeklySummary(1, weekStart, weekEnd);
      
      expect(summary.totalMinutes).toBeGreaterThanOrEqual(0);
      expect(summary.byTask['task-1']).toBeDefined();
    });

    it('should group by date correctly', () => {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      // Create entry
      startTimer('task-1', 1);
      const entry = timeEntries[0];
      entry.startTime = new Date(weekStart.getTime() + 24 * 60 * 60 * 1000);
      stopTimer(1);
      
      const summary = getWeeklySummary(1, weekStart, weekEnd);
      
      const dateKeys = Object.keys(summary.byDate);
      expect(dateKeys.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Actual vs Estimated Time', () => {
    it('should track time against estimated hours', () => {
      const estimatedMinutes = 60; // 1 hour estimate
      
      // Track 45 minutes
      startTimer('task-1', 1);
      const entry = timeEntries[0];
      entry.startTime = new Date(Date.now() - 45 * 60 * 1000);
      stopTimer(1);
      
      const result = getTaskTimeEntries('task-1', 1);
      const actualMinutes = result.totalMinutes;
      
      // Calculate accuracy
      const accuracy = Math.round((actualMinutes / estimatedMinutes) * 100);
      
      expect(actualMinutes).toBeLessThan(estimatedMinutes);
      expect(accuracy).toBeLessThan(100);
    });

    it('should detect when actual exceeds estimate', () => {
      const estimatedMinutes = 30; // 30 min estimate
      
      // Track 45 minutes
      startTimer('task-1', 1);
      const entry = timeEntries[0];
      entry.startTime = new Date(Date.now() - 45 * 60 * 1000);
      stopTimer(1);
      
      const result = getTaskTimeEntries('task-1', 1);
      const actualMinutes = result.totalMinutes;
      
      const isOverEstimate = actualMinutes > estimatedMinutes;
      expect(isOverEstimate).toBe(true);
    });
  });
});
