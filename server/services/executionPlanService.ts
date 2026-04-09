import { getDb } from '../db';
import { executionPlans, executionPlanSteps, executionPlanStatusHistory } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// ExecutionPlan JSON Schema validation
interface ExecutionPlanJSON {
  overview: {
    objective: string;
    inputs: string[];
    outputs: string[];
  };
  steps: Array<{
    id: string;
    title: string;
    description: string;
    dependencies: string[];
    parallelizable: boolean;
    timeEstimate: { min: number; max: number };
    risks: string[];
  }>;
  iterationFlows: Array<{
    loopName: string;
    steps: string[];
  }>;
  totalEstimate: { min: number; max: number };
}

// Validate ExecutionPlan JSON against schema
export function validateExecutionPlanSchema(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.overview) errors.push('Missing overview object');
  if (!data.overview?.objective) errors.push('Missing overview.objective');
  if (!Array.isArray(data.overview?.inputs)) errors.push('overview.inputs must be an array');
  if (!Array.isArray(data.overview?.outputs)) errors.push('overview.outputs must be an array');

  if (!Array.isArray(data.steps)) errors.push('steps must be an array');
  data.steps?.forEach((step: any, idx: number) => {
    if (!step.id) errors.push(`steps[${idx}] missing id`);
    if (!step.title) errors.push(`steps[${idx}] missing title`);
    if (!step.description) errors.push(`steps[${idx}] missing description`);
    if (!Array.isArray(step.dependencies)) errors.push(`steps[${idx}] dependencies must be array`);
    if (typeof step.parallelizable !== 'boolean') errors.push(`steps[${idx}] parallelizable must be boolean`);
    if (!step.timeEstimate?.min || !step.timeEstimate?.max) errors.push(`steps[${idx}] invalid timeEstimate`);
    if (!Array.isArray(step.risks)) errors.push(`steps[${idx}] risks must be array`);
  });

  if (!Array.isArray(data.iterationFlows)) errors.push('iterationFlows must be an array');
  if (!data.totalEstimate?.min || !data.totalEstimate?.max) errors.push('Invalid totalEstimate');

  return { valid: errors.length === 0, errors };
}

// Fetch ExecutionPlan from Trello card
export async function fetchExecutionPlanFromTrello(cardId: string, trelloApiKey: string, trelloToken: string): Promise<ExecutionPlanJSON | null> {
  try {
    // Fetch card from Trello API
    const cardResponse = await fetch(`https://api.trello.com/1/cards/${cardId}?key=${trelloApiKey}&token=${trelloToken}&fields=desc,name`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!cardResponse.ok) {
      console.error(`Failed to fetch Trello card ${cardId}: ${cardResponse.status}`);
      return null;
    }

    const card = await cardResponse.json();
    const description = card.desc || '';

    // Try to parse ExecutionPlan JSON from card description
    // Look for JSON block in description
    const jsonMatch = description.match(/```json\n([\s\S]*?)\n```/) || description.match(/({[\s\S]*})/);
    
    if (!jsonMatch) {
      console.warn(`No ExecutionPlan JSON found in card ${cardId} description`);
      return null;
    }

    const executionPlanJson = JSON.parse(jsonMatch[1]);
    
    // Validate schema
    const validation = validateExecutionPlanSchema(executionPlanJson);
    if (!validation.valid) {
      console.error(`ExecutionPlan schema validation failed for card ${cardId}:`, validation.errors);
      return null;
    }

    return executionPlanJson;
  } catch (error) {
    console.error(`Error fetching ExecutionPlan from Trello card ${cardId}:`, error);
    return null;
  }
}

// Store ExecutionPlan in database
export async function storeExecutionPlan(
  cardId: string,
  userId: number,
  executionPlanJson: ExecutionPlanJSON,
  generatedBy: 'manual' | 'ai' = 'manual'
) {
  try {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const planId = uuidv4();

    // Store main execution plan
    await db.insert(executionPlans).values({
      id: planId,
      cardId,
      userId,
      objective: executionPlanJson.overview.objective,
      inputs: JSON.stringify(executionPlanJson.overview.inputs),
      outputs: JSON.stringify(executionPlanJson.overview.outputs),
      stepsJson: JSON.stringify(executionPlanJson.steps),
      iterationFlowsJson: JSON.stringify(executionPlanJson.iterationFlows),
      totalEstimateMin: executionPlanJson.totalEstimate.min,
      totalEstimateMax: executionPlanJson.totalEstimate.max,
      generatedBy,
    });

    // Store individual steps
    for (const step of executionPlanJson.steps) {
      await db.insert(executionPlanSteps).values({
        id: uuidv4(),
        executionPlanId: planId,
        stepId: step.id,
        title: step.title,
        description: step.description,
        dependencies: JSON.stringify(step.dependencies),
        parallelizable: step.parallelizable ? 1 : 0,
        timeEstimateMin: step.timeEstimate.min,
        timeEstimateMax: step.timeEstimate.max,
        risks: JSON.stringify(step.risks),
        status: 'ready',
      });
    }

    return planId;
  } catch (error) {
    console.error('Error storing ExecutionPlan:', error);
    throw error;
  }
}

// Get ExecutionPlan with all steps
export async function getExecutionPlan(planId: string) {
  try {
    const db = await getDb();
    if (!db) return null;

    const plan = await db.query.executionPlans.findFirst({
      where: eq(executionPlans.id, planId),
    });

    if (!plan) return null;

    const steps = await db.query.executionPlanSteps.findMany({
      where: eq(executionPlanSteps.executionPlanId, planId),
    });

    return {
      ...plan,
      inputs: JSON.parse(plan.inputs),
      outputs: JSON.parse(plan.outputs),
      stepsJson: JSON.parse(plan.stepsJson),
      iterationFlowsJson: JSON.parse(plan.iterationFlowsJson),
      steps: steps.map((s: any) => ({
        ...s,
        dependencies: JSON.parse(s.dependencies),
        risks: JSON.parse(s.risks),
        parallelizable: s.parallelizable === 1,
      })),
    };
  } catch (error) {
    console.error('Error fetching ExecutionPlan:', error);
    return null;
  }
}

// Update step status
export async function updateStepStatus(
  stepId: string,
  executionPlanId: string,
  newStatus: 'completed' | 'in-progress' | 'ready' | 'blocked',
  userId: number,
  reason?: string
) {
  try {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Get current step
    const step = await db.query.executionPlanSteps.findFirst({
      where: and(
        eq(executionPlanSteps.id, stepId),
        eq(executionPlanSteps.executionPlanId, executionPlanId)
      ),
    });

    if (!step) throw new Error('Step not found');

    const previousStatus = (step as any).status;

    // Update step status
    await db.update(executionPlanSteps)
      .set({
        status: newStatus,
        startedAt: newStatus === 'in-progress' && !(step as any).startedAt ? new Date() : (step as any).startedAt,
        completedAt: newStatus === 'completed' ? new Date() : null,
        completedBy: newStatus === 'completed' ? userId.toString() : null,
      })
      .where(eq(executionPlanSteps.id, stepId));

    // Record status change in history
    await db.insert(executionPlanStatusHistory).values({
      id: uuidv4(),
      stepId,
      executionPlanId,
      previousStatus: previousStatus as any,
      newStatus,
      changedBy: userId,
      reason,
    });

    return { success: true, previousStatus, newStatus };
  } catch (error) {
    console.error('Error updating step status:', error);
    throw error;
  }
}

// Calculate blocked steps based on dependencies
export async function calculateBlockedSteps(executionPlanId: string) {
  try {
    const plan = await getExecutionPlan(executionPlanId);
    if (!plan) return [];

    const blockedSteps: string[] = [];
    const stepMap = new Map((plan as any).steps.map((s: any) => [s.stepId, s]));

    for (const step of (plan as any).steps) {
      for (const depId of step.dependencies) {
        const depStep = stepMap.get(depId);
        if (depStep && (depStep as any).status !== 'completed') {
          blockedSteps.push(step.id);
          break;
        }
      }
    }

    return blockedSteps;
  } catch (error) {
    console.error('Error calculating blocked steps:', error);
    return [];
  }
}

// Get execution plan by card ID
export async function getExecutionPlanByCardId(cardId: string) {
  try {
    const db = await getDb();
    if (!db) return null;

    const plan = await db.query.executionPlans.findFirst({
      where: eq(executionPlans.cardId, cardId),
    });

    if (!plan) return null;

    return getExecutionPlan(plan.id);
  } catch (error) {
    console.error('Error fetching ExecutionPlan by cardId:', error);
    return null;
  }
}
