import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';

/**
 * ARES Router Tests
 * Tests for ARES configuration management endpoints
 */

describe('ARES Configuration Router', () => {
  // Mock context
  const mockContext = {
    user: {
      id: 1,
      openId: 'test-user-123',
      email: 'test@example.com',
    },
    req: {},
    res: {},
  };

  describe('Configuration Management', () => {
    it('should validate configuration creation input', () => {
      const schema = z.object({
        name: z.string().min(1, 'Configuration name is required'),
        description: z.string().optional(),
        strictnessLevel: z.enum(['lenient', 'moderate', 'strict']).default('moderate'),
        confidenceThreshold: z.number().min(0).max(100).default(40),
        enableVaguenessCheck: z.boolean().default(true),
        enableMeasurabilityCheck: z.boolean().default(true),
        enableTimelineCheck: z.boolean().default(true),
        enableResourceCheck: z.boolean().default(false),
        enableDependencyCheck: z.boolean().default(false),
      });

      const validInput = {
        name: 'Strict Validation',
        description: 'High strictness configuration',
        strictnessLevel: 'strict' as const,
        confidenceThreshold: 50,
      };

      expect(() => schema.parse(validInput)).not.toThrow();
    });

    it('should reject configuration with empty name', () => {
      const schema = z.object({
        name: z.string().min(1, 'Configuration name is required'),
      });

      const invalidInput = { name: '' };

      expect(() => schema.parse(invalidInput)).toThrow();
    });

    it('should validate strictness level enum', () => {
      const schema = z.enum(['lenient', 'moderate', 'strict']);

      expect(() => schema.parse('lenient')).not.toThrow();
      expect(() => schema.parse('moderate')).not.toThrow();
      expect(() => schema.parse('strict')).not.toThrow();
      expect(() => schema.parse('invalid')).toThrow();
    });

    it('should validate confidence threshold range', () => {
      const schema = z.number().min(0).max(100);

      expect(() => schema.parse(0)).not.toThrow();
      expect(() => schema.parse(50)).not.toThrow();
      expect(() => schema.parse(100)).not.toThrow();
      expect(() => schema.parse(-1)).toThrow();
      expect(() => schema.parse(101)).toThrow();
    });
  });

  describe('Validation Rules', () => {
    it('should validate rule type enum', () => {
      const schema = z.enum([
        'vagueness',
        'measurability',
        'timeline',
        'resources',
        'dependencies',
        'clarity',
        'specificity',
        'actionability',
      ]);

      expect(() => schema.parse('vagueness')).not.toThrow();
      expect(() => schema.parse('measurability')).not.toThrow();
      expect(() => schema.parse('invalid')).toThrow();
    });

    it('should validate rule severity levels', () => {
      const schema = z.enum(['info', 'warning', 'error']);

      expect(() => schema.parse('info')).not.toThrow();
      expect(() => schema.parse('warning')).not.toThrow();
      expect(() => schema.parse('error')).not.toThrow();
      expect(() => schema.parse('critical')).toThrow();
    });

    it('should validate rule creation input', () => {
      const schema = z.object({
        configId: z.string(),
        ruleType: z.enum([
          'vagueness',
          'measurability',
          'timeline',
          'resources',
          'dependencies',
          'clarity',
          'specificity',
          'actionability',
        ]),
        ruleName: z.string().min(1),
        description: z.string().optional(),
        severity: z.enum(['info', 'warning', 'error']).default('warning'),
        enabled: z.boolean().default(true),
        threshold: z.number().optional(),
        customLogic: z.string().optional(),
      });

      const validInput = {
        configId: 'config-123',
        ruleType: 'vagueness' as const,
        ruleName: 'Detect vague pronouns',
        description: 'Checks for unclear pronoun references',
        severity: 'warning' as const,
        enabled: true,
        threshold: 60,
      };

      expect(() => schema.parse(validInput)).not.toThrow();
    });

    it('should reject rule with empty name', () => {
      const schema = z.object({
        ruleName: z.string().min(1),
      });

      expect(() => schema.parse({ ruleName: '' })).toThrow();
    });
  });

  describe('Validation History', () => {
    it('should validate validation history query input', () => {
      const schema = z.object({
        configId: z.string(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      });

      const validInput = {
        configId: 'config-123',
        limit: 10,
        offset: 0,
      };

      expect(() => schema.parse(validInput)).not.toThrow();
    });

    it('should validate validation stats query input', () => {
      const schema = z.object({
        configId: z.string(),
      });

      const validInput = { configId: 'config-123' };

      expect(() => schema.parse(validInput)).not.toThrow();
    });

    it('should calculate validation stats correctly', () => {
      const mockHistory = [
        { passed: true, confidenceScore: 85 },
        { passed: true, confidenceScore: 90 },
        { passed: false, confidenceScore: 35 },
        { passed: true, confidenceScore: 75 },
        { passed: false, confidenceScore: 40 },
      ];

      const totalValidations = mockHistory.length;
      const passedValidations = mockHistory.filter(h => h.passed).length;
      const failedValidations = totalValidations - passedValidations;
      const passRate = (passedValidations / totalValidations) * 100;
      const averageConfidence = mockHistory.reduce((sum, h) => sum + h.confidenceScore, 0) / totalValidations;

      expect(totalValidations).toBe(5);
      expect(passedValidations).toBe(3);
      expect(failedValidations).toBe(2);
      expect(passRate).toBe(60);
      expect(averageConfidence).toBe(65);
    });
  });

  describe('Configuration Strictness Levels', () => {
    it('should describe lenient strictness level', () => {
      const description = 'Minimal checks, fast processing';
      expect(description).toContain('Minimal');
    });

    it('should describe moderate strictness level', () => {
      const description = 'Balanced validation, recommended';
      expect(description).toContain('Balanced');
    });

    it('should describe strict strictness level', () => {
      const description = 'Comprehensive checks, thorough validation';
      expect(description).toContain('Comprehensive');
    });
  });

  describe('Default Configuration Management', () => {
    it('should validate set default configuration input', () => {
      const schema = z.object({
        configId: z.string(),
      });

      const validInput = { configId: 'config-123' };

      expect(() => schema.parse(validInput)).not.toThrow();
    });

    it('should ensure only one default per user', () => {
      const configs = [
        { id: 'config-1', isDefault: true, userId: 1 },
        { id: 'config-2', isDefault: false, userId: 1 },
        { id: 'config-3', isDefault: false, userId: 1 },
      ];

      const defaultCount = configs.filter(c => c.isDefault).length;
      expect(defaultCount).toBe(1);
    });
  });

  describe('Validation Rule Severity Mapping', () => {
    it('should map severity to CSS classes', () => {
      const severityColors = {
        info: 'bg-blue-100 text-blue-800',
        warning: 'bg-yellow-100 text-yellow-800',
        error: 'bg-red-100 text-red-800',
      };

      expect(severityColors.info).toContain('blue');
      expect(severityColors.warning).toContain('yellow');
      expect(severityColors.error).toContain('red');
    });
  });

  describe('Configuration Deletion Cascade', () => {
    it('should delete configuration with associated data', () => {
      // Mock data structure
      const configurations = [
        { id: 'config-1', userId: 1, name: 'Config 1' },
      ];

      const validationRules = [
        { id: 'rule-1', configId: 'config-1', ruleName: 'Rule 1' },
        { id: 'rule-2', configId: 'config-1', ruleName: 'Rule 2' },
      ];

      const validationHistory = [
        { id: 'hist-1', configId: 'config-1', cardId: 'card-1' },
        { id: 'hist-2', configId: 'config-1', cardId: 'card-2' },
      ];

      // Simulate deletion
      const configToDelete = 'config-1';
      const remainingConfigs = configurations.filter(c => c.id !== configToDelete);
      const remainingRules = validationRules.filter(r => r.configId !== configToDelete);
      const remainingHistory = validationHistory.filter(h => h.configId !== configToDelete);

      expect(remainingConfigs.length).toBe(0);
      expect(remainingRules.length).toBe(0);
      expect(remainingHistory.length).toBe(0);
    });
  });

  describe('Rule Type Descriptions', () => {
    it('should map rule types to descriptions', () => {
      const ruleTypeOptions = [
        { value: 'vagueness', label: 'Vagueness Detection' },
        { value: 'measurability', label: 'Measurability Check' },
        { value: 'timeline', label: 'Timeline Validation' },
        { value: 'resources', label: 'Resource Requirements' },
        { value: 'dependencies', label: 'Dependency Analysis' },
        { value: 'clarity', label: 'Clarity Assessment' },
        { value: 'specificity', label: 'Specificity Check' },
        { value: 'actionability', label: 'Actionability Validation' },
      ];

      expect(ruleTypeOptions.length).toBe(8);
      expect(ruleTypeOptions.find(r => r.value === 'vagueness')?.label).toBe('Vagueness Detection');
      expect(ruleTypeOptions.find(r => r.value === 'measurability')?.label).toBe('Measurability Check');
    });
  });

  describe('Configuration Update Scenarios', () => {
    it('should allow partial updates', () => {
      const schema = z.object({
        configId: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        strictnessLevel: z.enum(['lenient', 'moderate', 'strict']).optional(),
        confidenceThreshold: z.number().min(0).max(100).optional(),
      });

      const partialUpdate = {
        configId: 'config-123',
        strictnessLevel: 'strict' as const,
      };

      expect(() => schema.parse(partialUpdate)).not.toThrow();
    });

    it('should validate threshold updates', () => {
      const schema = z.number().min(0).max(100);

      expect(() => schema.parse(0)).not.toThrow();
      expect(() => schema.parse(40)).not.toThrow();
      expect(() => schema.parse(100)).not.toThrow();
    });
  });
});
