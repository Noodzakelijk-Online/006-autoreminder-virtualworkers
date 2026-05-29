/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse and DDoS attacks
 */

import { Request, Response, NextFunction } from 'express';
import { getRedis, isRedisAvailable } from '../services/redis';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

// In-memory fallback when Redis is not available
const memoryStore = new Map<string, RateLimitInfo>();

/**
 * Clean up expired entries from memory store
 */
function cleanupMemoryStore(): void {
  const now = Date.now();
  for (const [key, info] of memoryStore.entries()) {
    if (info.resetTime < now) {
      memoryStore.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupMemoryStore, 5 * 60 * 1000);

/**
 * Get rate limit info from Redis or memory
 */
async function getRateLimitInfo(key: string): Promise<RateLimitInfo | null> {
  const redis = getRedis();
  
  if (redis && isRedisAvailable()) {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[RateLimit] Redis error:', error);
      // Fall through to memory store
    }
  }
  
  return memoryStore.get(key) || null;
}

/**
 * Set rate limit info in Redis or memory
 */
async function setRateLimitInfo(
  key: string,
  info: RateLimitInfo,
  ttlMs: number
): Promise<void> {
  const redis = getRedis();
  
  if (redis && isRedisAvailable()) {
    try {
      await redis.set(
        key,
        JSON.stringify(info),
        'PX',
        ttlMs
      );
      return;
    } catch (error) {
      console.error('[RateLimit] Redis error:', error);
      // Fall through to memory store
    }
  }
  
  memoryStore.set(key, info);
}

/**
 * Create rate limiter middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = config;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Generate key based on IP and user ID (if authenticated)
      const identifier = (req as any).user?.openId || req.ip || 'unknown';
      const key = `ratelimit:${req.path}:${identifier}`;
      
      const now = Date.now();
      const info = await getRateLimitInfo(key);
      
      if (!info || info.resetTime < now) {
        // Start new window
        const newInfo: RateLimitInfo = {
          count: 1,
          resetTime: now + windowMs,
        };
        await setRateLimitInfo(key, newInfo, windowMs);
        
        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', (maxRequests - 1).toString());
        res.setHeader('X-RateLimit-Reset', newInfo.resetTime.toString());
        
        return next();
      }
      
      // Check if limit exceeded
      if (info.count >= maxRequests) {
        const retryAfter = Math.ceil((info.resetTime - now) / 1000);
        
        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', info.resetTime.toString());
        res.setHeader('Retry-After', retryAfter.toString());
        
        res.status(429).json({
          error: message,
          retryAfter,
          limit: maxRequests,
          windowMs,
        });
        return;
      }
      
      // Increment counter
      info.count++;
      await setRateLimitInfo(key, info, info.resetTime - now);
      
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', (maxRequests - info.count).toString());
      res.setHeader('X-RateLimit-Reset', info.resetTime.toString());
      
      // Handle skip options
      if (skipSuccessfulRequests || skipFailedRequests) {
        const originalSend = res.send;
        res.send = function (body: any): Response {
          const statusCode = res.statusCode;
          const shouldSkip =
            (skipSuccessfulRequests && statusCode < 400) ||
            (skipFailedRequests && statusCode >= 400);
          
          if (shouldSkip) {
            // Decrement counter
            void (async () => {
              const currentInfo = await getRateLimitInfo(key);
              if (currentInfo) {
                currentInfo.count = Math.max(0, currentInfo.count - 1);
                await setRateLimitInfo(key, currentInfo, currentInfo.resetTime - Date.now());
              }
            })();
          }
          
          return originalSend.call(this, body);
        };
      }
      
      next();
    } catch (error) {
      console.error('[RateLimit] Error:', error);
      // On error, allow the request through
      next();
    }
  };
}

/**
 * Preset rate limiters for common use cases
 */

// Strict rate limit for authentication endpoints
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later',
  skipSuccessfulRequests: true,
});

// Standard rate limit for API endpoints
export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
  message: 'Too many requests, please slow down',
});

// Strict rate limit for expensive operations
export const expensiveOperationRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
  message: 'Too many expensive operations, please wait before retrying',
});

// Lenient rate limit for read operations
export const readRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 120, // 120 requests per minute
  message: 'Too many requests, please slow down',
  skipFailedRequests: true,
});

// Very strict rate limit for APTLSS generation
export const aptlssRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 generations per minute
  message: 'Too many APTLSS generation requests, please wait before retrying',
});

// Strict rate limit for ATIS analysis
export const atisRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 3, // 3 analyses per minute
  message: 'Too many ATIS analysis requests, please wait before retrying',
});
