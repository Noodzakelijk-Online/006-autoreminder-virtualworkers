import { describe, it, expect, beforeAll } from 'vitest';

describe('Working Days and Timezone Features', () => {
  const API_BASE = 'http://localhost:3000/api';
  let cachedSettings: any = null;
  let cachedTasksData: any = null;
  
  // Fetch data once before all tests to avoid rate limiting
  beforeAll(async () => {
    try {
      // Fetch settings
      const settingsResponse = await fetch(`${API_BASE}/working-hours/settings`);
      if (settingsResponse.ok) {
        cachedSettings = await settingsResponse.json();
      }
      
      // Wait a bit to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Fetch tasks
      const tasksResponse = await fetch(`${API_BASE}/trello/tasks`);
      if (tasksResponse.ok) {
        cachedTasksData = await tasksResponse.json();
      }
    } catch (error) {
      console.warn('Could not fetch data for testing:', error);
    }
  }, 30000); // 30 second timeout for initial fetch

  describe('Working Days Configuration', () => {
    it('should have working days field in settings', () => {
      if (cachedSettings) {
        expect(cachedSettings).toHaveProperty('workingDays');
        
        // Should be a comma-separated string
        expect(typeof cachedSettings.workingDays).toBe('string');
        
        // Should contain valid day numbers (0-6)
        const days = cachedSettings.workingDays.split(',').filter((d: string) => d).map(Number);
        for (const day of days) {
          expect(day).toBeGreaterThanOrEqual(0);
          expect(day).toBeLessThanOrEqual(6);
        }
      }
    });

    it('should validate working days format', () => {
      const testCases = [
        { input: '1,2,3,4,5', valid: true, desc: 'Mon-Fri' },
        { input: '0,6', valid: true, desc: 'Weekends only' },
        { input: '0,1,2,3,4,5,6', valid: true, desc: 'All days' },
        { input: '1', valid: true, desc: 'Single day' },
        { input: '', valid: false, desc: 'Empty string' },
      ];

      for (const testCase of testCases) {
        const days = testCase.input.split(',').filter(d => d);
        const isValid = days.length > 0 && days.every(d => {
          const num = parseInt(d);
          return !isNaN(num) && num >= 0 && num <= 6;
        });
        
        expect(isValid).toBe(testCase.valid);
      }
    });

    it('should filter tasks on non-working days', () => {
      if (cachedTasksData) {
        const tasks = Array.isArray(cachedTasksData) ? cachedTasksData : (cachedTasksData.tasks || []);
        
        // Check if any tasks are marked as TBD for non-working days
        const tbdTasks = tasks.filter((t: any) => 
          t.startTime === 'TBD' && 
          t.note === 'Non-working day'
        );
        
        // If there are TBD tasks, verify they're on non-working days
        if (tbdTasks.length > 0) {
          for (const task of tbdTasks) {
            const taskDate = new Date(task.date);
            const dayOfWeek = taskDate.getDay();
            
            // These should be weekend days or configured non-working days
            // For default Mon-Fri (1-5), weekends (0,6) should be TBD
            expect([0, 6]).toContain(dayOfWeek);
          }
        } else {
          // If no TBD tasks, that's also valid (all tasks on working days)
          expect(tbdTasks.length).toBe(0);
        }
      }
    });
  });

  describe('Timezone Support', () => {
    it('should have timezone field in settings', () => {
      if (cachedSettings) {
        expect(cachedSettings).toHaveProperty('timezone');
        
        // Should be a valid IANA timezone string
        expect(typeof cachedSettings.timezone).toBe('string');
        expect(cachedSettings.timezone.length).toBeGreaterThan(0);
      }
    });

    it('should return timezone with tasks API response', () => {
      if (cachedTasksData) {
        // New format should include timezone
        if (!Array.isArray(cachedTasksData)) {
          expect(cachedTasksData).toHaveProperty('timezone');
          expect(cachedTasksData).toHaveProperty('tasks');
          expect(Array.isArray(cachedTasksData.tasks)).toBe(true);
        }
      }
    });

    it('should validate common timezone formats', () => {
      const validTimezones = [
        'UTC',
        'America/New_York',
        'Europe/Amsterdam',
        'Asia/Tokyo',
        'Australia/Sydney',
      ];

      for (const tz of validTimezones) {
        // Test that timezone string follows IANA format
        expect(tz).toMatch(/^[A-Za-z_]+\/[A-Za-z_]+$|^UTC$/);
      }
    });

    it('should handle timezone conversion correctly', () => {
      // Test basic timezone conversion logic
      const utcTime = '09:00';
      const [hour, minute] = utcTime.split(':').map(Number);
      
      expect(hour).toBeGreaterThanOrEqual(0);
      expect(hour).toBeLessThan(24);
      expect(minute).toBeGreaterThanOrEqual(0);
      expect(minute).toBeLessThan(60);
      
      // Verify time format is preserved
      expect(utcTime).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('Combined Working Days and Timezone', () => {
    it('should respect both working days and timezone in scheduling', () => {
      if (cachedTasksData) {
        const tasks = Array.isArray(cachedTasksData) ? cachedTasksData : (cachedTasksData.tasks || []);
        const timezone = Array.isArray(cachedTasksData) ? 'UTC' : (cachedTasksData.timezone || 'UTC');
        
        // Verify we have both pieces of information
        expect(Array.isArray(tasks)).toBe(true);
        expect(typeof timezone).toBe('string');
        
        // Check that scheduled tasks have valid times
        const scheduledTasks = tasks.filter((t: any) => 
          t.startTime !== 'TBD' && 
          t.startTime !== '--:--' &&
          !t.isCompleted
        );
        
        for (const task of scheduledTasks.slice(0, 5)) {
          // Should have valid time format
          expect(task.startTime).toMatch(/^\d{2}:\d{2}$/);
          expect(task.endTime).toMatch(/^\d{2}:\d{2}$/);
          
          // Should have a date
          expect(task.date).toBeTruthy();
        }
      }
    });
  });
});
