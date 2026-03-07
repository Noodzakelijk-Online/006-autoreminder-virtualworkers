/**
 * Batch Operations API Client
 * Handles all communication with the backend batch operations service
 */

export interface BatchOperationRequest {
  operationType: 're_analyze' | 'reschedule' | 'conflict_resolution' | 'optimization';
  taskIds?: string[];
  options?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
}

export interface BatchOperationResponse {
  jobId: string;
  operationType: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface BatchOperationProgress {
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

class BatchOperationsClient {
  private baseUrl = '/api/scheduling';

  /**
   * Start a new batch operation
   */
  async startBatchOperation(request: BatchOperationRequest): Promise<BatchOperationResponse> {
    const response = await fetch(`${this.baseUrl}/batch-start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start batch operation');
      } else {
        throw new Error(`Failed to start batch operation (HTTP ${response.status})`);
      }
    }

    return response.json();
  }

  /**
   * Get batch operation progress
   */
  async getBatchProgress(jobId: string): Promise<BatchOperationProgress> {
    const response = await fetch(`${this.baseUrl}/batch/${jobId}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to get batch progress');
    }

    return response.json();
  }

  /**
   * Cancel a batch operation
   */
  async cancelBatchOperation(jobId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/batch/${jobId}/cancel`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to cancel batch operation');
    }
  }

  /**
   * Get all batch operations for current user
   */
  async getAllBatchOperations(): Promise<BatchOperationResponse[]> {
    const response = await fetch(`${this.baseUrl}/batch-history`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to get batch operations');
    }

    // Check if response is JSON before parsing
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('[BatchOperationsClient] Invalid content type:', contentType);
      throw new Error('Invalid response format: expected JSON');
    }

    const data = await response.json();
    // Handle both direct array and wrapped response
    return Array.isArray(data) ? data : (data.operations || []);
  }

  /**
   * Reschedule a single task
   */
  async rescheduleSingleTask(
    taskId: string,
    newScheduledDate: Date,
    newScheduledTime: string
  ): Promise<{ success: boolean; conflictDetected: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/reschedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        taskId,
        newScheduledDate: newScheduledDate.toISOString().split('T')[0],
        newScheduledTime,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to reschedule task');
    }

    return response.json();
  }

  /**
   * Undo a task reschedule
   */
  async undoReschedule(taskId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/undo/${taskId}`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to undo reschedule');
    }

    return response.json();
  }

  /**
   * Get schedule history for a task
   */
  async getScheduleHistory(taskId: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/history/${taskId}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to get schedule history');
    }

    return response.json();
  }

  /**
   * Get keyboard shortcuts
   */
  async getKeyboardShortcuts(): Promise<Record<string, string>> {
    const response = await fetch(`${this.baseUrl}/shortcuts`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to get keyboard shortcuts');
    }

    return response.json();
  }

  /**
   * Save keyboard shortcut customization
   */
  async saveKeyboardShortcut(action: string, keys: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/shortcuts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ action, keys }),
    });

    if (!response.ok) {
      throw new Error('Failed to save keyboard shortcut');
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<Record<string, any>> {
    const response = await fetch(`${this.baseUrl}/metrics`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to get performance metrics');
    }

    return response.json();
  }
}

// Singleton instance
let instance: BatchOperationsClient | null = null;

export function getBatchOperationsClient(): BatchOperationsClient {
  if (!instance) {
    instance = new BatchOperationsClient();
  }
  return instance;
}

export default BatchOperationsClient;
