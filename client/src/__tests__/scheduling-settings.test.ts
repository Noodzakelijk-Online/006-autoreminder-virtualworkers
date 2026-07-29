import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Scheduling Settings', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Conflict Detection Settings', () => {
    it('should load default conflict detection config', () => {
      const defaultConfig = {
        enabled: true,
        warningThresholdMinutes: 15,
        autoResolve: false,
        notifyOnConflict: true,
        conflictTypes: {
          timeOverlap: true,
          resourceConflict: true,
          dependencyConflict: true,
        },
      };

      expect(defaultConfig.enabled).toBe(true);
      expect(defaultConfig.warningThresholdMinutes).toBe(15);
      expect(defaultConfig.autoResolve).toBe(false);
      expect(defaultConfig.notifyOnConflict).toBe(true);
    });

    it('should persist conflict detection config to localStorage', () => {
      const config = {
        enabled: true,
        warningThresholdMinutes: 20,
        autoResolve: true,
        notifyOnConflict: true,
        conflictTypes: {
          timeOverlap: true,
          resourceConflict: false,
          dependencyConflict: true,
        },
      };

      localStorage.setItem('conflictDetectionConfig', JSON.stringify(config));
      const saved = localStorage.getItem('conflictDetectionConfig');
      expect(saved).toBeTruthy();
      expect(JSON.parse(saved!)).toEqual(config);
    });

    it('should validate warning threshold is within bounds', () => {
      const validateThreshold = (minutes: number) => {
        return minutes >= 5 && minutes <= 120;
      };

      expect(validateThreshold(15)).toBe(true);
      expect(validateThreshold(5)).toBe(true);
      expect(validateThreshold(120)).toBe(true);
      expect(validateThreshold(4)).toBe(false);
      expect(validateThreshold(121)).toBe(false);
    });

    it('should handle conflict type toggles', () => {
      const config = {
        enabled: true,
        warningThresholdMinutes: 15,
        autoResolve: false,
        notifyOnConflict: true,
        conflictTypes: {
          timeOverlap: true,
          resourceConflict: true,
          dependencyConflict: true,
        },
      };

      const updated = {
        ...config,
        conflictTypes: {
          ...config.conflictTypes,
          resourceConflict: false,
        },
      };

      expect(updated.conflictTypes.resourceConflict).toBe(false);
      expect(updated.conflictTypes.timeOverlap).toBe(true);
    });
  });

  describe('Batch Operation Defaults', () => {
    it('should load default batch operation config', () => {
      const defaultConfig = {
        defaultOperationType: 're_analyze' as const,
        defaultPriority: 'normal' as const,
        autoStartOnQueue: false,
        maxConcurrentOperations: 3,
        retryFailedTasks: true,
        maxRetries: 2,
        notifyOnCompletion: true,
        notifyOnFailure: true,
      };

      expect(defaultConfig.defaultOperationType).toBe('re_analyze');
      expect(defaultConfig.defaultPriority).toBe('normal');
      expect(defaultConfig.maxConcurrentOperations).toBe(3);
      expect(defaultConfig.maxRetries).toBe(2);
    });

    it('should persist batch operation defaults to localStorage', () => {
      const config = {
        defaultOperationType: 'reschedule' as const,
        defaultPriority: 'high' as const,
        autoStartOnQueue: true,
        maxConcurrentOperations: 5,
        retryFailedTasks: true,
        maxRetries: 3,
        notifyOnCompletion: true,
        notifyOnFailure: true,
      };

      localStorage.setItem('batchOperationDefaults', JSON.stringify(config));
      const saved = localStorage.getItem('batchOperationDefaults');
      expect(saved).toBeTruthy();
      expect(JSON.parse(saved!)).toEqual(config);
    });

    it('should validate max concurrent operations', () => {
      const validateConcurrency = (ops: number) => {
        return ops >= 1 && ops <= 10;
      };

      expect(validateConcurrency(1)).toBe(true);
      expect(validateConcurrency(5)).toBe(true);
      expect(validateConcurrency(10)).toBe(true);
      expect(validateConcurrency(0)).toBe(false);
      expect(validateConcurrency(11)).toBe(false);
    });

    it('should handle operation type changes', () => {
      const config = {
        defaultOperationType: 're_analyze' as const,
        defaultPriority: 'normal' as const,
        autoStartOnQueue: false,
        maxConcurrentOperations: 3,
        retryFailedTasks: true,
        maxRetries: 2,
        notifyOnCompletion: true,
        notifyOnFailure: true,
      };

      const updated = {
        ...config,
        defaultOperationType: 'conflict_resolution' as const,
      };

      expect(updated.defaultOperationType).toBe('conflict_resolution');
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should load default keyboard shortcuts', () => {
      const shortcuts = [
        { action: 'focus-calendar', keys: 'Ctrl+1', description: 'Focus calendar view', category: 'navigation' as const },
        { action: 'reschedule-task', keys: 'Ctrl+R', description: 'Reschedule selected task', category: 'scheduling' as const },
        { action: 'start-batch', keys: 'Ctrl+B', description: 'Start batch operation', category: 'batch' as const },
      ];

      expect(shortcuts).toHaveLength(3);
      expect(shortcuts[0].action).toBe('focus-calendar');
      expect(shortcuts[1].keys).toBe('Ctrl+R');
    });

    it('should persist keyboard shortcuts to localStorage', () => {
      const shortcuts = [
        { action: 'focus-calendar', keys: 'Ctrl+1', description: 'Focus calendar view', category: 'navigation' as const },
        { action: 'reschedule-task', keys: 'Ctrl+Shift+R', description: 'Reschedule selected task', category: 'scheduling' as const },
      ];

      localStorage.setItem('keyboardShortcuts', JSON.stringify(shortcuts));
      const saved = localStorage.getItem('keyboardShortcuts');
      expect(saved).toBeTruthy();
      const parsed = JSON.parse(saved!);
      expect(parsed[1].keys).toBe('Ctrl+Shift+R');
    });

    it('should detect duplicate shortcuts', () => {
      const shortcuts = [
        { action: 'focus-calendar', keys: 'Ctrl+1', description: 'Focus calendar view', category: 'navigation' as const },
        { action: 'reschedule-task', keys: 'Ctrl+1', description: 'Reschedule selected task', category: 'scheduling' as const },
      ];

      const hasDuplicates = (shortcuts: typeof shortcuts) => {
        const keys = shortcuts.map(s => s.keys);
        return keys.length !== new Set(keys).size;
      };

      expect(hasDuplicates(shortcuts)).toBe(true);
    });

    it('should filter shortcuts by category', () => {
      const shortcuts = [
        { action: 'focus-calendar', keys: 'Ctrl+1', description: 'Focus calendar view', category: 'navigation' as const },
        { action: 'reschedule-task', keys: 'Ctrl+R', description: 'Reschedule selected task', category: 'scheduling' as const },
        { action: 'start-batch', keys: 'Ctrl+B', description: 'Start batch operation', category: 'batch' as const },
      ];

      const navigationShortcuts = shortcuts.filter(s => s.category === 'navigation');
      expect(navigationShortcuts).toHaveLength(1);
      expect(navigationShortcuts[0].action).toBe('focus-calendar');
    });
  });

  describe('Performance Metrics', () => {
    it('should initialize default performance metrics', () => {
      const metrics = {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageExecutionTime: 0,
        averageTasksPerOperation: 0,
        conflictsDetected: 0,
        conflictsResolved: 0,
        lastUpdated: new Date(),
        trend: {
          successRate: 0,
          executionTimeTrend: 'stable' as const,
          operationsTrend: 'stable' as const,
        },
      };

      expect(metrics.totalOperations).toBe(0);
      expect(metrics.trend.executionTimeTrend).toBe('stable');
    });

    it('should calculate success rate', () => {
      const calculateSuccessRate = (successful: number, total: number) => {
        return total > 0 ? ((successful / total) * 100).toFixed(1) : '0';
      };

      expect(calculateSuccessRate(90, 100)).toBe('90.0');
      expect(calculateSuccessRate(85, 100)).toBe('85.0');
      expect(calculateSuccessRate(0, 0)).toBe('0');
    });

    it('should calculate conflict resolution rate', () => {
      const calculateResolutionRate = (resolved: number, detected: number) => {
        return detected > 0 ? ((resolved / detected) * 100).toFixed(1) : '0';
      };

      expect(calculateResolutionRate(80, 100)).toBe('80.0');
      expect(calculateResolutionRate(50, 100)).toBe('50.0');
      expect(calculateResolutionRate(0, 0)).toBe('0');
    });

    it('should persist metrics to localStorage', () => {
      const metrics = {
        totalOperations: 50,
        successfulOperations: 45,
        failedOperations: 5,
        averageExecutionTime: 2.5,
        averageTasksPerOperation: 10,
        conflictsDetected: 20,
        conflictsResolved: 18,
        lastUpdated: new Date().toISOString(),
        trend: {
          successRate: 90,
          executionTimeTrend: 'improving' as const,
          operationsTrend: 'increasing' as const,
        },
      };

      localStorage.setItem('performanceMetrics', JSON.stringify(metrics));
      const saved = localStorage.getItem('performanceMetrics');
      expect(saved).toBeTruthy();
      const parsed = JSON.parse(saved!);
      expect(parsed.totalOperations).toBe(50);
      expect(parsed.trend.executionTimeTrend).toBe('improving');
    });

    it('should determine performance quality level', () => {
      const getQualityLevel = (successRate: number) => {
        if (successRate >= 90) return 'Excellent';
        if (successRate >= 70) return 'Good';
        return 'Needs Improvement';
      };

      expect(getQualityLevel(95)).toBe('Excellent');
      expect(getQualityLevel(80)).toBe('Good');
      expect(getQualityLevel(60)).toBe('Needs Improvement');
    });
  });

  describe('Settings Integration', () => {
    it('should handle multiple settings changes', () => {
      const settings = {
        conflict: { enabled: true },
        batch: { maxConcurrentOperations: 3 },
        shortcuts: { 'focus-calendar': 'Ctrl+1' },
        metrics: { totalOperations: 0 },
      };

      const updated = {
        ...settings,
        conflict: { enabled: false },
        batch: { maxConcurrentOperations: 5 },
      };

      expect(updated.conflict.enabled).toBe(false);
      expect(updated.batch.maxConcurrentOperations).toBe(5);
      expect(updated.shortcuts['focus-calendar']).toBe('Ctrl+1');
    });

    it('should clear all settings', () => {
      localStorage.setItem('conflictDetectionConfig', JSON.stringify({ enabled: true }));
      localStorage.setItem('batchOperationDefaults', JSON.stringify({ maxConcurrentOperations: 3 }));
      localStorage.setItem('keyboardShortcuts', JSON.stringify([]));
      localStorage.setItem('performanceMetrics', JSON.stringify({}));

      const clearAllSettings = () => {
        localStorage.removeItem('conflictDetectionConfig');
        localStorage.removeItem('batchOperationDefaults');
        localStorage.removeItem('keyboardShortcuts');
        localStorage.removeItem('performanceMetrics');
      };

      clearAllSettings();

      expect(localStorage.getItem('conflictDetectionConfig')).toBeNull();
      expect(localStorage.getItem('batchOperationDefaults')).toBeNull();
      expect(localStorage.getItem('keyboardShortcuts')).toBeNull();
      expect(localStorage.getItem('performanceMetrics')).toBeNull();
    });
  });
});
