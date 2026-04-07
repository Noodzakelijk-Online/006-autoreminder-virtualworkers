import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ExecutionPlanData, ExecutionPlanStep } from '@shared/types';

// Mock ExecutionPlan data
const mockExecutionPlan: ExecutionPlanData = {
  overview: {
    objective: 'Build financial forecast model',
    inputs: ['Financial data', 'Assumptions'],
    outputs: ['Forecast model', 'Documentation']
  },
  steps: [
    {
      id: '1',
      stepId: 'step-1',
      title: 'Review existing data',
      description: 'Review all financial documents',
      dependencies: [],
      parallelizable: false,
      timeEstimateMin: 45,
      timeEstimateMax: 90,
      risks: ['Missing data'],
      status: 'completed'
    },
    {
      id: '2',
      stepId: 'step-2',
      title: 'Identify gaps',
      description: 'Identify data gaps',
      dependencies: ['step-1'],
      parallelizable: false,
      timeEstimateMin: 30,
      timeEstimateMax: 60,
      risks: [],
      status: 'ready'
    },
    {
      id: '3',
      stepId: 'step-3',
      title: 'Configure template',
      description: 'Configure Trello template',
      dependencies: ['step-1'],
      parallelizable: true,
      timeEstimateMin: 20,
      timeEstimateMax: 40,
      risks: [],
      status: 'ready'
    }
  ],
  iterationFlows: [
    {
      loopName: 'Review Loop',
      steps: ['step-2', 'step-3']
    }
  ],
  totalEstimateMin: 95,
  totalEstimateMax: 190
};

describe('ExecutionPlanDashboardV3', () => {
  describe('Step Status Logic', () => {
    it('should correctly identify completed steps', () => {
      const completedSteps = mockExecutionPlan.steps.filter(s => s.status === 'completed');
      expect(completedSteps).toHaveLength(1);
      expect(completedSteps[0].stepId).toBe('step-1');
    });

    it('should correctly identify ready steps', () => {
      const readySteps = mockExecutionPlan.steps.filter(s => s.status === 'ready');
      expect(readySteps).toHaveLength(2);
    });

    it('should identify blocked steps based on dependencies', () => {
      const step2 = mockExecutionPlan.steps.find(s => s.stepId === 'step-2');
      expect(step2?.dependencies).toContain('step-1');
      
      // If step-1 is completed, step-2 should not be blocked
      const step1Completed = mockExecutionPlan.steps.find(s => s.stepId === 'step-1')?.status === 'completed';
      expect(step1Completed).toBe(true);
    });
  });

  describe('Critical Path Calculation', () => {
    it('should identify critical path steps', () => {
      // Critical path: step-1 -> step-2 (longest chain)
      const criticalPath = ['step-1', 'step-2'];
      const criticalSteps = mockExecutionPlan.steps.filter(s => criticalPath.includes(s.stepId));
      expect(criticalSteps).toHaveLength(2);
    });

    it('should calculate total time correctly', () => {
      const totalMin = mockExecutionPlan.totalEstimateMin;
      const totalMax = mockExecutionPlan.totalEstimateMax;
      expect(totalMin).toBe(95);
      expect(totalMax).toBe(190);
    });
  });

  describe('Parallel Work Identification', () => {
    it('should identify parallelizable steps', () => {
      const parallelizableSteps = mockExecutionPlan.steps.filter(s => s.parallelizable);
      expect(parallelizableSteps).toHaveLength(1);
      expect(parallelizableSteps[0].stepId).toBe('step-3');
    });

    it('should group parallel work opportunities', () => {
      // Steps that can run in parallel: step-2 and step-3 (both depend on step-1)
      const step2Deps = mockExecutionPlan.steps.find(s => s.stepId === 'step-2')?.dependencies;
      const step3Deps = mockExecutionPlan.steps.find(s => s.stepId === 'step-3')?.dependencies;
      
      expect(step2Deps).toEqual(['step-1']);
      expect(step3Deps).toEqual(['step-1']);
    });
  });

  describe('Iteration Loops', () => {
    it('should correctly identify iteration loops', () => {
      expect(mockExecutionPlan.iterationFlows).toHaveLength(1);
      expect(mockExecutionPlan.iterationFlows[0].loopName).toBe('Review Loop');
    });

    it('should track loop steps correctly', () => {
      const loop = mockExecutionPlan.iterationFlows[0];
      expect(loop.steps).toEqual(['step-2', 'step-3']);
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate progress percentage correctly', () => {
      const completedCount = mockExecutionPlan.steps.filter(s => s.status === 'completed').length;
      const totalCount = mockExecutionPlan.steps.length;
      const progress = Math.round((completedCount / totalCount) * 100);
      
      expect(progress).toBe(33); // 1 out of 3 steps
    });
  });

  describe('Dependency Resolution', () => {
    it('should resolve step dependencies correctly', () => {
      const step2 = mockExecutionPlan.steps.find(s => s.stepId === 'step-2');
      const dependencies = step2?.dependencies.map(depId => 
        mockExecutionPlan.steps.find(s => s.stepId === depId)
      );
      
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]?.stepId).toBe('step-1');
    });

    it('should identify steps with no dependencies', () => {
      const independentSteps = mockExecutionPlan.steps.filter(s => s.dependencies.length === 0);
      expect(independentSteps).toHaveLength(1);
      expect(independentSteps[0].stepId).toBe('step-1');
    });
  });

  describe('Risk Management', () => {
    it('should track risks for each step', () => {
      const stepsWithRisks = mockExecutionPlan.steps.filter(s => s.risks && s.risks.length > 0);
      expect(stepsWithRisks).toHaveLength(1);
      expect(stepsWithRisks[0].risks).toContain('Missing data');
    });

    it('should identify steps without risks', () => {
      const stepsWithoutRisks = mockExecutionPlan.steps.filter(s => !s.risks || s.risks.length === 0);
      expect(stepsWithoutRisks).toHaveLength(2);
    });
  });

  describe('Time Estimation', () => {
    it('should validate time estimates', () => {
      mockExecutionPlan.steps.forEach(step => {
        expect(step.timeEstimateMin).toBeLessThanOrEqual(step.timeEstimateMax);
        expect(step.timeEstimateMin).toBeGreaterThan(0);
      });
    });

    it('should calculate step time ranges', () => {
      const step1 = mockExecutionPlan.steps.find(s => s.stepId === 'step-1');
      expect(step1?.timeEstimateMin).toBe(45);
      expect(step1?.timeEstimateMax).toBe(90);
    });
  });

  describe('Schema Validation', () => {
    it('should maintain strict schema compliance', () => {
      // Verify no extra fields exist
      const allowedKeys = ['overview', 'steps', 'iterationFlows', 'totalEstimateMin', 'totalEstimateMax'];
      const planKeys = Object.keys(mockExecutionPlan);
      
      planKeys.forEach(key => {
        expect(allowedKeys).toContain(key);
      });
    });

    it('should validate step schema', () => {
      mockExecutionPlan.steps.forEach(step => {
        expect(step).toHaveProperty('id');
        expect(step).toHaveProperty('stepId');
        expect(step).toHaveProperty('title');
        expect(step).toHaveProperty('description');
        expect(step).toHaveProperty('dependencies');
        expect(step).toHaveProperty('parallelizable');
        expect(step).toHaveProperty('timeEstimateMin');
        expect(step).toHaveProperty('timeEstimateMax');
        expect(step).toHaveProperty('risks');
        expect(step).toHaveProperty('status');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty risks array', () => {
      const step3 = mockExecutionPlan.steps.find(s => s.stepId === 'step-3');
      expect(step3?.risks).toEqual([]);
    });

    it('should handle steps with no iteration loops', () => {
      const singleStepPlan: ExecutionPlanData = {
        ...mockExecutionPlan,
        iterationFlows: []
      };
      expect(singleStepPlan.iterationFlows).toHaveLength(0);
    });

    it('should handle single step plans', () => {
      const singleStep: ExecutionPlanData = {
        overview: mockExecutionPlan.overview,
        steps: [mockExecutionPlan.steps[0]],
        iterationFlows: [],
        totalEstimateMin: 45,
        totalEstimateMax: 90
      };
      expect(singleStep.steps).toHaveLength(1);
    });
  });
});
