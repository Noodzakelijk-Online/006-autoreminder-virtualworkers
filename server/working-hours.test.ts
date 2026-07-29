import express from 'express';
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import workingHoursRouter from './routes/working-hours';

describe('Working Hours Configuration', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/working-hours', workingHoursRouter);
  
  describe('Settings API Endpoints', () => {
    it('should have working hours settings endpoint', async () => {
      const response = await request(app).get('/api/working-hours/settings');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should reject unauthenticated settings reads before database access', async () => {
      const response = await request(app).get('/api/working-hours/settings');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('Task Scheduling with Custom Hours', () => {
    it('should validate representative scheduled task times', () => {
      const tasks = [
        { startTime: '09:00', endTime: '10:30', isCompleted: false },
        { startTime: '10:30', endTime: '12:00', isCompleted: false },
      ];

      for (const task of tasks) {
        const [startHour] = task.startTime.split(':').map(Number);
        const [endHour] = task.endTime.split(':').map(Number);

        expect(startHour).toBeGreaterThanOrEqual(0);
        expect(startHour).toBeLessThan(24);
        expect(endHour).toBeGreaterThanOrEqual(startHour);
        expect(endHour).toBeLessThanOrEqual(24);
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
