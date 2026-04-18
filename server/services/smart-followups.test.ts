import { describe, it, expect } from 'vitest';
import {
  detectLowConfidenceAndGenerateFollowUps,
  generateSmartFollowUpMessage,
  type SmartFollowUpResult,
} from './answer-validator';

describe('Smart Follow-ups Feature', () => {
  describe('detectLowConfidenceAndGenerateFollowUps', () => {
    it('should not trigger follow-ups when confidence is above threshold', () => {
      const validation = {
        isValid: true,
        confidence: 85,
        issues: [],
        suggestions: [],
      };

      const result = detectLowConfidenceAndGenerateFollowUps(validation, 40);

      expect(result.shouldAsk).toBe(false);
      expect(result.followUpQuestions).toHaveLength(0);
      expect(result.confidence).toBe(85);
    });

    it('should trigger follow-ups when confidence is below threshold', () => {
      const validation = {
        isValid: false,
        confidence: 30,
        issues: [
          {
            type: 'vague' as const,
            severity: 'critical' as const,
            message: '"the client" is too vague',
            suggestedQuestion: 'Which specific person or organization?',
          },
        ],
        suggestions: [],
      };

      const result = detectLowConfidenceAndGenerateFollowUps(validation, 40);

      expect(result.shouldAsk).toBe(true);
      expect(result.confidence).toBe(30);
      expect(result.followUpQuestions.length).toBeGreaterThan(0);
      expect(result.primaryIssue).toBe('Vague references');
    });

    it('should categorize vague issues correctly', () => {
      const validation = {
        isValid: false,
        confidence: 25,
        issues: [
          {
            type: 'vague' as const,
            severity: 'critical' as const,
            message: '"the client" is too vague',
            suggestedQuestion: 'Which specific person or organization?',
          },
          {
            type: 'vague' as const,
            severity: 'critical' as const,
            message: '"ASAP" is not a specific deadline',
            suggestedQuestion: 'Can you give me a specific date?',
          },
        ],
        suggestions: [],
      };

      const result = detectLowConfidenceAndGenerateFollowUps(validation, 40);

      expect(result.shouldAsk).toBe(true);
      expect(result.primaryIssue).toBe('Vague references');
      expect(result.followUpQuestions.length).toBeGreaterThanOrEqual(2);
    });

    it('should categorize action vs outcome issues', () => {
      const validation = {
        isValid: false,
        confidence: 35,
        issues: [
          {
            type: 'action_not_outcome' as const,
            severity: 'warning' as const,
            message: 'This sounds like an action, not an outcome',
            suggestedQuestion: 'What do you want to ACHIEVE by doing that?',
          },
        ],
        suggestions: [],
      };

      const result = detectLowConfidenceAndGenerateFollowUps(validation, 40);

      expect(result.shouldAsk).toBe(true);
      expect(result.primaryIssue).toBe('Action-focused instead of outcome-focused');
      expect(result.followUpQuestions).toContain('What do you want to ACHIEVE by doing that?');
    });

    it('should categorize unmeasurable issues', () => {
      const validation = {
        isValid: false,
        confidence: 38,
        issues: [
          {
            type: 'unmeasurable' as const,
            severity: 'warning' as const,
            message: 'How will you know when this is done?',
            suggestedQuestion: 'What specific thing will happen that proves it is complete?',
          },
        ],
        suggestions: [],
      };

      const result = detectLowConfidenceAndGenerateFollowUps(validation, 40);

      expect(result.shouldAsk).toBe(true);
      expect(result.primaryIssue).toBe('Unmeasurable outcome');
      expect(result.followUpQuestions).toContain('What specific thing will happen that proves it is complete?');
    });

    it('should limit follow-up questions to 3', () => {
      const validation = {
        isValid: false,
        confidence: 20,
        issues: [
          {
            type: 'vague' as const,
            severity: 'critical' as const,
            message: 'Issue 1',
            suggestedQuestion: 'Question 1?',
          },
          {
            type: 'vague' as const,
            severity: 'critical' as const,
            message: 'Issue 2',
            suggestedQuestion: 'Question 2?',
          },
          {
            type: 'vague' as const,
            severity: 'critical' as const,
            message: 'Issue 3',
            suggestedQuestion: 'Question 3?',
          },
          {
            type: 'vague' as const,
            severity: 'critical' as const,
            message: 'Issue 4',
            suggestedQuestion: 'Question 4?',
          },
          {
            type: 'vague' as const,
            severity: 'critical' as const,
            message: 'Issue 5',
            suggestedQuestion: 'Question 5?',
          },
        ],
        suggestions: [],
      };

      const result = detectLowConfidenceAndGenerateFollowUps(validation, 40);

      expect(result.followUpQuestions.length).toBeLessThanOrEqual(3);
    });

    it('should include explanation with confidence and threshold', () => {
      const validation = {
        isValid: false,
        confidence: 35,
        issues: [
          {
            type: 'vague' as const,
            severity: 'critical' as const,
            message: 'Vague reference',
            suggestedQuestion: 'Be more specific?',
          },
        ],
        suggestions: [],
      };

      const result = detectLowConfidenceAndGenerateFollowUps(validation, 40);

      expect(result.explanation).toContain('35%');
      expect(result.explanation).toContain('40%');
      expect(result.explanation).toContain('Vague references');
    });

    it('should handle custom confidence thresholds', () => {
      const validation = {
        isValid: false,
        confidence: 55,
        issues: [
          {
            type: 'vague' as const,
            severity: 'critical' as const,
            message: 'Issue',
            suggestedQuestion: 'Question?',
          },
        ],
        suggestions: [],
      };

      // With threshold of 40, should trigger
      const result40 = detectLowConfidenceAndGenerateFollowUps(validation, 40);
      expect(result40.shouldAsk).toBe(false); // 55 > 40

      // With threshold of 60, should trigger
      const result60 = detectLowConfidenceAndGenerateFollowUps(validation, 60);
      expect(result60.shouldAsk).toBe(true); // 55 < 60
    });
  });

  describe('generateSmartFollowUpMessage', () => {
    it('should return empty string when no follow-ups needed', () => {
      const result: SmartFollowUpResult = {
        shouldAsk: false,
        confidence: 75,
        followUpQuestions: [],
        primaryIssue: '',
        explanation: '',
      };

      const message = generateSmartFollowUpMessage(result);

      expect(message).toBe('');
    });

    it('should format follow-up message with confidence and issue', () => {
      const result: SmartFollowUpResult = {
        shouldAsk: true,
        confidence: 35,
        followUpQuestions: [
          'Which specific person or organization?',
          'Can you give me a specific date?',
        ],
        primaryIssue: 'Vague references',
        explanation: 'Confidence is 35% (below 40% threshold). Primary issue: Vague references',
      };

      const message = generateSmartFollowUpMessage(result);

      expect(message).toContain('unclear');
      expect(message).toContain('35%');
      expect(message).toContain('Vague references');
      expect(message).toContain('Which specific person or organization?');
      expect(message).toContain('Can you give me a specific date?');
    });

    it('should number follow-up questions', () => {
      const result: SmartFollowUpResult = {
        shouldAsk: true,
        confidence: 30,
        followUpQuestions: [
          'First question?',
          'Second question?',
          'Third question?',
        ],
        primaryIssue: 'Test issue',
        explanation: 'Test',
      };

      const message = generateSmartFollowUpMessage(result);

      expect(message).toContain('1. First question?');
      expect(message).toContain('2. Second question?');
      expect(message).toContain('3. Third question?');
    });

    it('should include conversational preamble', () => {
      const result: SmartFollowUpResult = {
        shouldAsk: true,
        confidence: 25,
        followUpQuestions: ['Question?'],
        primaryIssue: 'Test',
        explanation: 'Test',
      };

      const message = generateSmartFollowUpMessage(result);

      expect(message).toContain('I want to make sure I understand this correctly');
      expect(message).toContain('Your answer is a bit unclear');
    });

    it('should handle single follow-up question', () => {
      const result: SmartFollowUpResult = {
        shouldAsk: true,
        confidence: 38,
        followUpQuestions: ['Single question?'],
        primaryIssue: 'Test issue',
        explanation: 'Test',
      };

      const message = generateSmartFollowUpMessage(result);

      expect(message).toContain('1. Single question?');
      expect(message).not.toContain('2.');
    });

    it('should preserve question formatting', () => {
      const result: SmartFollowUpResult = {
        shouldAsk: true,
        confidence: 32,
        followUpQuestions: [
          'Question with special chars: @#$%?',
          'Question with quotes: "like this"?',
        ],
        primaryIssue: 'Test',
        explanation: 'Test',
      };

      const message = generateSmartFollowUpMessage(result);

      expect(message).toContain('@#$%');
      expect(message).toContain('like this');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle vague people reference', () => {
      const validation = {
        isValid: false,
        confidence: 32,
        issues: [
          {
            type: 'vague' as const,
            severity: 'critical' as const,
            message: '"the client" is too vague',
            suggestedQuestion: 'Which specific person or organization?',
          },
        ],
        suggestions: [],
      };

      const followUpResult = detectLowConfidenceAndGenerateFollowUps(validation, 40);
      const message = generateSmartFollowUpMessage(followUpResult);

      expect(followUpResult.shouldAsk).toBe(true);
      expect(message).toContain('unclear');
      expect(message).toContain('Vague references');
    });

    it('should handle action-focused goal', () => {
      const validation = {
        isValid: false,
        confidence: 38,
        issues: [
          {
            type: 'action_not_outcome' as const,
            severity: 'warning' as const,
            message: 'This sounds like an action, not an outcome',
            suggestedQuestion: 'What do you want to ACHIEVE by doing that?',
          },
        ],
        suggestions: [],
      };

      const followUpResult = detectLowConfidenceAndGenerateFollowUps(validation, 40);
      const message = generateSmartFollowUpMessage(followUpResult);

      expect(followUpResult.shouldAsk).toBe(true);
      expect(followUpResult.primaryIssue).toBe('Action-focused instead of outcome-focused');
      expect(message).toContain('ACHIEVE');
    });

    it('should handle multiple issue types with priority', () => {
      const validation = {
        isValid: false,
        confidence: 28,
        issues: [
          {
            type: 'vague' as const,
            severity: 'critical' as const,
            message: 'Vague reference',
            suggestedQuestion: 'Be specific about who?',
          },
          {
            type: 'action_not_outcome' as const,
            severity: 'warning' as const,
            message: 'Action-focused',
            suggestedQuestion: 'What outcome do you want?',
          },
          {
            type: 'unmeasurable' as const,
            severity: 'warning' as const,
            message: 'Unmeasurable',
            suggestedQuestion: 'How will you measure success?',
          },
        ],
        suggestions: [],
      };

      const followUpResult = detectLowConfidenceAndGenerateFollowUps(validation, 40);

      // Should prioritize vague issues first
      expect(followUpResult.primaryIssue).toBe('Vague references');
      expect(followUpResult.followUpQuestions[0]).toContain('specific about who');
    });
  });
});
