import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '@/_core/hooks/useAuth';

export interface BatchOperationUpdate {
  jobId: string;
  progress: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
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
}

interface UseBatchOperationUpdatesOptions {
  jobId?: string;
  jobIds?: string[];
  onUpdate?: (update: BatchOperationUpdate) => void;
  onError?: (error: Error) => void;
  onComplete?: (result: BatchOperationUpdate) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

const EVENTS = [
  'batch:progress',
  'batch:paused',
  'batch:resumed',
  'batch:complete',
  'batch:failed',
  'batch:cancelled',
] as const;

export const useBatchOperationUpdates = (
  options: UseBatchOperationUpdatesOptions = {}
) => {
  const {
    jobId,
    jobIds = [],
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options;
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const callbacksRef = useRef(options);
  const trackedJobsRef = useRef<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  callbacksRef.current = options;
  trackedJobsRef.current = new Set(
    [jobId, ...jobIds].filter((value): value is string => Boolean(value))
  );
  const hasTrackedJobs = trackedJobsRef.current.size > 0;

  useEffect(() => {
    if (!hasTrackedJobs || !user?.id || !user?.openId) return;

    const socket = io({
      path: '/ws',
      transports: ['websocket', 'polling'],
      reconnection: autoReconnect,
      reconnectionDelay: reconnectInterval,
      reconnectionDelayMax: Math.max(reconnectInterval, 15000),
      reconnectionAttempts: maxReconnectAttempts,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
      socket.emit('authenticate', {
        userId: user.id,
        userOpenId: user.openId,
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (value: Error) => {
      setError(value);
      callbacksRef.current.onError?.(value);
    });

    const handleUpdate = (rawUpdate: BatchOperationUpdate & { elapsedSeconds?: number }) => {
      if (!rawUpdate?.jobId || !trackedJobsRef.current.has(rawUpdate.jobId)) return;

      const update: BatchOperationUpdate = {
        ...rawUpdate,
        elapsedTimeSeconds: rawUpdate.elapsedTimeSeconds ?? rawUpdate.elapsedSeconds,
      };
      callbacksRef.current.onUpdate?.(update);
      if (['completed', 'failed', 'cancelled'].includes(update.status)) {
        callbacksRef.current.onComplete?.(update);
      }
    };

    EVENTS.forEach(event => socket.on(event, handleUpdate));

    return () => {
      EVENTS.forEach(event => socket.off(event, handleUpdate));
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [
    autoReconnect,
    hasTrackedJobs,
    maxReconnectAttempts,
    reconnectInterval,
    user?.id,
    user?.openId,
  ]);

  const disconnect = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setIsConnected(false);
  };

  const reconnect = () => {
    socketRef.current?.connect();
  };

  return {
    isConnected,
    error,
    reconnect,
    disconnect,
  };
};

export default useBatchOperationUpdates;
