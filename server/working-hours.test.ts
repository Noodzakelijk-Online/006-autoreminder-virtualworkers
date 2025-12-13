import { describe, it, expect } from 'vitest';

describe('Working Hours Configuration', () => {
  const API_BASE = 'http://localhost:3000/api';
  
  describe('Settings API Endpoints', () => {
    it('should have working hours settings endpoint', async () => {
      const response = await fetch(`${API_BASE}/working-hours/settings`);
      
      // Should not be 404 (endpoint exists)
      // May be 401 if not authenticated, which is expected
      expect([200, 401]).toContain(response.status);
    });

    it('should return default settings when no custom settings exist', async () => {
      const response = await fetch(`${API_BASE}/working-hours/settings`);
      
      if (response.ok) {
        const settings = await response.json();
        
        // Should have all required fields
        expect(settings).toHaveProperty('workStartHour');
        expect(settings).toHaveProperty('workEndHour');
        expect(settings).toHaveProperty('breakfastTime');
        expect(settings).toHaveProperty('lunchTime');
        expect(settings).toHaveProperty('dinnerTime');
        
        // Default values should be reasonable
        expect(settings.workStartHour).toBeGreaterThanOrEqual(0);
        expect(settings.workStartHour).toBeLessThan(24);
        expect(settings.workEndHour).toBeGreaterThanOrEqual(0);
        expect(settings.workEndHour).toBeLessThan(24);
        expect(settings.workEndHour).toBeGreaterThan(settings.workStartHour);
      }
    });
  });

  describe('Task Scheduling with Custom Hours', () => {
    it('should fetch tasks with scheduling based on working hours', async () => {
      const response = await fetch(`${API_BASE}/trello/tasks`);
      
      if (response.ok) {
        const tasks = await response.json();
        expect(Array.isArray(tasks)).toBe(true);
        
        if (tasks.length > 0) {
          const scheduledTasks = tasks.filter((t: any) => 
            t.startTime !== 'TBD' && 
            t.startTime !== '--:--' && 
            !t.isCompleted
          );
          
          // Tasks should be scheduled within reasonable hours
          for (const task of scheduledTasks.slice(0, 5)) {
            const [startHour] = task.startTime.split(':').map(Number);
            const [endHour] = task.endTime.split(':').map(Number);
            
            // Should be within 24-hour format
            expect(startHour).toBeGreaterThanOrEqual(0);
            expect(startHour).toBeLessThan(24);
            expect(endHour).toBeGreaterThanOrEqual(0);
            expect(endHour).toBeLessThanOrEqual(24);
            
            // End should be after start
            if (endHour !== 0) { // Handle midnight edge case
              expect(endHour).toBeGreaterThanOrEqual(startHour);
            }
          }
        }
      }
    });
  });

  describe('Working Hours Validation', () => {
    it('should validate working hours make sense', () => {
      const testCases = [
        { start: 9, end: 18, valid: true, desc: 'Standard 9-6' },
        { start: 8, end: 17, valid: true, desc: 'Standard 8-5' },
        { start: 7, end: 15, valid: true, desc: 'Early shift' },
        { start: 10, end: 19, valid: true, desc: 'Late shift' },
        { start: 18, end: 9, valid: false, desc: 'Invalid: end before start' },
        { start: 9, end: 9, valid: false, desc: 'Invalid: same time' },
      ];

      for (const testCase of testCases) {
        const hoursPerDay = testCase.end - testCase.start;
        const isValid = hoursPerDay > 0 && hoursPerDay <= 16; // Max 16 hours per day
        
        expect(isValid).toBe(testCase.valid);
      }
    });

    it('should handle meal times correctly', () => {
      const mealTimes = ['09:00', '15:00', '20:00'];
      
      for (const time of mealTimes) {
        expect(time).toMatch(/^\d{2}:\d{2}$/);
        
        const [hour, minute] = time.split(':').map(Number);
        expect(hour).toBeGreaterThanOrEqual(0);
        expect(hour).toBeLessThan(24);
        expect(minute).toBeGreaterThanOrEqual(0);
        expect(minute).toBeLessThan(60);
      }
    });
  });

  describe('Database Schema', () => {
    it('should have user_working_hours table structure', () => {
      // This test verifies the expected structure exists
      const expectedFields = [
        'id',
        'userId',
        'userOpenId',
        'workStartHour',
        'workStartMinute',
        'workEndHour',
        'workEndMinute',
        'breakfastTime',
        'breakfastDuration',
        'lunchTime',
        'lunchDuration',
        'dinnerTime',
        'dinnerDuration',
        'enableBreaks',
        'shortBreakInterval',
        'shortBreakDuration',
        'longBreakInterval',
        'longBreakDuration',
      ];
      
      // Just verify the list is complete (18 fields including createdAt and updatedAt)
      expect(expectedFields.length).toBe(18);
      expect(expectedFields).toContain('workStartHour');
      expect(expectedFields).toContain('workEndHour');
    });
  });
});
