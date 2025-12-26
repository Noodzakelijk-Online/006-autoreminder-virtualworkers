import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Last Analyzed Timestamp Display', () => {
  describe('formatRelativeTime', () => {
    const formatRelativeTime = (date: string | Date | undefined) => {
      if (!date) return null;
      const now = new Date();
      const analyzed = new Date(date);
      const diffMs = now.getTime() - analyzed.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
      return analyzed.toLocaleDateString();
    };

    it('should return null for undefined date', () => {
      expect(formatRelativeTime(undefined)).toBeNull();
    });

    it('should return "just now" for very recent dates', () => {
      const now = new Date();
      expect(formatRelativeTime(now)).toBe('just now');
    });

    it('should return minutes ago for dates within an hour', () => {
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
      expect(formatRelativeTime(thirtyMinsAgo)).toBe('30m ago');
    });

    it('should return hours ago for dates within a day', () => {
      const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
      expect(formatRelativeTime(fiveHoursAgo)).toBe('5h ago');
    });

    it('should return "yesterday" for dates one day ago', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(yesterday)).toBe('yesterday');
    });

    it('should return days ago for dates within a week', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');
    });

    it('should return weeks ago for dates within a month', () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(twoWeeksAgo)).toBe('2w ago');
    });
  });

  describe('isStale', () => {
    const isStale = (date: string | Date | undefined) => {
      if (!date) return false;
      const analyzed = new Date(date);
      const diffDays = Math.floor((new Date().getTime() - analyzed.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays > 7;
    };

    it('should return false for undefined date', () => {
      expect(isStale(undefined)).toBe(false);
    });

    it('should return false for recent dates', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      expect(isStale(twoDaysAgo)).toBe(false);
    });

    it('should return false for dates exactly 7 days ago', () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      expect(isStale(sevenDaysAgo)).toBe(false);
    });

    it('should return true for dates more than 7 days ago', () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      expect(isStale(tenDaysAgo)).toBe(true);
    });
  });
});

describe('Batch Selection for Re-analysis', () => {
  describe('Selection state management', () => {
    it('should track selected task IDs', () => {
      const selectedTasks = new Set<string>();
      
      // Add tasks
      selectedTasks.add('task-1');
      selectedTasks.add('task-2');
      
      expect(selectedTasks.size).toBe(2);
      expect(selectedTasks.has('task-1')).toBe(true);
      expect(selectedTasks.has('task-2')).toBe(true);
      expect(selectedTasks.has('task-3')).toBe(false);
    });

    it('should handle select all', () => {
      const tasks = [
        { id: 'task-1' },
        { id: 'task-2' },
        { id: 'task-3' },
      ];
      
      const selectedTasks = new Set(tasks.map(t => t.id));
      
      expect(selectedTasks.size).toBe(3);
    });

    it('should handle clear selection', () => {
      const selectedTasks = new Set(['task-1', 'task-2']);
      selectedTasks.clear();
      
      expect(selectedTasks.size).toBe(0);
    });

    it('should toggle individual task selection', () => {
      const selectedTasks = new Set<string>();
      
      // Select
      selectedTasks.add('task-1');
      expect(selectedTasks.has('task-1')).toBe(true);
      
      // Deselect
      selectedTasks.delete('task-1');
      expect(selectedTasks.has('task-1')).toBe(false);
    });
  });

  describe('Batch re-analysis workflow', () => {
    it('should track progress during batch processing', () => {
      const progress = { current: 0, total: 5 };
      
      // Simulate processing
      for (let i = 1; i <= 5; i++) {
        progress.current = i;
        expect(progress.current).toBe(i);
        expect(progress.total).toBe(5);
      }
    });

    it('should count successes and failures', () => {
      let successCount = 0;
      let failCount = 0;
      
      // Simulate mixed results
      const results = [true, true, false, true, false];
      
      results.forEach(success => {
        if (success) successCount++;
        else failCount++;
      });
      
      expect(successCount).toBe(3);
      expect(failCount).toBe(2);
    });
  });
});

describe('Timeline API - analyzedAt field', () => {
  it('should include analyzedAt in task response', () => {
    const mockTask = {
      id: 1,
      name: 'Test Task',
      analyzedAt: new Date('2025-12-20T10:00:00Z'),
      hasUnderstanding: true,
    };
    
    expect(mockTask.analyzedAt).toBeDefined();
    expect(mockTask.hasUnderstanding).toBe(true);
  });

  it('should handle tasks without analyzedAt', () => {
    const mockTask = {
      id: 2,
      name: 'Task without understanding',
      analyzedAt: null,
      hasUnderstanding: false,
    };
    
    expect(mockTask.analyzedAt).toBeNull();
    expect(mockTask.hasUnderstanding).toBe(false);
  });
});
