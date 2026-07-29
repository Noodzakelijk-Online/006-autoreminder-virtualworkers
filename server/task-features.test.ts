import { describe, it, expect, beforeAll } from 'vitest';

describe('Task Scheduling and Sync Features', () => {
  const API_BASE = 'http://localhost:3000/api';
  let cachedTasks: any[] = [];
  
  // Fetch tasks once before all tests to avoid rate limiting
  beforeAll(async () => {
    try {
      const response = await fetch(`${API_BASE}/trello/tasks`);
      if (response.ok) {
        cachedTasks = await response.json();
      }
    } catch (error) {
      console.warn('Could not fetch tasks for testing:', error);
      cachedTasks = [];
    }
  }, 30000); // 30 second timeout for initial fetch

  describe('Task Scheduling Algorithm', () => {
    it('should return tasks as an array', () => {
      expect(Array.isArray(cachedTasks)).toBe(true);
    });

    it('should include scheduling fields in tasks', () => {
      if (cachedTasks.length > 0) {
        const task = cachedTasks[0];
        // Check that tasks have required scheduling fields
        expect(task).toHaveProperty('startTime');
        expect(task).toHaveProperty('endTime');
        expect(task).toHaveProperty('durationHours');
        expect(task).toHaveProperty('date');
        
        // Verify time format (HH:MM or TBD or --:--)
        if (task.startTime !== 'TBD' && task.startTime !== '--:--') {
          expect(task.startTime).toMatch(/^\d{2}:\d{2}$/);
        }
        if (task.endTime !== 'TBD' && task.endTime !== '--:--') {
          expect(task.endTime).toMatch(/^\d{2}:\d{2}$/);
        }
      }
    });

    it('should schedule tasks within working hours (9:00 - 18:00)', () => {
      const scheduledTasks = cachedTasks.filter((t: any) => 
        t.startTime !== 'TBD' && 
        t.startTime !== '--:--' && 
        !t.isCompleted
      );
      
      if (scheduledTasks.length > 0) {
        for (const task of scheduledTasks.slice(0, 10)) { // Test first 10 to avoid long runs
          const [startHour] = task.startTime.split(':').map(Number);
          const [endHour] = task.endTime.split(':').map(Number);
          
          // Start time should be >= 9:00
          expect(startHour).toBeGreaterThanOrEqual(9);
          // End time should be <= 18:00
          expect(endHour).toBeLessThanOrEqual(18);
        }
      }
    });

    it('should mark completed tasks with --:-- times', () => {
      const completedTasks = cachedTasks.filter((t: any) => t.isCompleted);
      
      if (completedTasks.length > 0) {
        for (const task of completedTasks.slice(0, 10)) { // Test first 10
          expect(task.startTime).toBe('--:--');
          expect(task.endTime).toBe('--:--');
        }
      }
    });

    it('should schedule tasks sequentially without overlaps', () => {
      // Group by date
      const tasksByDate = new Map<string, any[]>();
      for (const task of cachedTasks) {
        if (!tasksByDate.has(task.date)) {
          tasksByDate.set(task.date, []);
        }
        tasksByDate.get(task.date)!.push(task);
      }

      // Check one day's schedule
      for (const [date, dayTasks] of Array.from(tasksByDate.entries()).slice(0, 1)) {
        const scheduled = dayTasks
          .filter(t => !t.isCompleted && t.startTime !== 'TBD')
          .sort((a, b) => a.startTime.localeCompare(b.startTime));

        for (let i = 0; i < scheduled.length - 1; i++) {
          const current = scheduled[i];
          const next = scheduled[i + 1];
          
          // Current task's end time should be <= next task's start time
          expect(current.endTime <= next.startTime).toBe(true);
        }
      }
    });
  });

  describe('Task Status Sync to Trello', () => {
    it('should have required fields for syncing', () => {
      if (cachedTasks.length > 0) {
        const task = cachedTasks[0];
        // These fields are required for syncing back to Trello
        expect(task).toHaveProperty('cardId');
        expect(task).toHaveProperty('checklistId');
        expect(task).toHaveProperty('checkItemId');
        
        // Verify they are not empty
        expect(task.cardId).toBeTruthy();
        expect(task.checklistId).toBeTruthy();
        expect(task.checkItemId).toBeTruthy();
      }
    });

    it('should have sync endpoint available', async () => {
      // Test that the endpoint exists (will fail with 400 for invalid data, not 404)
      const mockTaskId = 'test_task_id';
      const mockPayload = {
        isCompleted: true,
        cardId: 'mock_card_id',
        checklistId: 'mock_checklist_id',
        checkItemId: 'mock_check_item_id'
      };
      
      const response = await fetch(`${API_BASE}/trello/tasks/${mockTaskId}/complete`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockPayload),
      });
      
      // Should not be 404 (endpoint exists)
      expect(response.status).not.toBe(404);
    });
  });

  describe('Task Data Structure', () => {
    it('should include all required task fields', () => {
      if (cachedTasks.length > 0) {
        const task = cachedTasks[0];
        const requiredFields = [
          'id',
          'cardId',
          'cardName',
          'checklistId',
          'checkItemId',
          'stepIndex',
          'description',
          'durationHours',
          'startTime',
          'endTime',
          'date',
          'isCompleted',
          'priorityLevel'
        ];
        
        for (const field of requiredFields) {
          expect(task).toHaveProperty(field);
        }
      }
    });

    it('should have valid priority levels', () => {
      const validPriorities = ['CRITICAL', 'URGENT', 'HIGH', 'NORMAL'];
      
      for (const task of cachedTasks.slice(0, 20)) {
        expect(validPriorities).toContain(task.priorityLevel);
      }
    });
  });
});
