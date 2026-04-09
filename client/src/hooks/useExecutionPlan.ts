import { useState, useEffect, useCallback } from 'react';

interface TimeEstimate {
  min: number;
  max: number;
}

interface Step {
  id: string;
  title: string;
  description: string;
  dependencies: string[];
  parallelizable: boolean;
  timeEstimate: TimeEstimate;
  risks: string[];
}

interface IterationFlow {
  loopName: string;
  steps: string[];
}

interface ExecutionPlan {
  overview: {
    objective: string;
    inputs: string[];
    outputs: string[];
  };
  steps: Step[];
  iterationFlows: IterationFlow[];
  totalEstimate: TimeEstimate;
}

interface StepStatus {
  stepId: string;
  status: 'completed' | 'in-progress' | 'ready' | 'blocked';
  updatedAt: string;
}

export const useExecutionPlan = (cardId?: string) => {
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [stepStatuses, setStepStatuses] = useState<Map<string, StepStatus>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch execution plan from Trello card
  const fetchExecutionPlan = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/trello/cards/${id}/execution-plan`);
      if (!response.ok) {
        throw new Error(`Failed to fetch execution plan: ${response.statusText}`);
      }
      const data = await response.json();
      setPlan(data.plan);
      setStepStatuses(new Map(data.stepStatuses?.map((s: StepStatus) => [s.stepId, s]) || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Update step status
  const updateStepStatus = useCallback(
    async (stepId: string, status: 'completed' | 'in-progress' | 'ready') => {
      if (!cardId) return;

      try {
        const response = await fetch(`/api/trello/cards/${cardId}/steps/${stepId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });

        if (!response.ok) {
          throw new Error('Failed to update step status');
        }

        const updatedStatus: StepStatus = {
          stepId,
          status,
          updatedAt: new Date().toISOString(),
        };

        setStepStatuses(prev => new Map(prev).set(stepId, updatedStatus));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [cardId]
  );

  // Calculate step status considering dependencies
  const getCalculatedStepStatus = useCallback(
    (step: Step): 'completed' | 'in-progress' | 'ready' | 'blocked' => {
      const savedStatus = stepStatuses.get(step.id);
      if (savedStatus?.status === 'completed') {
        return 'completed';
      }
      if (savedStatus?.status === 'in-progress') {
        return 'in-progress';
      }

      // Check if all dependencies are completed
      if (step.dependencies.length > 0) {
        const allDepsCompleted = step.dependencies.every(
          dep => stepStatuses.get(dep)?.status === 'completed'
        );
        if (!allDepsCompleted) {
          return 'blocked';
        }
      }

      return 'ready';
    },
    [stepStatuses]
  );

  // Get blocked dependencies for a step
  const getBlockedDependencies = useCallback(
    (step: Step): string[] => {
      return step.dependencies.filter(dep => stepStatuses.get(dep)?.status !== 'completed');
    },
    [stepStatuses]
  );

  useEffect(() => {
    if (cardId) {
      fetchExecutionPlan(cardId);
    }
  }, [cardId, fetchExecutionPlan]);

  return {
    plan,
    stepStatuses,
    loading,
    error,
    updateStepStatus,
    getCalculatedStepStatus,
    getBlockedDependencies,
    refetch: () => cardId && fetchExecutionPlan(cardId),
  };
};
