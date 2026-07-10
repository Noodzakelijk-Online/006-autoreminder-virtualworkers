import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
  onTaskCompleted?: (data: any) => void;
  onTaskRescheduled?: (data: any) => void;
  onTaskPriorityChanged?: (data: any) => void;
  onCacheInvalidated?: () => void;
}

interface WebSocketStatus {
  connected: boolean;
  connectedClients: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>({
    connected: false,
    connectedClients: 0,
  });

  // Keep a ref to options so event handlers always call the latest callbacks
  // without the socket connection needing to restart.
  // This is the key fix: updating optionsRef.current synchronously on every render
  // means we never need to include callbacks in the useEffect dependency array.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    // Get user from the key written by useAuth hook
    const userStr = localStorage.getItem('manus-runtime-user-info');
    if (!userStr || userStr === 'null' || userStr === 'undefined') {
      console.warn('[WebSocket] No user found, skipping connection');
      return;
    }

    let user: any;
    try {
      user = JSON.parse(userStr);
    } catch {
      console.warn('[WebSocket] Failed to parse user info, skipping connection');
      return;
    }

    if (!user?.id || !user?.openId) {
      console.warn('[WebSocket] User missing id/openId, skipping connection');
      return;
    }

    // Connect to WebSocket server — runs ONCE on mount (empty deps []).
    // Previously the deps were [options.onTaskCompleted, ...] which caused new
    // function references on every render → rapid connect/disconnect loop.
    const socket = io({
      path: '/ws',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 3000,
      reconnectionDelayMax: 15000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('[WebSocket] Connected');
      setStatus(prev => ({ ...prev, connected: true }));

      // Authenticate with server
      socket.emit('authenticate', {
        userId: user.id,
        userOpenId: user.openId,
      });
    });

    socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
      setStatus({ connected: false, connectedClients: 0 });
    });

    socket.on('authenticated', (data: { success: boolean; connectedClients: number }) => {
      console.log('[WebSocket] Authenticated', data);
      setStatus(prev => ({ ...prev, connectedClients: data.connectedClients }));
    });

    // Task events — always read from ref so latest callback is used without reconnecting
    socket.on('task:completed', (data: any) => {
      console.log('[WebSocket] Task completed', data);
      optionsRef.current.onTaskCompleted?.(data);
    });

    socket.on('task:rescheduled', (data: any) => {
      console.log('[WebSocket] Task rescheduled', data);
      optionsRef.current.onTaskRescheduled?.(data);
    });

    // Cache events
    socket.on('cache:invalidated', () => {
      console.log('[WebSocket] Cache invalidated');
      optionsRef.current.onCacheInvalidated?.();
    });

    socket.on('task:priority-changed', (data: any) => {
      console.log('[WebSocket] Task priority changed:', data);
      optionsRef.current.onTaskPriorityChanged?.(data);
    });

    // Reconnection events
    socket.on('reconnect', (attemptNumber: number) => {
      console.log(`[WebSocket] Reconnected after ${attemptNumber} attempts`);
    });

    socket.on('reconnect_error', (error: Error) => {
      console.error('[WebSocket] Reconnection error:', error);
    });

    socket.on('reconnect_failed', () => {
      console.error('[WebSocket] Reconnection failed');
    });

    // Cleanup on unmount only — socket stays alive for the full component lifetime
    return () => {
      console.log('[WebSocket] Disconnecting');
      socket.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- empty deps intentional; callbacks are read via ref

  // Helper functions to emit events
  const emitTaskComplete = (data: { taskId: string; isCompleted: boolean }) => {
    socketRef.current?.emit('task:complete', data);
  };

  const emitTaskReschedule = (data: any) => {
    socketRef.current?.emit('task:reschedule', data);
  };

  const emitCacheInvalidate = () => {
    socketRef.current?.emit('cache:invalidate');
  };

  return {
    status,
    emitTaskComplete,
    emitTaskReschedule,
    emitCacheInvalidate,
  };
}
