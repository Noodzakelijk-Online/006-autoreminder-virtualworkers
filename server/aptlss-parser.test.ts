import { describe, it, expect } from 'vitest';
import { parseAPTLSSItem, parseAPTLSSChecklist } from './utils/aptlss-parser';

describe('APTLSS Parser', () => {
  describe('Time Duration Parsing', () => {
    it('should parse hours format', () => {
      const result = parseAPTLSSItem('Review document (2h)');
      expect(result.durationHours).toBe(2);
      expect(result.durationConfidence).toBe('high');
    });

    it('should parse minutes format', () => {
      const result = parseAPTLSSItem('Quick call (30m)');
      expect(result.durationHours).toBe(0.5);
      expect(result.durationConfidence).toBe('high');
    });

    it('should parse combined format', () => {
      const result = parseAPTLSSItem('Meeting prep 1h30m');
      expect(result.durationHours).toBe(1.5);
      expect(result.durationConfidence).toBe('high');
    });

    it('should parse decimal hours', () => {
      const result = parseAPTLSSItem('Research task (1.5 hours)');
      expect(result.durationHours).toBe(1.5);
    });

    it('should parse time ranges and average them', () => {
      const result = parseAPTLSSItem('Complex task 1-2 hours');
      expect(result.durationHours).toBe(1.5);
    });

    it('should use default duration when no time specified', () => {
      const result = parseAPTLSSItem('Send email to client');
      expect(result.durationHours).toBeGreaterThan(0);
      expect(result.durationConfidence).toBe('low');
    });

    it('should parse pomodoro format', () => {
      const result = parseAPTLSSItem('Focus work 2 pomodoros');
      expect(result.durationHours).toBeCloseTo(50/60, 1); // 2 * 25 minutes
    });
  });

  describe('Task Type Detection', () => {
    it('should detect communication tasks', () => {
      const result = parseAPTLSSItem('Send email to client');
      expect(result.taskType).toBe('communication');
    });

    it('should detect research tasks', () => {
      const result = parseAPTLSSItem('Research competitor pricing');
      expect(result.taskType).toBe('research');
    });

    it('should detect creation tasks', () => {
      const result = parseAPTLSSItem('Write blog post about AI');
      expect(result.taskType).toBe('creation');
    });

    it('should detect meeting tasks', () => {
      const result = parseAPTLSSItem('Team standup meeting');
      expect(result.taskType).toBe('meeting');
    });

    it('should detect review tasks', () => {
      const result = parseAPTLSSItem('Review pull request');
      expect(result.taskType).toBe('review');
    });

    it('should detect admin tasks', () => {
      const result = parseAPTLSSItem('Organize files and backup');
      expect(result.taskType).toBe('admin');
    });
  });

  describe('Date Parsing', () => {
    it('should parse explicit due date', () => {
      const result = parseAPTLSSItem('Task due: 2025-12-20');
      expect(result.dueDate).toBe('2025-12-20');
      expect(result.dateSource).toBe('explicit');
    });

    it('should use card due date when no explicit date', () => {
      const result = parseAPTLSSItem('Some task', '2025-12-25');
      expect(result.dueDate).toBe('2025-12-25');
      expect(result.dateSource).toBe('card');
    });

    it('should parse today keyword', () => {
      const result = parseAPTLSSItem('Finish today');
      expect(result.dateSource).toBe('inferred');
    });

    it('should parse tomorrow keyword', () => {
      const result = parseAPTLSSItem('Complete by tomorrow');
      expect(result.dateSource).toBe('inferred');
    });
  });

  describe('Blocker and Priority Detection', () => {
    it('should detect blocker tasks', () => {
      const result = parseAPTLSSItem('BLOCKER: Fix critical bug');
      expect(result.isBlocker).toBe(true);
    });

    it('should detect urgent tasks', () => {
      const result = parseAPTLSSItem('Urgent: Deploy hotfix ASAP');
      expect(result.isBlocker).toBe(true);
    });

    it('should detect external dependencies', () => {
      const result = parseAPTLSSItem('Waiting for client approval');
      expect(result.hasExternalDependency).toBe(true);
    });
  });

  describe('Complexity Detection', () => {
    it('should detect simple tasks', () => {
      const result = parseAPTLSSItem('Quick fix for typo');
      expect(result.complexity).toBe('simple');
    });

    it('should detect complex tasks', () => {
      const result = parseAPTLSSItem('Comprehensive review of architecture');
      expect(result.complexity).toBe('complex');
    });

    it('should default to medium complexity', () => {
      const result = parseAPTLSSItem('Normal task');
      expect(result.complexity).toBe('medium');
    });
  });

  describe('Description Cleaning', () => {
    it('should remove time from description', () => {
      const result = parseAPTLSSItem('Review document (2h)');
      expect(result.cleanDescription).toBe('Review document');
    });

    it('should remove date from description', () => {
      const result = parseAPTLSSItem('Task due: 2025-12-20 - Complete review');
      expect(result.cleanDescription).not.toContain('due:');
    });
  });

  describe('Checklist Parsing', () => {
    it('should parse multiple items', () => {
      const items = [
        { name: 'Step 1: Research (1h)', state: 'incomplete', id: '1' },
        { name: 'Step 2: Write draft (2h)', state: 'incomplete', id: '2' },
        { name: 'Step 3: Review (30m)', state: 'complete', id: '3' },
      ];
      
      const results = parseAPTLSSChecklist(items);
      
      expect(results).toHaveLength(3);
      expect(results[0].durationHours).toBe(1);
      expect(results[1].durationHours).toBe(2);
      expect(results[2].durationHours).toBe(0.5);
    });

    it('should detect sequential dependencies', () => {
      const items = [
        { name: 'First task', state: 'incomplete', id: '1' },
        { name: 'Then do second task', state: 'incomplete', id: '2' },
      ];
      
      const results = parseAPTLSSChecklist(items);
      
      expect(results[1].dependencies.length).toBeGreaterThan(0);
    });
  });

  describe('Default Duration by Task Type', () => {
    it('should give shorter duration to communication tasks', () => {
      const emailTask = parseAPTLSSItem('Reply to email');
      const researchTask = parseAPTLSSItem('Research topic');
      
      expect(emailTask.durationHours).toBeLessThan(researchTask.durationHours);
    });

    it('should adjust duration based on complexity', () => {
      const simpleTask = parseAPTLSSItem('Quick simple review');
      const complexTask = parseAPTLSSItem('Comprehensive detailed review');
      
      expect(simpleTask.durationHours).toBeLessThan(complexTask.durationHours);
    });
  });
});
