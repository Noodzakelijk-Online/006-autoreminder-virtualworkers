import { useEffect } from 'react';
import { useToast } from './useToast';
import { useWebSocket } from './useWebSocket';

export interface TaskNotification {
  type: 'task:completed' | 'task:incomplete' | 'task:updated' | 'task:rescheduled';
  taskId: string;
  taskName?: string;
  userId?: string;
  timestamp?: string;
}

export function useWebSocketNotifications() {
  const { success, error, info } = useToast();
  const { status } = useWebSocket({
    onTaskCompleted: (data: TaskNotification) => {
      success(`✓ Task "${data.taskName || 'Untitled'}" marked as complete`);
    },
    onTaskRescheduled: (data: TaskNotification) => {
      info(`Task "${data.taskName || 'Untitled'}" has been rescheduled`);
    },
    onCacheInvalidated: () => {
      info('Tasks have been updated');
    },
  });

  return { isConnected: status.connected };
}
