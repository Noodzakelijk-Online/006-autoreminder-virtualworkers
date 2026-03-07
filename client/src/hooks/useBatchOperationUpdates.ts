import { useEffect, useCallback, useRef, useState } from 'react';

interface BatchOperationUpdate {
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
}

interface UseBatchOperationUpdatesOptions {
  jobId?: string;
  onUpdate?: (update: BatchOperationUpdate) => void;
  onError?: (error: Error) => void;
  onComplete?: (result: any) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export const useBatchOperationUpdates = (options: UseBatchOperationUpdatesOptions = {}) => {
  const {
    jobId,
    onUpdate,
    onError,
    onComplete,
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const connect = useCallback(() => {
    if (!jobId) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/scheduling/batch/${jobId}/updates`;
      
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`[BatchOperationUpdates] Connected to job ${jobId}`);
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data) as BatchOperationUpdate;
          
          // Call the update callback
          onUpdate?.(update);

          // Call complete callback if operation finished
          if (update.status === 'completed' || update.status === 'failed' || update.status === 'cancelled') {
            onComplete?.(update);
          }
        } catch (err) {
          console.error('[BatchOperationUpdates] Failed to parse message:', err);
          const parseError = new Error(`Failed to parse batch operation update: ${err}`);
          setError(parseError);
          onError?.(parseError);
        }
      };

      ws.onerror = (event) => {
        console.error('[BatchOperationUpdates] WebSocket error:', event);
        const wsError = new Error('WebSocket connection error');
        setError(wsError);
        onError?.(wsError);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log(`[BatchOperationUpdates] Disconnected from job ${jobId}`);
        setIsConnected(false);

        // Attempt to reconnect if enabled
        if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          console.log(
            `[BatchOperationUpdates] Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`
          );
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          const maxAttemptsError = new Error('Max reconnection attempts reached');
          setError(maxAttemptsError);
          onError?.(maxAttemptsError);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      const connectError = err instanceof Error ? err : new Error(String(err));
      console.error('[BatchOperationUpdates] Connection error:', connectError);
      setError(connectError);
      onError?.(connectError);
    }
  }, [jobId, onUpdate, onError, onComplete, autoReconnect, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect, disconnect]);

  useEffect(() => {
    if (jobId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [jobId, connect, disconnect]);

  return {
    isConnected,
    error,
    reconnect,
    disconnect
  };
};

export default useBatchOperationUpdates;
