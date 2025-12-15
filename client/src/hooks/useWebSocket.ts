import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
  onTaskCompleted?: (data: any) => void;
  onTaskRescheduled?: (data: any) => void;
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

  useEffect(() => {
    // Get user from localStorage (set by OAuth)
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      console.warn('[WebSocket] No user found, skipping connection');
      return;
    }

    const user = JSON.parse(userStr);

    // Connect to WebSocket server
    const socket = io({
      path: '/ws',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
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

    // Task events
    socket.on('task:completed', (data: any) => {
      console.log('[WebSocket] Task completed', data);
      options.onTaskCompleted?.(data);
    });

    socket.on('task:rescheduled', (data: any) => {
      console.log('[WebSocket] Task rescheduled', data);
      options.onTaskRescheduled?.(data);
    });

    // Cache events
    socket.on('cache:invalidated', () => {
      console.log('[WebSocket] Cache invalidated');
      options.onCacheInvalidated?.();
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

    // Cleanup on unmount
    return () => {
      console.log('[WebSocket] Disconnecting');
      socket.disconnect();
    };
  }, [options.onTaskCompleted, options.onTaskRescheduled, options.onCacheInvalidated]);

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
