import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface AnalysisProgressUpdate {
  sessionId: string;
  taskId: string;
  phase: number;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  confidence?: number;
  progress?: number;
  error?: string;
  timestamp: number;
}

export interface PhaseCompletionEvent {
  sessionId: string;
  phase: number;
  duration: number;
  confidence: number;
  timestamp: number;
}

export interface AnalysisCompleteEvent {
  sessionId: string;
  taskId: string;
  overallConfidence: number;
  completedPhases: number;
  totalPhases: number;
  totalDuration: number;
  timestamp: number;
}

export interface WebSocketError {
  sessionId: string;
  phase: number;
  error: string;
  timestamp: number;
}

export interface UseATISWebSocketOptions {
  sessionId?: string;
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  reconnectionAttempts?: number;
  onProgressUpdate?: (update: AnalysisProgressUpdate) => void;
  onPhaseCompletion?: (event: PhaseCompletionEvent) => void;
  onAnalysisComplete?: (event: AnalysisCompleteEvent) => void;
  onError?: (error: WebSocketError) => void;
  onConfidenceUpdate?: (data: { phase: number; confidence: number }) => void;
}

export interface UseATISWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  connect: (sessionId: string) => void;
  disconnect: () => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback?: (...args: any[]) => void) => void;
  emit: (event: string, data?: any) => void;
}

/**
 * Custom hook for ATIS WebSocket connection management
 */
export function useATISWebSocket(options: UseATISWebSocketOptions = {}): UseATISWebSocketReturn {
  const {
    sessionId,
    autoConnect = true,
    reconnection = true,
    reconnectionDelay = 1000,
    reconnectionDelayMax = 5000,
    reconnectionAttempts = 5,
    onProgressUpdate,
    onPhaseCompletion,
    onAnalysisComplete,
    onError,
    onConfidenceUpdate,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize socket connection
  useEffect(() => {
    if (!autoConnect || !sessionId) return;

    const connect = () => {
      setIsConnecting(true);
      setError(null);

      try {
        const socket = io(window.location.origin, {
          reconnection,
          reconnectionDelay,
          reconnectionDelayMax,
          reconnectionAttempts,
          transports: ['websocket', 'polling'],
        });

        // Connection handlers
        socket.on('connect', () => {
          console.log('[ATIS WebSocket] Connected:', socket.id);
          socket.emit('join-session', sessionId);
          setIsConnected(true);
          setIsConnecting(false);
        });

        socket.on('session-joined', (data) => {
          console.log('[ATIS WebSocket] Session joined:', data);
        });

        socket.on('disconnect', () => {
          console.log('[ATIS WebSocket] Disconnected');
          setIsConnected(false);
        });

        socket.on('connect_error', (err) => {
          console.error('[ATIS WebSocket] Connection error:', err);
          setError(err as Error);
          setIsConnecting(false);
        });

        socket.on('error', (err) => {
          console.error('[ATIS WebSocket] Socket error:', err);
          setError(new Error(err));
        });

        // Progress update events
        socket.on('progress-update', (update: AnalysisProgressUpdate) => {
          console.log('[ATIS WebSocket] Progress update:', update);
          onProgressUpdate?.(update);
        });

        // Phase completion events
        socket.on('phase-completed', (event: PhaseCompletionEvent) => {
          console.log('[ATIS WebSocket] Phase completed:', event);
          onPhaseCompletion?.(event);
        });

        // Analysis completion events
        socket.on('analysis-complete', (event: AnalysisCompleteEvent) => {
          console.log('[ATIS WebSocket] Analysis complete:', event);
          onAnalysisComplete?.(event);
        });

        // Error events
        socket.on('analysis-error', (error: WebSocketError) => {
          console.error('[ATIS WebSocket] Analysis error:', error);
          onError?.(error);
        });

        // Confidence update events
        socket.on('confidence-update', (data: { phase: number; confidence: number }) => {
          console.log('[ATIS WebSocket] Confidence update:', data);
          onConfidenceUpdate?.(data);
        });

        socketRef.current = socket;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[ATIS WebSocket] Failed to create socket:', error);
        setError(error);
        setIsConnecting(false);
      }
    };

    connect();

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave-session', sessionId);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
    };
  }, [
    sessionId,
    autoConnect,
    reconnection,
    reconnectionDelay,
    reconnectionDelayMax,
    reconnectionAttempts,
    onProgressUpdate,
    onPhaseCompletion,
    onAnalysisComplete,
    onError,
    onConfidenceUpdate,
  ]);

  // Connect to session
  const connect = useCallback((newSessionId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join-session', newSessionId);
    }
  }, []);

  // Disconnect from session
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Register event listener
  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  }, []);

  // Unregister event listener
  const off = useCallback((event: string, callback?: (...args: any[]) => void) => {
    if (socketRef.current) {
      if (callback) {
        socketRef.current.off(event, callback);
      } else {
        socketRef.current.off(event);
      }
    }
  }, []);

  // Emit event
  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    on,
    off,
    emit,
  };
}
