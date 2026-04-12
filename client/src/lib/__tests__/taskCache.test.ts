import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { taskCache, CACHE_KEYS } from '../taskCache';

describe('Task Cache', () => {
  beforeEach(() => {
    // Clear cache before each test
    taskCache.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic cache operations', () => {
    it('should store and retrieve cached data', () => {
      const testData = { tasks: [{ id: '1', name: 'Test' }], clients: [] };
      
      taskCache.set(CACHE_KEYS.TIMELINE_TASKS, testData);
      const retrieved = taskCache.get(CACHE_KEYS.TIMELINE_TASKS);
      
      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent cache keys', () => {
      const result = taskCache.get(CACHE_KEYS.TIMELINE_TASKS);
      expect(result).toBeNull();
    });

    it('should invalidate cache entries', () => {
      const testData = { tasks: [], clients: [] };
      
      taskCache.set(CACHE_KEYS.TIMELINE_TASKS, testData);
      expect(taskCache.get(CACHE_KEYS.TIMELINE_TASKS)).toEqual(testData);
      
      taskCache.invalidate(CACHE_KEYS.TIMELINE_TASKS);
      expect(taskCache.get(CACHE_KEYS.TIMELINE_TASKS)).toBeNull();
    });

    it('should clear all cache entries', () => {
      taskCache.set(CACHE_KEYS.TIMELINE_TASKS, { tasks: [] });
      
      taskCache.clear();
      
      expect(taskCache.get(CACHE_KEYS.TIMELINE_TASKS)).toBeNull();
    });
  });

  describe('Cache expiration (5-minute TTL)', () => {
    it('should return cached data within 5 minutes', () => {
      const testData = { tasks: [{ id: '1' }], clients: [] };
      
      taskCache.set(CACHE_KEYS.TIMELINE_TASKS, testData);
      
      // Advance time by 4 minutes
      vi.advanceTimersByTime(4 * 60 * 1000);
      
      const retrieved = taskCache.get(CACHE_KEYS.TIMELINE_TASKS);
      expect(retrieved).toEqual(testData);
    });

    it('should expire cached data after 5 minutes', () => {
      const testData = { tasks: [{ id: '1' }], clients: [] };
      
      taskCache.set(CACHE_KEYS.TIMELINE_TASKS, testData);
      
      // Advance time by 5 minutes and 1 second
      vi.advanceTimersByTime(5 * 60 * 1000 + 1000);
      
      const retrieved = taskCache.get(CACHE_KEYS.TIMELINE_TASKS);
      expect(retrieved).toBeNull();
    });

    it('should return null for expired cache on exact 5-minute boundary', () => {
      const testData = { tasks: [], clients: [] };
      
      taskCache.set(CACHE_KEYS.TIMELINE_TASKS, testData);
      
      // Advance time by exactly 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000);
      
      const retrieved = taskCache.get(CACHE_KEYS.TIMELINE_TASKS);
      expect(retrieved).toBeNull();
    });
  });

  describe('Cache data structure', () => {
    it('should store complete task data structure', () => {
      const testData = {
        tasks: [
          {
            id: 'task-1',
            cardName: 'Test Task',
            isCompleted: false,
            durationHours: 2,
            date: '2025-01-15',
          },
        ],
        clients: [{ client: 'Client A', count: 1 }],
        stats: {
          totalTasks: 1,
          completedTasks: 0,
          totalHours: 2,
          completedHours: 0,
          accuracy: 100,
        },
        overflowTasks: [],
      };
      
      taskCache.set(CACHE_KEYS.TIMELINE_TASKS, testData);
      const retrieved = taskCache.get(CACHE_KEYS.TIMELINE_TASKS);
      
      expect(retrieved).toEqual(testData);
      expect(retrieved?.tasks).toHaveLength(1);
      expect(retrieved?.stats.totalTasks).toBe(1);
    });
  });

  describe('Multiple cache keys', () => {
    it('should handle multiple cache keys independently', () => {
      const data1 = { tasks: [{ id: '1' }], clients: [] };
      const data2 = { tasks: [{ id: '2' }], clients: [] };
      
      taskCache.set(CACHE_KEYS.TIMELINE_TASKS, data1);
      taskCache.set('OTHER_KEY', data2);
      
      expect(taskCache.get(CACHE_KEYS.TIMELINE_TASKS)).toEqual(data1);
      expect(taskCache.get('OTHER_KEY')).toEqual(data2);
    });

    it('should invalidate only specified cache key', () => {
      const data1 = { tasks: [{ id: '1' }], clients: [] };
      const data2 = { tasks: [{ id: '2' }], clients: [] };
      
      taskCache.set(CACHE_KEYS.TIMELINE_TASKS, data1);
      taskCache.set('OTHER_KEY', data2);
      
      taskCache.invalidate(CACHE_KEYS.TIMELINE_TASKS);
      
      expect(taskCache.get(CACHE_KEYS.TIMELINE_TASKS)).toBeNull();
      expect(taskCache.get('OTHER_KEY')).toEqual(data2);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty task arrays', () => {
      const testData = { 
        tasks: [], 
        clients: [], 
        stats: { 
          totalTasks: 0, 
          completedTasks: 0, 
          totalHours: 0, 
          completedHours: 0, 
          accuracy: 100 
        }, 
        overflowTasks: [] 
      };
      
      taskCache.set(CACHE_KEYS.TIMELINE_TASKS, testData);
      const retrieved = taskCache.get(CACHE_KEYS.TIMELINE_TASKS);
      
      expect(retrieved?.tasks).toHaveLength(0);
    });

    it('should handle large task datasets', () => {
      const largeTasks = Array.from({ length: 1000 }, (_, i) => ({
        id: `task-${i}`,
        cardName: `Task ${i}`,
        isCompleted: false,
        durationHours: 1,
      }));
      
      const testData = { 
        tasks: largeTasks, 
        clients: [], 
        stats: { 
          totalTasks: 1000, 
          completedTasks: 0, 
          totalHours: 1000, 
          completedHours: 0, 
          accuracy: 100 
        }, 
        overflowTasks: [] 
      };
      
      taskCache.set(CACHE_KEYS.TIMELINE_TASKS, testData);
      const retrieved = taskCache.get(CACHE_KEYS.TIMELINE_TASKS);
      
      expect(retrieved?.tasks).toHaveLength(1000);
      expect(retrieved?.stats.totalTasks).toBe(1000);
    });
  });

  describe('Cache constants', () => {
    it('should have TIMELINE_TASKS cache key defined', () => {
      expect(CACHE_KEYS.TIMELINE_TASKS).toBeDefined();
      expect(typeof CACHE_KEYS.TIMELINE_TASKS).toBe('string');
    });
  });

  describe('Cache statistics', () => {
    it('should provide cache statistics', () => {
      const testData = { tasks: [{ id: '1' }], clients: [] };
      
      taskCache.set(CACHE_KEYS.TIMELINE_TASKS, testData);
      
      const stats = taskCache.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.keys).toContain(CACHE_KEYS.TIMELINE_TASKS);
    });
  });
});
