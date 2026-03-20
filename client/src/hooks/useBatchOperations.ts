import { useState, useCallback, useEffect } from 'react';
import { getBatchOperationsClient, BatchOperationRequest, BatchOperationResponse } from '@/lib/batch-operations-client';
import { useBatchOperationUpdates } from './useBatchOperationUpdates';

interface BatchOperation {
  jobId: string;
  operationType: 're_analyze' | 'reschedule' | 'conflict_resolution' | 'optimization';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  currentTaskName?: string;
  currentTaskIndex: number;
  elapsedTimeSeconds?: number;
  estimatedTimeSeconds?: number;
  errorLog?: string[];
  results?: Record<string, any>;
  isPaused?: boolean;
  pausedAt?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

interface UseBatchOperationsOptions {
  autoLoad?: boolean;
  pollInterval?: number;
}

export const useBatchOperations = (options: UseBatchOperationsOptions = {}) => {
  const { autoLoad = true, pollInterval = 5000 } = options;

  const [operations, setOperations] = useState<BatchOperation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const client = getBatchOperationsClient();

  // Load all batch operations
  const loadOperations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const ops = await client.getAllBatchOperations();
      setOperations(
        ops.map(op => ({
          ...op,
          createdAt: new Date(op.createdAt),
          startedAt: op.startedAt ? new Date(op.startedAt) : undefined,
          completedAt: op.completedAt ? new Date(op.completedAt) : undefined,
          isPaused: op.isPaused,
          pausedAt: op.pausedAt,
          progress: 0,
          completedTasks: 0,
          failedTasks: 0,
          currentTaskIndex: 0,
        } as BatchOperation))
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error('[useBatchOperations] Failed to load operations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  // Start a new batch operation
  const startBatchOperation = useCallback(
    async (request: BatchOperationRequest) => {
      try {
        setError(null);
        const response = await client.startBatchOperation(request);
        const newOp: BatchOperation = {
          ...(response as any),
          createdAt: new Date(response.createdAt),
          startedAt: response.startedAt ? new Date(response.startedAt) : undefined,
          completedAt: response.completedAt ? new Date(response.completedAt) : undefined,
          isPaused: false,
          progress: 0,
          completedTasks: 0,
          failedTasks: 0,
          currentTaskIndex: 0,
        }
        setOperations(prev => [newOp, ...prev]);
        return response;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      }
    },
    [client]
  );

  // Cancel a batch operation
  const cancelBatchOperation = useCallback(
    async (jobId: string) => {
      try {
        setError(null);
        await client.cancelBatchOperation(jobId);
        setOperations(prev =>
          prev.map(op =>
            op.jobId === jobId ? { ...op, status: 'cancelled' as const } : op
          )
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      }
    },
    [client]
  );

  // Pause a batch operation
  const pauseBatchOperation = useCallback(
    async (jobId: string) => {
      try {
        setError(null);
        await client.pauseBatchOperation(jobId);
        setOperations(prev =>
          prev.map(op =>
            op.jobId === jobId ? { ...op, isPaused: true } : op
          )
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      }
    },
    [client]
  );

  // Resume a batch operation
  const resumeBatchOperation = useCallback(
    async (jobId: string) => {
      try {
        setError(null);
        await client.resumeBatchOperation(jobId);
        setOperations(prev =>
          prev.map(op =>
            op.jobId === jobId ? { ...op, isPaused: false } : op
          )
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      }
    },
    [client]
  );

  // Update operation progress from WebSocket
  const updateOperationProgress = useCallback((update: any) => {
    setOperations(prev =>
      prev.map(op =>
        op.jobId === update.jobId
          ? {
              ...op,
              progress: update.progress,
              status: update.status,
              completedTasks: update.completedTasks,
              failedTasks: update.failedTasks,
              currentTaskName: update.currentTaskName,
              currentTaskIndex: update.currentTaskIndex,
              elapsedTimeSeconds: update.elapsedTimeSeconds,
              estimatedTimeSeconds: update.estimatedTimeSeconds,
              errorLog: update.errorLog,
              results: update.results,
              isPaused: update.isPaused,
              pausedAt: update.pausedAt,
              completedAt: update.status === 'completed' ? new Date() : op.completedAt,
            }
          : op
      )
    );
  }, []);

  // Auto-load operations on mount
  useEffect(() => {
    if (autoLoad) {
      loadOperations();
    }
  }, [autoLoad, loadOperations]);

  // Poll for updates periodically
  useEffect(() => {
    if (!autoLoad) return;

    const interval = setInterval(() => {
      loadOperations();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [autoLoad, pollInterval, loadOperations]);

  // Set up WebSocket listeners for running operations
  const runningOps = operations.filter(op => op.status === 'running');
  runningOps.forEach(op => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useBatchOperationUpdates({
      jobId: op.jobId,
      onUpdate: updateOperationProgress,
    });
  });

  return {
    operations,
    isLoading,
    error,
    loadOperations,
    startBatchOperation,
    cancelBatchOperation,
    pauseBatchOperation,
    resumeBatchOperation,
    updateOperationProgress,
  };
};

export default useBatchOperations;
