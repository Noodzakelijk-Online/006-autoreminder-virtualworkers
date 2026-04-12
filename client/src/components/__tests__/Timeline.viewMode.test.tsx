import { describe, it, expect, beforeEach } from 'vitest';
import { Task } from '@/types';

describe('Timeline View Mode Filter Logic', () => {
  let todayTask: Task;
  let tomorrowTask: Task;
  let nextWeekTask: Task;
  let lastWeekTask: Task;

  beforeEach(() => {
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    todayTask = {
      id: 'today',
      cardId: 'card-1',
      cardName: 'Today Task',
      stepIndex: 0,
      description: 'Task for today',
      durationHours: 1,
      startTime: '09:00',
      endTime: '10:00',
      date: today.toISOString().split('T')[0],
      isCompleted: false,
      isArchived: false,
      isBlocker: false,
      isPriority: false,
      priorityLevel: 'NORMAL',
      hasDutch: false,
      attachments: [],
    };

    tomorrowTask = {
      ...todayTask,
      id: 'tomorrow',
      cardName: 'Tomorrow Task',
      date: tomorrow.toISOString().split('T')[0],
    };

    nextWeekTask = {
      ...todayTask,
      id: 'next-week',
      cardName: 'Next Week Task',
      date: nextWeek.toISOString().split('T')[0],
    };

    lastWeekTask = {
      ...todayTask,
      id: 'last-week',
      cardName: 'Last Week Task',
      date: lastWeek.toISOString().split('T')[0],
    };
  });

  it('should filter day view - only today tasks', () => {
    const today = new Date();
    const tasks = [todayTask, tomorrowTask, nextWeekTask, lastWeekTask];
    
    // Simulate day view filtering logic
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    
    const filtered = tasks.filter(task => {
      if (!task.date) return false;
      const taskDate = new Date(task.date);
      return taskDate >= todayStart && taskDate < todayEnd;
    });
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('today');
  });

  it('should filter week view - tasks within current week', () => {
    const today = new Date();
    const tasks = [todayTask, tomorrowTask, nextWeekTask, lastWeekTask];
    
    // Simulate week view filtering logic
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const filtered = tasks.filter(task => {
      if (!task.date) return false;
      const taskDate = new Date(task.date);
      return taskDate >= weekStart && taskDate < weekEnd;
    });
    
    expect(filtered.length).toBeGreaterThanOrEqual(2);
    expect(filtered.some(t => t.id === 'today')).toBe(true);
    expect(filtered.some(t => t.id === 'tomorrow')).toBe(true);
  });

  it('should exclude tasks without dates', () => {
    const taskNoDate = { ...todayTask, id: 'no-date', date: '' };
    const tasks = [todayTask, taskNoDate];
    
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    
    const filtered = tasks.filter(task => {
      if (!task.date) return false;
      const taskDate = new Date(task.date);
      return taskDate >= todayStart && taskDate < todayEnd;
    });
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('today');
  });

  it('should exclude next week tasks in week view', () => {
    const today = new Date();
    const tasks = [todayTask, tomorrowTask, nextWeekTask];
    
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const filtered = tasks.filter(task => {
      if (!task.date) return false;
      const taskDate = new Date(task.date);
      return taskDate >= weekStart && taskDate < weekEnd;
    });
    
    expect(filtered.some(t => t.id === 'next-week')).toBe(false);
  });
});
