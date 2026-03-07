/**
 * ATIS Phases 3-10 Service
 * Advanced task analysis using LLM for decomposition, risk assessment, resource estimation, etc.
 */

import { invokeLLM } from '../_core/llm';
import * as atisDb from '../db/atis-phases';

/**
 * Phase 3: Task Decomposition
 * Breaks down complex tasks into manageable subtasks with dependencies
 */
export async function analyzePhase3Decomposition(taskId: string, userId: string, taskDescription: string) {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `You are an expert task decomposition specialist. Analyze the given task and break it down into manageable subtasks.
          
Return a JSON object with this structure:
{
  "subtasks": [
    {
      "title": "Subtask title",
      "description": "Detailed description",
      "estimatedHours": number,
      "sequence": number
    }
  ],
  "dependencies": [
    {
      "subtaskIndex": number,
      "dependsOnIndex": number,
      "type": "sequential|parallel|blocking"
    }
  ],
  "criticalPath": [number],
  "totalDurationHours": number,
  "parallelizationOpportunities": number,
  "analysis": "Brief analysis of the decomposition"
}`,
        },
        {
          role: 'user',
          content: `Analyze and decompose this task:\n\n${taskDescription}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'task_decomposition',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              subtasks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    estimatedHours: { type: 'number' },
                    sequence: { type: 'number' },
                  },
                  required: ['title', 'description', 'estimatedHours', 'sequence'],
                },
              },
              dependencies: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    subtaskIndex: { type: 'number' },
                    dependsOnIndex: { type: 'number' },
                    type: { type: 'string', enum: ['sequential', 'parallel', 'blocking'] },
                  },
                },
              },
              criticalPath: { type: 'array', items: { type: 'number' } },
              totalDurationHours: { type: 'number' },
              parallelizationOpportunities: { type: 'number' },
              analysis: { type: 'string' },
            },
            required: ['subtasks', 'dependencies', 'criticalPath', 'totalDurationHours', 'analysis'],
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    const analysisData = typeof content === 'string' ? JSON.parse(content) : content;

    // Store subtasks
    const subtaskMap: Record<number, string> = {};
    for (const subtask of analysisData.subtasks) {
      const id = await atisDb.createSubtask(taskId, userId, subtask);
      subtaskMap[subtask.sequence] = id;
    }

    // Store dependencies
    for (const dep of analysisData.dependencies) {
      const subtaskId = subtaskMap[dep.subtaskIndex];
      const dependsOnId = subtaskMap[dep.dependsOnIndex];
      if (subtaskId && dependsOnId) {
        await atisDb.createSubtaskDependency(subtaskId, dependsOnId, dep.type);
      }
    }

    // Store critical path analysis
    await atisDb.createCriticalPathAnalysis(taskId, userId, {
      criticalPath: analysisData.criticalPath.map((idx: number) => subtaskMap[idx]),
      totalDurationHours: analysisData.totalDurationHours,
      parallelizationOpportunities: analysisData.parallelizationOpportunities,
      analysisData: analysisData.analysis,
    });

    return {
      success: true,
      phase: 3,
      data: analysisData,
    };
  } catch (error) {
    console.error('[ATIS Phase 3] Error:', error);
    throw error;
  }
}

/**
 * Phase 4: Risk Assessment
 * Identifies and evaluates potential risks
 */
export async function analyzePhase4RiskAssessment(taskId: string, userId: string, taskDescription: string) {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `You are a risk management expert. Analyze the given task and identify potential risks.
          
Return a JSON object with this structure:
{
  "risks": [
    {
      "title": "Risk title",
      "description": "Detailed description",
      "category": "technical|resource|schedule|external",
      "probability": 1-10,
      "impact": 1-10,
      "mitigations": [
        {
          "strategy": "Mitigation strategy",
          "effort": "low|medium|high",
          "owner": "Responsible party"
        }
      ]
    }
  ],
  "summary": "Overall risk assessment summary"
}`,
        },
        {
          role: 'user',
          content: `Assess risks for this task:\n\n${taskDescription}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'risk_assessment',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              risks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    category: { type: 'string', enum: ['technical', 'resource', 'schedule', 'external'] },
                    probability: { type: 'number', minimum: 1, maximum: 10 },
                    impact: { type: 'number', minimum: 1, maximum: 10 },
                    mitigations: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          strategy: { type: 'string' },
                          effort: { type: 'string', enum: ['low', 'medium', 'high'] },
                          owner: { type: 'string' },
                        },
                      },
                    },
                  },
                  required: ['title', 'description', 'category', 'probability', 'impact'],
                },
              },
              summary: { type: 'string' },
            },
            required: ['risks', 'summary'],
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    const analysisData = typeof content === 'string' ? JSON.parse(content) : content;

    // Store risks and mitigations
    for (const risk of analysisData.risks) {
      const riskId = await atisDb.createRisk(taskId, userId, risk);
      
      for (const mitigation of (risk.mitigations || [])) {
        await atisDb.createRiskMitigation(riskId, mitigation);
      }
    }

    return {
      success: true,
      phase: 4,
      data: analysisData,
    };
  } catch (error) {
    console.error('[ATIS Phase 4] Error:', error);
    throw error;
  }
}

/**
 * Phase 5: Resource Estimation
 * Identifies required resources and skills
 */
export async function analyzePhase5ResourceEstimation(taskId: string, userId: string, taskDescription: string) {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `You are a resource planning expert. Analyze the given task and identify required resources and skills.
          
Return a JSON object with this structure:
{
  "skills": [
    {
      "name": "Skill name",
      "proficiencyLevel": "beginner|intermediate|expert",
      "estimatedCost": number
    }
  ],
  "tools": [
    {
      "name": "Tool/software name",
      "estimatedCost": number
    }
  ],
  "training": [
    {
      "topic": "Training topic",
      "estimatedCost": number
    }
  ],
  "summary": "Resource estimation summary"
}`,
        },
        {
          role: 'user',
          content: `Estimate resources needed for this task:\n\n${taskDescription}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'resource_estimation',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              skills: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    proficiencyLevel: { type: 'string', enum: ['beginner', 'intermediate', 'expert'] },
                    estimatedCost: { type: 'number' },
                  },
                },
              },
              tools: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    estimatedCost: { type: 'number' },
                  },
                },
              },
              training: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    topic: { type: 'string' },
                    estimatedCost: { type: 'number' },
                  },
                },
              },
              summary: { type: 'string' },
            },
            required: ['skills', 'tools', 'training', 'summary'],
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    const analysisData = typeof content === 'string' ? JSON.parse(content) : content;

    // Store resources
    for (const skill of analysisData.skills) {
      await atisDb.createResourceRequirement(taskId, userId, {
        resourceType: 'skill',
        resourceName: skill.name,
        proficiencyLevel: skill.proficiencyLevel,
        estimatedCost: skill.estimatedCost,
      });
    }

    for (const tool of analysisData.tools) {
      await atisDb.createResourceRequirement(taskId, userId, {
        resourceType: 'tool',
        resourceName: tool.name,
        estimatedCost: tool.estimatedCost,
      });
    }

    for (const training of analysisData.training) {
      await atisDb.createResourceRequirement(taskId, userId, {
        resourceType: 'training',
        resourceName: training.topic,
        estimatedCost: training.estimatedCost,
      });
    }

    return {
      success: true,
      phase: 5,
      data: analysisData,
    };
  } catch (error) {
    console.error('[ATIS Phase 5] Error:', error);
    throw error;
  }
}

/**
 * Phase 6: Timeline Optimization
 * Creates optimal schedule with buffers
 */
export async function analyzePhase6TimelineOptimization(taskId: string, userId: string, taskDescription: string) {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `You are a project scheduling expert. Analyze the given task and create an optimized timeline.
          
Return a JSON object with this structure:
{
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "bufferDays": number,
  "totalDays": number,
  "milestones": [
    {
      "name": "Milestone name",
      "dueDate": "YYYY-MM-DD",
      "description": "Milestone description"
    }
  ],
  "optimization": "Timeline optimization details"
}`,
        },
        {
          role: 'user',
          content: `Create an optimized timeline for this task:\n\n${taskDescription}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'timeline_optimization',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              endDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              bufferDays: { type: 'number' },
              totalDays: { type: 'number' },
              milestones: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    dueDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
                    description: { type: 'string' },
                  },
                },
              },
              optimization: { type: 'string' },
            },
            required: ['startDate', 'endDate', 'bufferDays', 'totalDays', 'milestones', 'optimization'],
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    const analysisData = typeof content === 'string' ? JSON.parse(content) : content;

    // Store timeline
    await atisDb.createTimeline(taskId, userId, {
      startDate: analysisData.startDate,
      endDate: analysisData.endDate,
      bufferDays: analysisData.bufferDays,
      totalDays: analysisData.totalDays,
      optimizationData: analysisData.optimization,
    });

    // Store milestones
    for (const milestone of analysisData.milestones) {
      await atisDb.createMilestone(taskId, milestone);
    }

    return {
      success: true,
      phase: 6,
      data: analysisData,
    };
  } catch (error) {
    console.error('[ATIS Phase 6] Error:', error);
    throw error;
  }
}

/**
 * Phase 7: QA Strategy
 * Defines QA approach and testing strategy
 */
export async function analyzePhase7QAStrategy(taskId: string, userId: string, taskDescription: string) {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `You are a QA expert. Analyze the given task and define a comprehensive QA strategy.
          
Return a JSON object with this structure:
{
  "strategy": "Overall QA strategy",
  "testingPhases": [
    {
      "name": "Phase name",
      "description": "Phase description",
      "duration": "Estimated duration"
    }
  ],
  "qualityMetrics": [
    {
      "metric": "Metric name",
      "target": "Target value",
      "measurement": "How to measure"
    }
  ],
  "acceptanceCriteria": [
    {
      "criterion": "Acceptance criterion",
      "description": "Description"
    }
  ]
}`,
        },
        {
          role: 'user',
          content: `Define QA strategy for this task:\n\n${taskDescription}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'qa_strategy',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              strategy: { type: 'string' },
              testingPhases: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    duration: { type: 'string' },
                  },
                },
              },
              qualityMetrics: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    metric: { type: 'string' },
                    target: { type: 'string' },
                    measurement: { type: 'string' },
                  },
                },
              },
              acceptanceCriteria: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    criterion: { type: 'string' },
                    description: { type: 'string' },
                  },
                },
              },
            },
            required: ['strategy', 'testingPhases', 'qualityMetrics', 'acceptanceCriteria'],
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    const analysisData = typeof content === 'string' ? JSON.parse(content) : content;

    // Store QA strategy
    await atisDb.createQAStrategy(taskId, userId, {
      strategy: analysisData.strategy,
      testingPhases: analysisData.testingPhases,
      qualityMetrics: analysisData.qualityMetrics,
      acceptanceCriteria: analysisData.acceptanceCriteria,
    });

    return {
      success: true,
      phase: 7,
      data: analysisData,
    };
  } catch (error) {
    console.error('[ATIS Phase 7] Error:', error);
    throw error;
  }
}

/**
 * Phase 8: Documentation Requirements
 * Defines documentation needs
 */
export async function analyzePhase8Documentation(taskId: string, userId: string, taskDescription: string) {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `You are a documentation expert. Analyze the given task and define documentation requirements.
          
Return a JSON object with this structure:
{
  "documentationTypes": [
    {
      "type": "user_guide|api_docs|technical_spec|training_material|other",
      "audience": "Target audience",
      "estimatedEffort": number,
      "outline": ["Section 1", "Section 2", ...]
    }
  ],
  "summary": "Documentation requirements summary"
}`,
        },
        {
          role: 'user',
          content: `Define documentation requirements for this task:\n\n${taskDescription}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'documentation_requirements',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              documentationTypes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string' },
                    audience: { type: 'string' },
                    estimatedEffort: { type: 'number' },
                    outline: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
              summary: { type: 'string' },
            },
            required: ['documentationTypes', 'summary'],
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    const analysisData = typeof content === 'string' ? JSON.parse(content) : content;

    // Store documentation requirements
    for (const doc of analysisData.documentationTypes) {
      await atisDb.createDocumentationRequirement(taskId, userId, {
        docType: doc.type,
        audience: doc.audience,
        estimatedEffort: doc.estimatedEffort,
        contentOutline: doc.outline,
      });
    }

    return {
      success: true,
      phase: 8,
      data: analysisData,
    };
  } catch (error) {
    console.error('[ATIS Phase 8] Error:', error);
    throw error;
  }
}

/**
 * Phase 9: External Dependencies
 * Identifies and manages external dependencies
 */
export async function analyzePhase9Dependencies(taskId: string, userId: string, taskDescription: string) {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `You are a dependency management expert. Analyze the given task and identify external dependencies.
          
Return a JSON object with this structure:
{
  "dependencies": [
    {
      "type": "approval|third_party|regulatory",
      "description": "Dependency description",
      "owner": "Responsible party",
      "dueDate": "YYYY-MM-DD",
      "impact": "Impact if not met"
    }
  ],
  "summary": "Dependency analysis summary"
}`,
        },
        {
          role: 'user',
          content: `Identify external dependencies for this task:\n\n${taskDescription}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'external_dependencies',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              dependencies: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['approval', 'third_party', 'regulatory'] },
                    description: { type: 'string' },
                    owner: { type: 'string' },
                    dueDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
                    impact: { type: 'string' },
                  },
                },
              },
              summary: { type: 'string' },
            },
            required: ['dependencies', 'summary'],
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    const analysisData = typeof content === 'string' ? JSON.parse(content) : content;

    // Store external dependencies
    for (const dep of analysisData.dependencies) {
      await atisDb.createExternalDependency(taskId, userId, {
        dependencyType: dep.type,
        description: dep.description,
        owner: dep.owner,
        dueDate: dep.dueDate,
      });
    }

    return {
      success: true,
      phase: 9,
      data: analysisData,
    };
  } catch (error) {
    console.error('[ATIS Phase 9] Error:', error);
    throw error;
  }
}

/**
 * Phase 10: Finalization & Execution Plan
 * Creates comprehensive execution plan
 */
export async function analyzePhase10Finalization(taskId: string, userId: string, taskDescription: string) {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `You are an execution planning expert. Analyze the given task and create a comprehensive execution plan.
          
Return a JSON object with this structure:
{
  "roadmap": [
    {
      "step": number,
      "title": "Step title",
      "description": "Step description",
      "duration": "Estimated duration",
      "owner": "Responsible party"
    }
  ],
  "successMetrics": [
    {
      "metric": "Metric name",
      "target": "Target value",
      "measurement": "How to measure"
    }
  ],
  "communicationPlan": "Communication strategy",
  "escalationPath": [
    {
      "level": number,
      "trigger": "When to escalate",
      "owner": "Escalation owner"
    }
  ],
  "preExecutionChecklist": [
    {
      "item": "Checklist item",
      "owner": "Responsible party"
    }
  ],
  "confidenceScore": 0-100,
  "summary": "Execution plan summary"
}`,
        },
        {
          role: 'user',
          content: `Create execution plan for this task:\n\n${taskDescription}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'execution_plan',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              roadmap: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    step: { type: 'number' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    duration: { type: 'string' },
                    owner: { type: 'string' },
                  },
                },
              },
              successMetrics: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    metric: { type: 'string' },
                    target: { type: 'string' },
                    measurement: { type: 'string' },
                  },
                },
              },
              communicationPlan: { type: 'string' },
              escalationPath: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    level: { type: 'number' },
                    trigger: { type: 'string' },
                    owner: { type: 'string' },
                  },
                },
              },
              preExecutionChecklist: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    item: { type: 'string' },
                    owner: { type: 'string' },
                  },
                },
              },
              confidenceScore: { type: 'number', minimum: 0, maximum: 100 },
              summary: { type: 'string' },
            },
            required: ['roadmap', 'successMetrics', 'communicationPlan', 'escalationPath', 'preExecutionChecklist', 'confidenceScore', 'summary'],
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    const analysisData = typeof content === 'string' ? JSON.parse(content) : content;

    // Store execution plan
    await atisDb.createExecutionPlan(taskId, userId, {
      roadmap: analysisData.roadmap,
      successMetrics: analysisData.successMetrics,
      communicationPlan: analysisData.communicationPlan,
      escalationPath: analysisData.escalationPath,
      preExecutionChecklist: analysisData.preExecutionChecklist,
      aptlssChecklist: analysisData, // Store full analysis as APTLSS checklist
      confidenceScore: analysisData.confidenceScore,
    });

    return {
      success: true,
      phase: 10,
      data: analysisData,
    };
  } catch (error) {
    console.error('[ATIS Phase 10] Error:', error);
    throw error;
  }
}

/**
 * Run all phases sequentially
 */
export async function runAllPhases(taskId: string, userId: string, taskDescription: string) {
  const sessionId = await atisDb.createAnalysisSession(taskId, userId);
  const results: any[] = [];

  try {
    // Phase 3: Decomposition
    console.log('[ATIS] Starting Phase 3: Decomposition');
    const phase3 = await analyzePhase3Decomposition(taskId, userId, taskDescription);
    results.push(phase3);
    await atisDb.updateAnalysisSession(sessionId, {
      status: 'in_progress',
      currentPhase: 4,
      phasesCompleted: 1,
      sessionData: { phase3 },
    });

    // Phase 4: Risk Assessment
    console.log('[ATIS] Starting Phase 4: Risk Assessment');
    const phase4 = await analyzePhase4RiskAssessment(taskId, userId, taskDescription);
    results.push(phase4);
    await atisDb.updateAnalysisSession(sessionId, {
      status: 'in_progress',
      currentPhase: 5,
      phasesCompleted: 2,
      sessionData: { phase3, phase4 },
    });

    // Phase 5: Resource Estimation
    console.log('[ATIS] Starting Phase 5: Resource Estimation');
    const phase5 = await analyzePhase5ResourceEstimation(taskId, userId, taskDescription);
    results.push(phase5);
    await atisDb.updateAnalysisSession(sessionId, {
      status: 'in_progress',
      currentPhase: 6,
      phasesCompleted: 3,
      sessionData: { phase3, phase4, phase5 },
    });

    // Phase 6: Timeline Optimization
    console.log('[ATIS] Starting Phase 6: Timeline Optimization');
    const phase6 = await analyzePhase6TimelineOptimization(taskId, userId, taskDescription);
    results.push(phase6);
    await atisDb.updateAnalysisSession(sessionId, {
      status: 'in_progress',
      currentPhase: 7,
      phasesCompleted: 4,
      sessionData: { phase3, phase4, phase5, phase6 },
    });

    // Phase 7: QA Strategy
    console.log('[ATIS] Starting Phase 7: QA Strategy');
    const phase7 = await analyzePhase7QAStrategy(taskId, userId, taskDescription);
    results.push(phase7);
    await atisDb.updateAnalysisSession(sessionId, {
      status: 'in_progress',
      currentPhase: 8,
      phasesCompleted: 5,
      sessionData: { phase3, phase4, phase5, phase6, phase7 },
    });

    // Phase 8: Documentation
    console.log('[ATIS] Starting Phase 8: Documentation Requirements');
    const phase8 = await analyzePhase8Documentation(taskId, userId, taskDescription);
    results.push(phase8);
    await atisDb.updateAnalysisSession(sessionId, {
      status: 'in_progress',
      currentPhase: 9,
      phasesCompleted: 6,
      sessionData: { phase3, phase4, phase5, phase6, phase7, phase8 },
    });

    // Phase 9: Dependencies
    console.log('[ATIS] Starting Phase 9: External Dependencies');
    const phase9 = await analyzePhase9Dependencies(taskId, userId, taskDescription);
    results.push(phase9);
    await atisDb.updateAnalysisSession(sessionId, {
      status: 'in_progress',
      currentPhase: 10,
      phasesCompleted: 7,
      sessionData: { phase3, phase4, phase5, phase6, phase7, phase8, phase9 },
    });

    // Phase 10: Finalization
    console.log('[ATIS] Starting Phase 10: Finalization & Execution Plan');
    const phase10 = await analyzePhase10Finalization(taskId, userId, taskDescription);
    results.push(phase10);

    // Mark session as completed
    await atisDb.updateAnalysisSession(sessionId, {
      status: 'completed',
      currentPhase: 10,
      phasesCompleted: 8,
      sessionData: { phase3, phase4, phase5, phase6, phase7, phase8, phase9, phase10 },
      completedAt: new Date(),
    });

    return {
      success: true,
      sessionId,
      phasesCompleted: 8,
      results,
    };
  } catch (error) {
    console.error('[ATIS] Error running phases:', error);
    await atisDb.updateAnalysisSession(sessionId, {
      status: 'failed',
      sessionData: { results, error: String(error) },
    });
    throw error;
  }
}
