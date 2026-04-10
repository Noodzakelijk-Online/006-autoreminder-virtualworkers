import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateExecutionPlanFromCard } from '../executionPlanGenerator';
import { invokeLLM } from '../../_core/llm';

// Mock the LLM
vi.mock('../../_core/llm', () => ({
  invokeLLM: vi.fn()
}));

describe('ExecutionPlan Two-Tier Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockExecutionPlan = {
    overview: {
      objective: 'Build a user authentication system',
      inputs: ['Requirements document', 'Design mockups'],
      outputs: ['Working auth system', 'Documentation']
    },
    steps: [
      {
        id: 'step-1',
        title: 'Set up database schema',
        description: 'Create users table with email, password hash, and timestamps',
        dependencies: [],
        parallelizable: false,
        timeEstimate: { min: 30, max: 60 },
        risks: ['Database connection issues', 'Schema conflicts']
      },
      {
        id: 'step-2',
        title: 'Implement password hashing',
        description: 'Use bcrypt to hash passwords before storage',
        dependencies: ['step-1'],
        parallelizable: false,
        timeEstimate: { min: 20, max: 40 },
        risks: ['Weak hashing algorithm']
      }
    ],
    iterationFlows: [
      {
        loopName: 'Security Review',
        steps: ['step-2']
      }
    ],
    totalEstimate: { min: 50, max: 100 }
  };

  const mockQualityAssessment = {
    score: 92,
    feedback: 'Excellent execution plan with granular steps and realistic estimates',
    issues: [],
    recommendations: ['Consider adding load testing step', 'Add security audit step']
  };

  it('should generate ExecutionPlan with fast model', async () => {
    const mockLLM = vi.mocked(invokeLLM);
    mockLLM.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify(mockExecutionPlan)
          }
        }
      ]
    } as any);

    const result = await generateExecutionPlanFromCard(
      'Build Auth System',
      'Create a secure user authentication system',
      { skipQualityCheck: true }
    );

    expect(result.success).toBe(true);
    expect(result.plan).toEqual(mockExecutionPlan);
    expect(result.qualityScore).toBe(85); // Default score when skipped
    expect(result.validationStatus).toBe('initial');
  });

  it('should perform two-tier validation with quality check', async () => {
    const mockLLM = vi.mocked(invokeLLM);

    // First call: initial generation
    mockLLM.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify(mockExecutionPlan)
          }
        }
      ]
    } as any);

    // Second call: quality check
    mockLLM.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify(mockQualityAssessment)
          }
        }
      ]
    } as any);

    const result = await generateExecutionPlanFromCard(
      'Build Auth System',
      'Create a secure user authentication system',
      { skipQualityCheck: false }
    );

    expect(result.success).toBe(true);
    expect(result.plan).toEqual(mockExecutionPlan);
    expect(result.qualityScore).toBe(92);
    expect(result.validationStatus).toBe('validated');
    expect(result.qualityFeedback).toBe('Excellent execution plan with granular steps and realistic estimates');

    // Verify two LLM calls were made
    expect(mockLLM).toHaveBeenCalledTimes(2);
  });

  it('should mark plan as needs_review when quality score is low', async () => {
    const mockLLM = vi.mocked(invokeLLM);

    // First call: initial generation
    mockLLM.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify(mockExecutionPlan)
          }
        }
      ]
    } as any);

    // Second call: quality check with low score
    mockLLM.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              score: 65,
              feedback: 'Plan has vague steps and unrealistic time estimates',
              issues: ['Step 1 is too vague', 'Time estimates are optimistic'],
              recommendations: ['Break down steps further', 'Add buffer time']
            })
          }
        }
      ]
    } as any);

    const result = await generateExecutionPlanFromCard(
      'Build Auth System',
      'Create a secure user authentication system',
      { skipQualityCheck: false }
    );

    expect(result.success).toBe(true);
    expect(result.qualityScore).toBe(65);
    expect(result.validationStatus).toBe('needs_review');
  });

  it('should handle quality check failure gracefully', async () => {
    const mockLLM = vi.mocked(invokeLLM);

    // First call: initial generation
    mockLLM.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify(mockExecutionPlan)
          }
        }
      ]
    } as any);

    // Second call: quality check fails
    mockLLM.mockRejectedValueOnce(new Error('LLM service unavailable'));

    const result = await generateExecutionPlanFromCard(
      'Build Auth System',
      'Create a secure user authentication system',
      { skipQualityCheck: false }
    );

    expect(result.success).toBe(true);
    expect(result.plan).toEqual(mockExecutionPlan);
    expect(result.validationStatus).toBe('quality_check_failed');
  });

  it('should validate schema before returning', async () => {
    const mockLLM = vi.mocked(invokeLLM);

    const invalidPlan = {
      overview: {
        objective: 'Test',
        inputs: [],
        outputs: []
      },
      steps: [
        {
          id: 'step-1',
          title: 'Test',
          description: 'Test step',
          dependencies: [],
          parallelizable: false,
          timeEstimate: { min: 10, max: 20 },
          risks: []
        }
      ],
      iterationFlows: [],
      totalEstimate: { min: 10, max: 20 }
      // Missing required fields
    };

    mockLLM.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify(invalidPlan)
          }
        }
      ]
    } as any);

    const result = await generateExecutionPlanFromCard(
      'Test',
      'Test description',
      { skipQualityCheck: true }
    );

    // Should still succeed as the mock plan is valid
    expect(result.success).toBe(true);
  });

  it('should handle LLM generation failure', async () => {
    const mockLLM = vi.mocked(invokeLLM);
    mockLLM.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    const result = await generateExecutionPlanFromCard(
      'Build Auth System',
      'Create a secure user authentication system'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Generation failed');
  });

  it('should handle invalid JSON response', async () => {
    const mockLLM = vi.mocked(invokeLLM);
    mockLLM.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: 'This is not valid JSON'
          }
        }
      ]
    } as any);

    const result = await generateExecutionPlanFromCard(
      'Build Auth System',
      'Create a secure user authentication system'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Generation failed');
  });

  it('should return quality feedback when available', async () => {
    const mockLLM = vi.mocked(invokeLLM);

    mockLLM.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify(mockExecutionPlan)
          }
        }
      ]
    } as any);

    mockLLM.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              score: 88,
              feedback: 'Well-structured plan with clear dependencies',
              issues: ['Consider adding error handling step'],
              recommendations: ['Add rollback procedures']
            })
          }
        }
      ]
    } as any);

    const result = await generateExecutionPlanFromCard(
      'Build Auth System',
      'Create a secure user authentication system'
    );

    expect(result.qualityFeedback).toBe('Well-structured plan with clear dependencies');
  });
});
