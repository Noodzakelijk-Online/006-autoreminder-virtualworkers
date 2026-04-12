/**
 * Task Cache Utility
 * Caches fetched tasks with a 5-minute TTL to reduce API calls
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number; // in milliseconds
}

class TaskCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get cached data if it exists and hasn't expired
   */
  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    const age = now - entry.timestamp;

    // Check if cache has expired
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cache data with optional TTL override
   */
  set(key: string, data: any, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL,
    });
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Clear all cache entries (alias for invalidateAll)
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics for debugging
   */
  getStats(): {
    size: number;
    keys: string[];
    entries: Array<{ key: string; age: number; ttl: number; expired: boolean }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => {
      const age = now - entry.timestamp;
      return {
        key,
        age,
        ttl: entry.ttl,
        expired: age > entry.ttl,
      };
    });

    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      entries,
    };
  }
}

// Export singleton instance
export const taskCache = new TaskCache();

// Cache keys
export const CACHE_KEYS = {
  TIMELINE_TASKS: 'timeline-tasks',
  TASK_TYPES: 'task-types',
  TASK_DETAILS: (id: string) => `task-details-${id}`,
} as const;
