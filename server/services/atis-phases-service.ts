/**
 * ATIS Phases 3-10 Service
 * Advanced task analysis using LLM for decomposition, risk assessment, resource estimation, etc.
 */

import { invokeLLM } from '../_core/llm';
import * as atisDb from '../db/atis-phases';
import { websocketService } from './websocket';

/**
 * Emit ATIS progress update to all connected clients
 */
function emitATISProgress(
  sessionId: string,
  taskId: string,
  phase: number,
  status: 'started' | 'in_progress' | 'completed' | 'failed',
  confidence?: number,
  error?: string,
  progress?: number
) {
  try {
    websocketService.emitATISProgress(sessionId, taskId, phase, status, confidence, error, progress);
  } catch (e) {
    console.warn('[ATIS WebSocket] Failed to emit progress:', e);
  }
}

/**
 * Emit phase completion event to all connected clients
 */
function emitPhaseComplete(
  sessionId: string,
  phase: number,
  duration: number,
  confidence: number
) {
  try {
    websocketService.emitPhaseCompleted(sessionId, phase, duration, confidence);
  } catch (e) {
    console.warn('[ATIS WebSocket] Failed to emit phase complete:', e);
  }
}

/**
 * Emit analysis complete event to all connected clients
 */
function emitAnalysisComplete(
  sessionId: string,
  taskId: string,
  overallConfidence: number,
  completedPhases: number,
  totalDuration: number
) {
  try {
    websocketService.emitAnalysisComplete(sessionId, taskId, overallConfidence, completedPhases, 8, totalDuration);
  } catch (e) {
    console.warn('[ATIS WebSocket] Failed to emit analysis complete:', e);
  }
}

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
export async function runAllPhases(taskId: string, userId: string, taskDescription: string, sessionId?: string) {
  const analysisSessionId = sessionId ?? await atisDb.createAnalysisSession(taskId, userId);
  const results: any[] = [];
  const startTime = Date.now();
  let overallConfidence = 0;

  try {
    await atisDb.updateAnalysisSession(analysisSessionId, {
      status: 'in_progress',
      currentPhase: 3,
      phasesCompleted: 0,
      sessionData: { startedAt: new Date().toISOString() },
    });

    // Phase 3: Decomposition
    console.log('[ATIS] Starting Phase 3: Decomposition');
    const phase3Start = Date.now();
    emitATISProgress(analysisSessionId, taskId, 3, 'started', undefined, undefined, 0);
    
    const phase3 = await analyzePhase3Decomposition(taskId, userId, taskDescription);
    results.push(phase3);
    
    const phase3Duration = Date.now() - phase3Start;
    const phase3Confidence = phase3.data?.analysis ? 85 : 70;
    overallConfidence = phase3Confidence;
    
    emitPhaseComplete(analysisSessionId, 3, phase3Duration, phase3Confidence);
    emitATISProgress(analysisSessionId, taskId, 3, 'completed', phase3Confidence, undefined, 100);
    
    await atisDb.updateAnalysisSession(analysisSessionId, {
      status: 'in_progress',
      currentPhase: 4,
      phasesCompleted: 1,
      sessionData: { phase3 },
    });

    // Phase 4: Risk Assessment
    console.log('[ATIS] Starting Phase 4: Risk Assessment');
    const phase4Start = Date.now();
    emitATISProgress(analysisSessionId, taskId, 4, 'started', undefined, undefined, 0);
    
    const phase4 = await analyzePhase4RiskAssessment(taskId, userId, taskDescription);
    results.push(phase4);
    
    const phase4Duration = Date.now() - phase4Start;
    const phase4Confidence = 80;
    overallConfidence = (overallConfidence + phase4Confidence) / 2;
    
    emitPhaseComplete(analysisSessionId, 4, phase4Duration, phase4Confidence);
    emitATISProgress(analysisSessionId, taskId, 4, 'completed', phase4Confidence, undefined, 100);
    
    await atisDb.updateAnalysisSession(analysisSessionId, {
      status: 'in_progress',
      currentPhase: 5,
      phasesCompleted: 2,
      sessionData: { phase3, phase4 },
    });

    // Phase 5: Resource Estimation
    console.log('[ATIS] Starting Phase 5: Resource Estimation');
    const phase5Start = Date.now();
    emitATISProgress(analysisSessionId, taskId, 5, 'started', undefined, undefined, 0);
    
    const phase5 = await analyzePhase5ResourceEstimation(taskId, userId, taskDescription);
    results.push(phase5);
    
    const phase5Duration = Date.now() - phase5Start;
    const phase5Confidence = 82;
    overallConfidence = (overallConfidence + phase5Confidence) / 2;
    
    emitPhaseComplete(analysisSessionId, 5, phase5Duration, phase5Confidence);
    emitATISProgress(analysisSessionId, taskId, 5, 'completed', phase5Confidence, undefined, 100);
    
    await atisDb.updateAnalysisSession(analysisSessionId, {
      status: 'in_progress',
      currentPhase: 6,
      phasesCompleted: 3,
      sessionData: { phase3, phase4, phase5 },
    });

    // Phase 6: Timeline Optimization
    console.log('[ATIS] Starting Phase 6: Timeline Optimization');
    const phase6Start = Date.now();
    emitATISProgress(analysisSessionId, taskId, 6, 'started', undefined, undefined, 0);
    
    const phase6 = await analyzePhase6TimelineOptimization(taskId, userId, taskDescription);
    results.push(phase6);
    
    const phase6Duration = Date.now() - phase6Start;
    const phase6Confidence = 83;
    overallConfidence = (overallConfidence + phase6Confidence) / 2;
    
    emitPhaseComplete(analysisSessionId, 6, phase6Duration, phase6Confidence);
    emitATISProgress(analysisSessionId, taskId, 6, 'completed', phase6Confidence, undefined, 100);
    
    await atisDb.updateAnalysisSession(analysisSessionId, {
      status: 'in_progress',
      currentPhase: 7,
      phasesCompleted: 4,
      sessionData: { phase3, phase4, phase5, phase6 },
    });

    // Phase 7: QA Strategy
    console.log('[ATIS] Starting Phase 7: QA Strategy');
    const phase7Start = Date.now();
    emitATISProgress(analysisSessionId, taskId, 7, 'started', undefined, undefined, 0);
    
    const phase7 = await analyzePhase7QAStrategy(taskId, userId, taskDescription);
    results.push(phase7);
    
    const phase7Duration = Date.now() - phase7Start;
    const phase7Confidence = 81;
    overallConfidence = (overallConfidence + phase7Confidence) / 2;
    
    emitPhaseComplete(analysisSessionId, 7, phase7Duration, phase7Confidence);
    emitATISProgress(analysisSessionId, taskId, 7, 'completed', phase7Confidence, undefined, 100);
    
    await atisDb.updateAnalysisSession(analysisSessionId, {
      status: 'in_progress',
      currentPhase: 8,
      phasesCompleted: 5,
      sessionData: { phase3, phase4, phase5, phase6, phase7 },
    });

    // Phase 8: Documentation
    console.log('[ATIS] Starting Phase 8: Documentation Requirements');
    const phase8Start = Date.now();
    emitATISProgress(analysisSessionId, taskId, 8, 'started', undefined, undefined, 0);
    
    const phase8 = await analyzePhase8Documentation(taskId, userId, taskDescription);
    results.push(phase8);
    
    const phase8Duration = Date.now() - phase8Start;
    const phase8Confidence = 79;
    overallConfidence = (overallConfidence + phase8Confidence) / 2;
    
    emitPhaseComplete(analysisSessionId, 8, phase8Duration, phase8Confidence);
    emitATISProgress(analysisSessionId, taskId, 8, 'completed', phase8Confidence, undefined, 100);
    
    await atisDb.updateAnalysisSession(analysisSessionId, {
      status: 'in_progress',
      currentPhase: 9,
      phasesCompleted: 6,
      sessionData: { phase3, phase4, phase5, phase6, phase7, phase8 },
    });

    // Phase 9: Dependencies
    console.log('[ATIS] Starting Phase 9: External Dependencies');
    const phase9Start = Date.now();
    emitATISProgress(analysisSessionId, taskId, 9, 'started', undefined, undefined, 0);
    
    const phase9 = await analyzePhase9Dependencies(taskId, userId, taskDescription);
    results.push(phase9);
    
    const phase9Duration = Date.now() - phase9Start;
    const phase9Confidence = 80;
    overallConfidence = (overallConfidence + phase9Confidence) / 2;
    
    emitPhaseComplete(analysisSessionId, 9, phase9Duration, phase9Confidence);
    emitATISProgress(analysisSessionId, taskId, 9, 'completed', phase9Confidence, undefined, 100);
    
    await atisDb.updateAnalysisSession(analysisSessionId, {
      status: 'in_progress',
      currentPhase: 10,
      phasesCompleted: 7,
      sessionData: { phase3, phase4, phase5, phase6, phase7, phase8, phase9 },
    });

    // Phase 10: Finalization
    console.log('[ATIS] Starting Phase 10: Finalization & Execution Plan');
    const phase10Start = Date.now();
    emitATISProgress(analysisSessionId, taskId, 10, 'started', undefined, undefined, 0);
    
    const phase10 = await analyzePhase10Finalization(taskId, userId, taskDescription);
    results.push(phase10);
    
    const phase10Duration = Date.now() - phase10Start;
    const phase10Confidence = 84;
    overallConfidence = (overallConfidence + phase10Confidence) / 2;
    
    emitPhaseComplete(analysisSessionId, 10, phase10Duration, phase10Confidence);
    emitATISProgress(analysisSessionId, taskId, 10, 'completed', phase10Confidence, undefined, 100);

    // Mark session as completed
    const totalDuration = Date.now() - startTime;
    await atisDb.updateAnalysisSession(analysisSessionId, {
      status: 'completed',
      currentPhase: 10,
      phasesCompleted: 8,
      sessionData: { phase3, phase4, phase5, phase6, phase7, phase8, phase9, phase10 },
      completedAt: new Date(),
    });
    
    // Emit final analysis complete event
    emitAnalysisComplete(analysisSessionId, taskId, Math.round(overallConfidence), 8, totalDuration);

    return {
      success: true,
      sessionId: analysisSessionId,
      phasesCompleted: 8,
      results,
      overallConfidence: Math.round(overallConfidence),
      totalDuration,
    };
  } catch (error) {
    console.error('[ATIS] Error running phases:', error);
    emitATISProgress(analysisSessionId, taskId, 0, 'failed', undefined, String(error));
    await atisDb.updateAnalysisSession(analysisSessionId, {
      status: 'failed',
      sessionData: { results, error: String(error) },
    });
    throw error;
  }
}
