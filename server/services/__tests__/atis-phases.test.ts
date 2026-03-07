import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as atisDb from '../../db/atis-phases';
import {
  analyzePhase3Decomposition,
  analyzePhase4RiskAssessment,
  analyzePhase5ResourceEstimation,
  analyzePhase6TimelineOptimization,
  analyzePhase7QAStrategy,
  analyzePhase8Documentation,
  analyzePhase9Dependencies,
  analyzePhase10Finalization,
} from '../atis-phases-service';

// Mock the database functions
vi.mock('../../db/atis-phases', () => ({
  createSubtask: vi.fn(async () => 'subtask-1'),
  getSubtasks: vi.fn(async () => []),
  createSubtaskDependency: vi.fn(async () => 'dep-1'),
  getSubtaskDependencies: vi.fn(async () => []),
  createCriticalPathAnalysis: vi.fn(async () => 'cpa-1'),
  getCriticalPathAnalysis: vi.fn(async () => []),
  createRisk: vi.fn(async () => 'risk-1'),
  getRisks: vi.fn(async () => []),
  createRiskMitigation: vi.fn(async () => 'mit-1'),
  getRiskMitigations: vi.fn(async () => []),
  createResourceRequirement: vi.fn(async () => 'res-1'),
  getResourceRequirements: vi.fn(async () => []),
  createTimeline: vi.fn(async () => 'timeline-1'),
  getTimeline: vi.fn(async () => []),
  createMilestone: vi.fn(async () => 'milestone-1'),
  getMilestones: vi.fn(async () => []),
  createQAStrategy: vi.fn(async () => 'qa-1'),
  getQAStrategy: vi.fn(async () => []),
  createDocumentationRequirement: vi.fn(async () => 'doc-1'),
  getDocumentationRequirements: vi.fn(async () => []),
  createExternalDependency: vi.fn(async () => 'dep-ext-1'),
  getExternalDependencies: vi.fn(async () => []),
  createExecutionPlan: vi.fn(async () => 'exec-1'),
  getExecutionPlan: vi.fn(async () => []),
  createAnalysisSession: vi.fn(async () => 'session-1'),
  getAnalysisSession: vi.fn(async () => []),
  getAnalysisSessionByTask: vi.fn(async () => []),
  updateAnalysisSession: vi.fn(async () => {}),
  getAllAnalysisData: vi.fn(async () => ({})),
}));

// Mock the LLM
vi.mock('../../_core/llm', () => ({
  invokeLLM: vi.fn(async (config: any) => {
    // Return mock responses based on the system message
    const systemMessage = config.messages[0].content;
    
    if (systemMessage.includes('decomposition')) {
      return {
        choices: [{
          message: {
            content: JSON.stringify({
              subtasks: [
                { title: 'Subtask 1', description: 'Description 1', estimatedHours: 2, sequence: 0 },
                { title: 'Subtask 2', description: 'Description 2', estimatedHours: 3, sequence: 1 },
              ],
              dependencies: [
                { subtaskIndex: 1, dependsOnIndex: 0, type: 'sequential' },
              ],
              criticalPath: [0, 1],
              totalDurationHours: 5,
              parallelizationOpportunities: 0,
              analysis: 'Task decomposed into 2 subtasks',
            }),
          },
        }],
      };
    }
    
    if (systemMessage.includes('risk')) {
      return {
        choices: [{
          message: {
            content: JSON.stringify({
              risks: [
                {
                  title: 'Technical Risk',
                  description: 'Potential technical issues',
                  category: 'technical',
                  probability: 5,
                  impact: 7,
                  mitigations: [
                    { strategy: 'Use proven technologies', effort: 'low', owner: 'Tech Lead' },
                  ],
                },
              ],
              summary: 'Identified 1 technical risk',
            }),
          },
        }],
      };
    }
    
    if (systemMessage.includes('resource')) {
      return {
        choices: [{
          message: {
            content: JSON.stringify({
              skills: [
                { name: 'Project Management', proficiencyLevel: 'expert', estimatedCost: 0 },
              ],
              tools: [
                { name: 'Jira', estimatedCost: 100 },
              ],
              training: [
                { topic: 'Agile Methodology', estimatedCost: 500 },
              ],
              summary: 'Identified required skills, tools, and training',
            }),
          },
        }],
      };
    }
    
    if (systemMessage.includes('timeline')) {
      return {
        choices: [{
          message: {
            content: JSON.stringify({
              startDate: '2026-03-15',
              endDate: '2026-04-15',
              bufferDays: 5,
              totalDays: 32,
              milestones: [
                { name: 'Phase 1 Complete', dueDate: '2026-03-25', description: 'First phase completion' },
              ],
              optimization: 'Timeline optimized with 20% buffer',
            }),
          },
        }],
      };
    }
    
    if (systemMessage.includes('QA')) {
      return {
        choices: [{
          message: {
            content: JSON.stringify({
              strategy: 'Comprehensive QA strategy with multiple testing phases',
              testingPhases: [
                { name: 'Unit Testing', description: 'Test individual components', duration: '1 week' },
              ],
              qualityMetrics: [
                { metric: 'Code Coverage', target: '80%', measurement: 'SonarQube' },
              ],
              acceptanceCriteria: [
                { criterion: 'All tests pass', description: 'All unit and integration tests must pass' },
              ],
            }),
          },
        }],
      };
    }
    
    if (systemMessage.includes('documentation')) {
      return {
        choices: [{
          message: {
            content: JSON.stringify({
              documentationTypes: [
                {
                  type: 'user_guide',
                  audience: 'end_users',
                  estimatedEffort: 20,
                  outline: ['Introduction', 'Getting Started', 'Advanced Features'],
                },
              ],
              summary: 'Documentation requirements identified',
            }),
          },
        }],
      };
    }
    
    if (systemMessage.includes('dependencies')) {
      return {
        choices: [{
          message: {
            content: JSON.stringify({
              dependencies: [
                {
                  type: 'approval',
                  description: 'Stakeholder approval required',
                  owner: 'Project Manager',
                  dueDate: '2026-03-10',
                  impact: 'Project cannot start without approval',
                },
              ],
              summary: 'External dependencies identified',
            }),
          },
        }],
      };
    }
    
    if (systemMessage.includes('execution')) {
      return {
        choices: [{
          message: {
            content: JSON.stringify({
              roadmap: [
                { step: 1, title: 'Planning', description: 'Plan the project', duration: '1 week', owner: 'PM' },
              ],
              successMetrics: [
                { metric: 'On-time delivery', target: '100%', measurement: 'Actual vs planned dates' },
              ],
              communicationPlan: 'Weekly status updates',
              escalationPath: [
                { level: 1, trigger: 'Delay > 2 days', owner: 'Team Lead' },
              ],
              preExecutionChecklist: [
                { item: 'Resources allocated', owner: 'HR' },
              ],
              confidenceScore: 85,
              summary: 'Execution plan created with 85% confidence',
            }),
          },
        }],
      };
    }
    
    // Default response
    return {
      choices: [{
        message: {
          content: JSON.stringify({ success: true }),
        },
      }],
    };
  }),
}));

describe('ATIS Phases 3-10 Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Phase 3: Task Decomposition', () => {
    it('should analyze and decompose a task', async () => {
      const result = await analyzePhase3Decomposition(
        'task-1',
        'user-1',
        'Create a web application with user authentication'
      );

      expect(result.success).toBe(true);
      expect(result.phase).toBe(3);
      expect(result.data).toBeDefined();
      expect(result.data.subtasks).toHaveLength(2);
      expect(result.data.totalDurationHours).toBe(5);
    });

    it('should create subtasks in the database', async () => {
      await analyzePhase3Decomposition(
        'task-1',
        'user-1',
        'Create a web application'
      );

      expect(atisDb.createSubtask).toHaveBeenCalled();
    });
  });

  describe('Phase 4: Risk Assessment', () => {
    it('should identify and assess risks', async () => {
      const result = await analyzePhase4RiskAssessment(
        'task-1',
        'user-1',
        'Implement complex feature'
      );

      expect(result.success).toBe(true);
      expect(result.phase).toBe(4);
      expect(result.data.risks).toHaveLength(1);
      expect(result.data.risks[0].category).toBe('technical');
    });

    it('should create risks and mitigations in the database', async () => {
      await analyzePhase4RiskAssessment(
        'task-1',
        'user-1',
        'Implement complex feature'
      );

      expect(atisDb.createRisk).toHaveBeenCalled();
      expect(atisDb.createRiskMitigation).toHaveBeenCalled();
    });
  });

  describe('Phase 5: Resource Estimation', () => {
    it('should estimate required resources', async () => {
      const result = await analyzePhase5ResourceEstimation(
        'task-1',
        'user-1',
        'Build mobile app'
      );

      expect(result.success).toBe(true);
      expect(result.phase).toBe(5);
      expect(result.data.skills).toBeDefined();
      expect(result.data.tools).toBeDefined();
      expect(result.data.training).toBeDefined();
    });

    it('should create resource requirements in the database', async () => {
      await analyzePhase5ResourceEstimation(
        'task-1',
        'user-1',
        'Build mobile app'
      );

      expect(atisDb.createResourceRequirement).toHaveBeenCalled();
    });
  });

  describe('Phase 6: Timeline Optimization', () => {
    it('should create optimized timeline', async () => {
      const result = await analyzePhase6TimelineOptimization(
        'task-1',
        'user-1',
        'Launch product'
      );

      expect(result.success).toBe(true);
      expect(result.phase).toBe(6);
      expect(result.data.startDate).toBeDefined();
      expect(result.data.endDate).toBeDefined();
      expect(result.data.totalDays).toBe(32);
    });

    it('should create timeline and milestones in the database', async () => {
      await analyzePhase6TimelineOptimization(
        'task-1',
        'user-1',
        'Launch product'
      );

      expect(atisDb.createTimeline).toHaveBeenCalled();
      expect(atisDb.createMilestone).toHaveBeenCalled();
    });
  });

  describe('Phase 7: QA Strategy', () => {
    it('should define QA strategy', async () => {
      const result = await analyzePhase7QAStrategy(
        'task-1',
        'user-1',
        'Develop software'
      );

      expect(result.success).toBe(true);
      expect(result.phase).toBe(7);
      expect(result.data.strategy).toBeDefined();
      expect(result.data.testingPhases).toBeDefined();
      expect(result.data.qualityMetrics).toBeDefined();
    });

    it('should create QA strategy in the database', async () => {
      await analyzePhase7QAStrategy(
        'task-1',
        'user-1',
        'Develop software'
      );

      expect(atisDb.createQAStrategy).toHaveBeenCalled();
    });
  });

  describe('Phase 8: Documentation Requirements', () => {
    it('should identify documentation needs', async () => {
      const result = await analyzePhase8Documentation(
        'task-1',
        'user-1',
        'Create API'
      );

      expect(result.success).toBe(true);
      expect(result.phase).toBe(8);
      expect(result.data.documentationTypes).toBeDefined();
    });

    it('should create documentation requirements in the database', async () => {
      await analyzePhase8Documentation(
        'task-1',
        'user-1',
        'Create API'
      );

      expect(atisDb.createDocumentationRequirement).toHaveBeenCalled();
    });
  });

  describe('Phase 9: External Dependencies', () => {
    it('should identify external dependencies', async () => {
      const result = await analyzePhase9Dependencies(
        'task-1',
        'user-1',
        'Integrate third-party service'
      );

      expect(result.success).toBe(true);
      expect(result.phase).toBe(9);
      expect(result.data.dependencies).toBeDefined();
    });

    it('should create external dependencies in the database', async () => {
      await analyzePhase9Dependencies(
        'task-1',
        'user-1',
        'Integrate third-party service'
      );

      expect(atisDb.createExternalDependency).toHaveBeenCalled();
    });
  });

  describe('Phase 10: Finalization & Execution Plan', () => {
    it('should create comprehensive execution plan', async () => {
      const result = await analyzePhase10Finalization(
        'task-1',
        'user-1',
        'Execute project'
      );

      expect(result.success).toBe(true);
      expect(result.phase).toBe(10);
      expect(result.data.roadmap).toBeDefined();
      expect(result.data.successMetrics).toBeDefined();
      expect(result.data.confidenceScore).toBe(85);
    });

    it('should create execution plan in the database', async () => {
      await analyzePhase10Finalization(
        'task-1',
        'user-1',
        'Execute project'
      );

      expect(atisDb.createExecutionPlan).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully in Phase 3', async () => {
      vi.mocked(atisDb.createSubtask).mockRejectedValueOnce(new Error('DB Error'));

      try {
        await analyzePhase3Decomposition('task-1', 'user-1', 'Task');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle errors gracefully in Phase 4', async () => {
      vi.mocked(atisDb.createRisk).mockRejectedValueOnce(new Error('DB Error'));

      try {
        await analyzePhase4RiskAssessment('task-1', 'user-1', 'Task');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
