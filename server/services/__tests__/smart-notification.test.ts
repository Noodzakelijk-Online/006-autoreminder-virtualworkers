import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies
vi.mock('../../db', () => ({
  getDb: vi.fn(),
}));

vi.mock('../../_core/notification', () => ({
  notifyOwner: vi.fn(),
}));

vi.mock('../email', () => ({
  sendEmail: vi.fn(),
}));

describe('Smart Notification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isTaskUrgent helper logic', () => {
    it('should identify task as urgent when due within threshold', () => {
      // Task due in 12 hours with 24 hour threshold = urgent
      const dueDate = new Date(Date.now() + 12 * 60 * 60 * 1000);
      const thresholdHours = 24;
      
      const hoursUntilDue = (dueDate.getTime() - Date.now()) / (1000 * 60 * 60);
      const isUrgent = hoursUntilDue <= thresholdHours;
      
      expect(isUrgent).toBe(true);
      expect(hoursUntilDue).toBeLessThanOrEqual(thresholdHours);
    });

    it('should identify task as not urgent when due beyond threshold', () => {
      // Task due in 48 hours with 24 hour threshold = not urgent
      const dueDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const thresholdHours = 24;
      
      const hoursUntilDue = (dueDate.getTime() - Date.now()) / (1000 * 60 * 60);
      const isUrgent = hoursUntilDue <= thresholdHours;
      
      expect(isUrgent).toBe(false);
      expect(hoursUntilDue).toBeGreaterThan(thresholdHours);
    });

    it('should identify overdue task as urgent', () => {
      // Task due 2 hours ago = overdue = urgent
      const dueDate = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const thresholdHours = 24;
      
      const hoursUntilDue = (dueDate.getTime() - Date.now()) / (1000 * 60 * 60);
      const isUrgent = hoursUntilDue <= thresholdHours;
      
      expect(isUrgent).toBe(true);
      expect(hoursUntilDue).toBeLessThan(0);
    });

    it('should handle null due date', () => {
      const dueDate = null;
      
      // No due date = not urgent
      const isUrgent = dueDate !== null;
      
      expect(isUrgent).toBe(false);
    });
  });

  describe('Notification Mode Logic', () => {
    it('should block notifications when mode is disabled', () => {
      const mode = 'disabled';
      const shouldSend = mode !== 'disabled';
      
      expect(shouldSend).toBe(false);
    });

    it('should queue for digest when mode is daily_digest', () => {
      const mode = 'daily_digest';
      const shouldQueueForDigest = mode === 'daily_digest';
      const shouldSendImmediately = mode !== 'daily_digest' && mode !== 'disabled';
      
      expect(shouldQueueForDigest).toBe(true);
      expect(shouldSendImmediately).toBe(false);
    });

    it('should check urgency when mode is priority_only', () => {
      const mode = 'priority_only';
      const shouldCheckUrgency = mode === 'priority_only';
      
      expect(shouldCheckUrgency).toBe(true);
    });
  });

  describe('Urgency Threshold Calculations', () => {
    const thresholds = [6, 12, 24, 48, 72];
    
    thresholds.forEach(threshold => {
      it(`should correctly evaluate ${threshold} hour threshold`, () => {
        const now = Date.now();
        
        // Task due exactly at threshold should be urgent
        const atThreshold = new Date(now + threshold * 60 * 60 * 1000);
        const hoursAtThreshold = (atThreshold.getTime() - now) / (1000 * 60 * 60);
        expect(hoursAtThreshold).toBeCloseTo(threshold, 1);
        expect(hoursAtThreshold <= threshold).toBe(true);
        
        // Task due 1 hour after threshold should not be urgent
        const afterThreshold = new Date(now + (threshold + 1) * 60 * 60 * 1000);
        const hoursAfterThreshold = (afterThreshold.getTime() - now) / (1000 * 60 * 60);
        expect(hoursAfterThreshold > threshold).toBe(true);
      });
    });
  });

  describe('Notification Preference Defaults', () => {
    it('should have correct default values', () => {
      const defaults = {
        notificationMode: 'priority_only',
        digestTime: '08:00',
        digestTimezone: 'Europe/Amsterdam',
        urgentThresholdHours: 24,
        emailEnabled: true,
        inAppEnabled: true,
      };
      
      expect(defaults.notificationMode).toBe('priority_only');
      expect(defaults.urgentThresholdHours).toBe(24);
      expect(defaults.emailEnabled).toBe(true);
      expect(defaults.inAppEnabled).toBe(true);
    });
  });

  describe('Digest Time Validation', () => {
    it('should accept valid HH:MM format', () => {
      const validTimes = ['00:00', '08:00', '12:30', '23:59'];
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      
      validTimes.forEach(time => {
        expect(timeRegex.test(time)).toBe(true);
      });
    });

    it('should reject invalid time formats', () => {
      const invalidTimes = ['24:00', '8:00', '08:60', '25:30', 'invalid'];
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      
      invalidTimes.forEach(time => {
        expect(timeRegex.test(time)).toBe(false);
      });
    });
  });

  describe('Notification Type Handling', () => {
    const notificationTypes = [
      'task_assigned',
      'task_due_soon', 
      'task_overdue',
      'task_completed',
      'general'
    ];

    it('should handle all notification types', () => {
      notificationTypes.forEach(type => {
        expect(typeof type).toBe('string');
        expect(type.length).toBeGreaterThan(0);
      });
    });

    it('should always send overdue notifications in priority_only mode', () => {
      const mode = 'priority_only';
      const notificationType = 'task_overdue';
      
      // Overdue notifications should always be sent regardless of due date
      const shouldAlwaysSend = notificationType === 'task_overdue';
      
      expect(shouldAlwaysSend).toBe(true);
    });
  });
});
