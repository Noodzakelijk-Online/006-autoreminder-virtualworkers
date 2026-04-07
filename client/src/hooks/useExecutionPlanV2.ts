import { useState, useCallback, useEffect } from 'react';
import { trpc } from '@/lib/trpc';

export interface ExecutionPlanData {
  id: string;
  overview: {
    objective: string;
    inputs: string[];
    outputs: string[];
  };
  steps: Array<{
    id: string;
    stepId: string;
    title: string;
    description: string;
    dependencies: string[];
    parallelizable: boolean;
    timeEstimateMin: number;
    timeEstimateMax: number;
    risks: string[];
    status: 'completed' | 'in-progress' | 'ready' | 'blocked';
    startedAt?: Date;
    completedAt?: Date;
  }>;
  iterationFlows: Array<{
    loopName: string;
    steps: string[];
  }>;
  totalEstimateMin: number;
  totalEstimateMax: number;
  blockedSteps: string[];
}

export function useExecutionPlanV2(planId: string | null) {
  const [plan, setPlan] = useState<ExecutionPlanData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch plan
  const { data: fetchedPlan, isLoading: isFetching } = trpc.executionPlan.getById.useQuery(
    { planId: planId || '' },
    { enabled: !!planId, staleTime: 30000 }
  );

  // Get blocked steps
  const { data: blockedData } = trpc.executionPlan.getBlockedSteps.useQuery(
    { executionPlanId: planId || '' },
    { enabled: !!planId, staleTime: 30000 }
  );

  // Update step status mutation
  const updateStepMutation = trpc.executionPlan.updateStepStatus.useMutation();

  // Combine data
  useEffect(() => {
    if (fetchedPlan?.success && fetchedPlan.plan) {
      setPlan({
        ...fetchedPlan.plan,
        blockedSteps: blockedData?.blockedSteps || []
      });
      setError(null);
    } else if (fetchedPlan?.error) {
      setError(fetchedPlan.error);
    }
    setLoading(isFetching);
  }, [fetchedPlan, blockedData, isFetching]);

  // Update step status
  const updateStepStatus = useCallback(
    async (stepId: string, newStatus: 'completed' | 'in-progress' | 'ready' | 'blocked', reason?: string) => {
      if (!planId) return;

      try {
        const result = await updateStepMutation.mutateAsync({
          stepId,
          executionPlanId: planId,
          newStatus,
          reason
        });

        if (result.success && plan) {
          // Update local state
          const updatedSteps = plan.steps.map(s =>
            s.id === stepId ? { ...s, status: newStatus } : s
          );

          setPlan({
            ...plan,
            steps: updatedSteps,
            blockedSteps: result.blockedSteps || []
          });
        }

        return result;
      } catch (err) {
        console.error('Error updating step status:', err);
        throw err;
      }
    },
    [planId, plan, updateStepMutation]
  );

  // Get step dependencies
  const getStepDependencies = useCallback((stepId: string) => {
    if (!plan) return [];
    const step = plan.steps.find(s => s.stepId === stepId);
    if (!step) return [];
    return step.dependencies.map(depId => plan.steps.find(s => s.stepId === depId)).filter(Boolean);
  }, [plan]);

  // Get critical path
  const getCriticalPath = useCallback(() => {
    if (!plan) return [];
    const criticalSteps: string[] = [];
    const visited = new Set<string>();
    const planRef = plan;

    function traverse(stepId: string) {
      if (visited.has(stepId)) return;
      visited.add(stepId);

      const step = planRef.steps.find(s => s.stepId === stepId);
      if (!step) return;

      if (step?.dependencies.length === 0) {
        criticalSteps.push(stepId);
      } else if (step) {
        for (const depId of step.dependencies) {
          traverse(depId);
        }
        criticalSteps.push(stepId);
      }
    }

    // Find steps with no dependents (end steps)
    const endSteps = planRef.steps.filter(s => !planRef.steps.some(other => other.dependencies.includes(s.stepId)));
    for (const step of endSteps) {
      traverse(step.stepId);
    }

    return criticalSteps;
  }, [plan]);

  // Get parallel work opportunities
  const getParallelWork = useCallback(() => {
    if (!plan) return [];
    const parallelGroups: string[][] = [];
    const processed = new Set<string>();
    const planRef = plan;

    for (const step of planRef.steps) {
      if (processed.has(step.stepId)) continue;
      if (!step.parallelizable) continue;

      const group = [step.stepId];
      for (const other of planRef.steps) {
        if (processed.has(other.stepId) || !other.parallelizable) continue;
        if (step.dependencies.every(d => other.dependencies.includes(d))) {
          group.push(other.stepId);
          processed.add(other.stepId);
        }
      }

      if (group.length > 1) {
        parallelGroups.push(group);
      }
      processed.add(step.stepId);
    }

    return parallelGroups;
  }, [plan]);

  // Calculate progress
  const getProgress = useCallback(() => {
    if (!plan) return 0;
    const completed = plan.steps.filter(s => s.status === 'completed').length;
    return Math.round((completed / plan.steps.length) * 100);
  }, [plan]);

  // Get time estimate for step
  const getStepTimeEstimate = useCallback((stepId: string) => {
    if (!plan) return { min: 0, max: 0 };
    const step = plan.steps.find(s => s.stepId === stepId);
    if (!step) return { min: 0, max: 0 };
    return { min: step.timeEstimateMin, max: step.timeEstimateMax };
  }, [plan]);

  return {
    plan,
    loading,
    error,
    updateStepStatus,
    getStepDependencies,
    getCriticalPath,
    getParallelWork,
    getProgress,
    getStepTimeEstimate,
    isUpdating: updateStepMutation.isPending
  };
}
