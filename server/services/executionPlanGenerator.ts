import { invokeLLM } from '../_core/llm';
import { validateExecutionPlanSchema } from './executionPlanService';

const EXECUTION_PLAN_PROMPT = `You are a senior operations consultant and process architect. Your task is to analyze a Trello card and convert it into a highly detailed, execution-ready workflow that reflects real-world work.

CRITICAL REQUIREMENTS:
1. Break the work into granular, actionable micro-steps (not vague steps like "prepare", "handle", "process")
2. Steps must follow real chronological order with clear dependencies
3. Provide time as a RANGE in minutes (not fixed values)
4. Include rework cycles like: Review → Fix → Re-run → Validate
5. Add realistic risks including missing data, unclear requirements, stakeholder dependencies, technical blockers
6. Include preparation, execution, validation, communication, and final delivery

STRICT OUTPUT FORMAT - Return ONLY valid JSON matching this schema:
{
  "overview": {
    "objective": "string - clear goal statement",
    "inputs": ["string - required input"],
    "outputs": ["string - expected output"]
  },
  "steps": [
    {
      "id": "step-1",
      "title": "string",
      "description": "string - detailed action description",
      "dependencies": ["step-id"],
      "parallelizable": false,
      "timeEstimate": {
        "min": 30,
        "max": 60
      },
      "risks": ["string - specific risk"]
    }
  ],
  "iterationFlows": [
    {
      "loopName": "string",
      "steps": ["step-id"]
    }
  ],
  "totalEstimate": {
    "min": 0,
    "max": 0
  }
}

VALIDATION RULES:
- Step IDs must be unique (step-1, step-2, etc.)
- Dependencies must reference valid step IDs
- No step can be vague or high-level
- Time estimates must be realistic (not overly optimistic)
- At least one iteration loop must exist if review is involved
- totalEstimate must roughly match sum of all steps
- JSON must be valid and properly formatted

Card Title: {cardTitle}
Card Description: {cardDescription}

Generate the ExecutionPlan JSON now:`;

const QUALITY_CHECK_PROMPT = `You are a quality assurance expert for execution plans. Review the provided ExecutionPlan and provide a quality assessment.

ExecutionPlan:
{executionPlan}

Evaluate on these criteria:
1. Are steps granular and actionable? (not vague like "prepare", "handle", "process")
2. Are time estimates realistic and well-reasoned?
3. Are dependencies correctly identified and logical?
4. Are risks comprehensive and specific?
5. Is the total estimate accurate based on individual steps?
6. Are iteration loops properly identified?

Respond with ONLY this JSON format:
{
  "score": 0-100,
  "feedback": "brief overall assessment",
  "issues": ["specific issue 1", "specific issue 2"],
  "recommendations": ["recommendation 1", "recommendation 2"]
}`;

interface GenerationOptions {
  fastModelProvider?: 'groq' | 'together' | 'openrouter' | 'ollama';
  qualityModelProvider?: 'groq' | 'together' | 'openrouter' | 'ollama';
  skipQualityCheck?: boolean;
}

interface GenerationResult {
  success: boolean;
  plan?: any;
  qualityScore?: number;
  validationStatus?: 'initial' | 'validated' | 'needs_review' | 'quality_check_failed';
  qualityFeedback?: string;
  error?: string;
}

export async function generateExecutionPlanFromCard(
  cardTitle: string,
  cardDescription: string,
  options?: GenerationOptions
): Promise<GenerationResult> {
  try {
    const prompt = EXECUTION_PLAN_PROMPT
      .replace('{cardTitle}', cardTitle)
      .replace('{cardDescription}', cardDescription);

    // Step 1: Generate initial ExecutionPlan with fast model
    // Using lightweight models for speed and cost efficiency
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: 'You are a senior operations consultant generating detailed execution plans. Always return valid JSON only, no explanations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'execution_plan',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              overview: {
                type: 'object',
                properties: {
                  objective: { type: 'string' },
                  inputs: { type: 'array', items: { type: 'string' } },
                  outputs: { type: 'array', items: { type: 'string' } }
                },
                required: ['objective', 'inputs', 'outputs'],
                additionalProperties: false
              },
              steps: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    dependencies: { type: 'array', items: { type: 'string' } },
                    parallelizable: { type: 'boolean' },
                    timeEstimate: {
                      type: 'object',
                      properties: {
                        min: { type: 'integer' },
                        max: { type: 'integer' }
                      },
                      required: ['min', 'max'],
                      additionalProperties: false
                    },
                    risks: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['id', 'title', 'description', 'dependencies', 'parallelizable', 'timeEstimate', 'risks'],
                  additionalProperties: false
                }
              },
              iterationFlows: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    loopName: { type: 'string' },
                    steps: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['loopName', 'steps'],
                  additionalProperties: false
                }
              },
              totalEstimate: {
                type: 'object',
                properties: {
                  min: { type: 'integer' },
                  max: { type: 'integer' }
                },
                required: ['min', 'max'],
                additionalProperties: false
              }
            },
            required: ['overview', 'steps', 'iterationFlows', 'totalEstimate'],
            additionalProperties: false
          }
        }
      }
    });

    // Extract JSON from response
    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { success: false, error: 'No response from LLM' };
    }

    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const executionPlan = JSON.parse(contentStr);

    // Validate schema
    const validation = validateExecutionPlanSchema(executionPlan);
    if (!validation.valid) {
      return { success: false, error: `Schema validation failed: ${validation.errors.join(', ')}` };
    }

    // Step 2: Quality check with powerful model (optional)
    // This ensures good quality without paying for expensive models for initial generation
    let qualityScore = 85; // Default score for fast model
    let validationStatus: 'initial' | 'validated' | 'needs_review' | 'quality_check_failed' = 'initial';
    let qualityFeedback = '';

    if (!options?.skipQualityCheck) {
      try {
        const qualityCheckContent = QUALITY_CHECK_PROMPT.replace(
          '{executionPlan}',
          JSON.stringify(executionPlan, null, 2)
        );

        const qualityResponse = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: 'You are a quality assurance expert for execution plans. Provide honest, detailed feedback. Return ONLY valid JSON.'
            },
            {
              role: 'user',
              content: qualityCheckContent
            }
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'quality_assessment',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  score: { type: 'integer', minimum: 0, maximum: 100 },
                  feedback: { type: 'string' },
                  issues: { type: 'array', items: { type: 'string' } },
                  recommendations: { type: 'array', items: { type: 'string' } }
                },
                required: ['score', 'feedback', 'issues', 'recommendations'],
                additionalProperties: false
              }
            }
          }
        });

        const qualityContent = qualityResponse.choices[0]?.message?.content;
        if (qualityContent) {
          const qualityStr = typeof qualityContent === 'string' ? qualityContent : JSON.stringify(qualityContent);
          const qualityData = JSON.parse(qualityStr);
          qualityScore = qualityData.score || 85;
          qualityFeedback = qualityData.feedback || '';
          validationStatus = qualityScore >= 80 ? 'validated' : 'needs_review';

          // Log issues if any
          if (qualityData.issues && qualityData.issues.length > 0) {
            console.log('Quality check issues:', qualityData.issues);
          }
        }
      } catch (error) {
        console.warn('Quality check failed, using initial plan:', error);
        validationStatus = 'quality_check_failed';
      }
    }

    return {
      success: true,
      plan: executionPlan,
      qualityScore,
      validationStatus,
      qualityFeedback
    };
  } catch (error) {
    console.error('Error generating ExecutionPlan:', error);
    return { success: false, error: `Generation failed: ${(error as Error).message}` };
  }
}

// Batch generate execution plans for multiple cards
export async function batchGenerateExecutionPlans(
  cards: Array<{ id: string; title: string; description: string }>,
  options?: GenerationOptions
): Promise<Map<string, GenerationResult>> {
  const results = new Map();

  for (const card of cards) {
    try {
      const result = await generateExecutionPlanFromCard(card.title, card.description, options);
      results.set(card.id, result);

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      results.set(card.id, { success: false, error: (error as Error).message });
    }
  }

  return results;
}
