/**
 * Request Queue Service
 * Batches and deduplicates simultaneous API requests to reduce external API calls
 */

interface PendingRequest<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  timestamp: number;
  timeout: NodeJS.Timeout;
}

interface QueueMetrics {
  totalRequests: number;
  deduplicatedRequests: number;
  activeRequests: number;
  timeoutErrors: number;
  deduplicationRate: number;
}

class RequestQueue {
  private pendingRequests: Map<string, PendingRequest<any>> = new Map();
  private metrics = {
    totalRequests: 0,
    deduplicatedRequests: 0,
    timeoutErrors: 0,
  };
  private readonly defaultTimeout = 30000; // 30 seconds

  /**
   * Execute a request with deduplication
   * If an identical request is already in progress, return the same promise
   */
  async execute<T>(
    key: string,
    executor: () => Promise<T>,
    timeoutMs: number = this.defaultTimeout
  ): Promise<T> {
    this.metrics.totalRequests++;

    // Check if identical request is already pending
    const existing = this.pendingRequests.get(key);
    if (existing) {
      this.metrics.deduplicatedRequests++;
      console.log(`[RequestQueue] Deduplicating request: ${key}`);
      return existing.promise;
    }

    // Create new pending request
    let resolveFunc: (value: T) => void;
    let rejectFunc: (error: any) => void;

    const promise = new Promise<T>((resolve, reject) => {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    // Set timeout
    const timeout = setTimeout(() => {
      this.metrics.timeoutErrors++;
      this.pendingRequests.delete(key);
      rejectFunc(new Error(`Request timeout after ${timeoutMs}ms: ${key}`));
    }, timeoutMs);

    const pending: PendingRequest<T> = {
      promise,
      resolve: resolveFunc!,
      reject: rejectFunc!,
      timestamp: Date.now(),
      timeout,
    };

    this.pendingRequests.set(key, pending);

    console.log(`[RequestQueue] Executing new request: ${key}`);

    // Execute the actual request
    try {
      const result = await executor();
      
      // Clear timeout and resolve all waiting promises
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(key);
      pending.resolve(result);
      
      return result;
    } catch (error) {
      // Clear timeout and reject all waiting promises
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(key);
      pending.reject(error);
      
      throw error;
    }
  }

  /**
   * Get current queue metrics
   */
  getMetrics(): QueueMetrics {
    const deduplicationRate = this.metrics.totalRequests > 0
      ? (this.metrics.deduplicatedRequests / this.metrics.totalRequests) * 100
      : 0;

    return {
      totalRequests: this.metrics.totalRequests,
      deduplicatedRequests: this.metrics.deduplicatedRequests,
      activeRequests: this.pendingRequests.size,
      timeoutErrors: this.metrics.timeoutErrors,
      deduplicationRate,
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      deduplicatedRequests: 0,
      timeoutErrors: 0,
    };
  }

  /**
   * Clear all pending requests (useful for cleanup)
   */
  clearAll(): void {
    this.pendingRequests.forEach((pending, key) => {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Queue cleared'));
    });
    this.pendingRequests.clear();
  }

  /**
   * Get pending request keys (for debugging)
   */
  getPendingKeys(): string[] {
    return Array.from(this.pendingRequests.keys());
  }

  /**
   * Check if a request is pending
   */
  isPending(key: string): boolean {
    return this.pendingRequests.has(key);
  }

  /**
   * Get age of pending request in milliseconds
   */
  getPendingAge(key: string): number | null {
    const pending = this.pendingRequests.get(key);
    if (!pending) return null;
    return Date.now() - pending.timestamp;
  }
}

// Singleton instance
const requestQueue = new RequestQueue();

export { requestQueue, RequestQueue };
export type { QueueMetrics };
