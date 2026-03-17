/**
 * Trello Data Cache Service
 * Provides caching layer for Trello API data with TTL management
 */

import { getDb } from '../db';
import { 
  trelloCacheMetadata, 
  trelloCachedTasks, 
  trelloCachedBoards, 
  trelloCachedCards 
} from '../../drizzle/schema';
import { eq, and, lt } from 'drizzle-orm';

export interface CacheOptions {
  ttlSeconds?: number;
  forceRefresh?: boolean;
}

export interface CacheStats {
  cacheKey: string;
  hitCount: number;
  missCount: number;
  hitRate: number;
  lastFetched: Date | null;
  expiresAt: Date | null;
}

/**
 * Get cached tasks for a user
 */
export async function getCachedTasks(
  userId: number,
  userOpenId: string,
  options: CacheOptions = {}
): Promise<any[] | null> {
  const { ttlSeconds = 300, forceRefresh = false } = options;

  if (forceRefresh) {
    await invalidateCache(userId, userOpenId, 'tasks');
    return null;
  }

  const db = await getDb();
  if (!db) {
    console.error('Database not available');
    return null;
  }
  const now = new Date();

  // Check if cache exists and is valid
  const cacheMetadata = await db
    .select()
    .from(trelloCacheMetadata)
    .where(
      and(
        eq(trelloCacheMetadata.userId, userId),
        eq(trelloCacheMetadata.userOpenId, userOpenId),
        eq(trelloCacheMetadata.cacheKey, 'tasks')
      )
    )
    .limit(1);

  if (cacheMetadata.length === 0) {
    // Cache miss - no metadata
    await recordCacheMiss(userId, userOpenId, 'tasks', ttlSeconds);
    return null;
  }

  const metadata = cacheMetadata[0];

  // Check if cache is expired
  if (new Date(metadata.expiresAt) < now) {
    // Cache expired
    await recordCacheMiss(userId, userOpenId, 'tasks', ttlSeconds);
    return null;
  }

  // Get cached tasks
  const cachedTasks = await db
    .select()
    .from(trelloCachedTasks)
    .where(
      and(
        eq(trelloCachedTasks.userId, userId),
        eq(trelloCachedTasks.userOpenId, userOpenId)
      )
    )
    .limit(1);

  if (cachedTasks.length === 0) {
    // Cache miss - no data
    await recordCacheMiss(userId, userOpenId, 'tasks', ttlSeconds);
    return null;
  }

  // Cache hit
  await recordCacheHit(userId, userOpenId, 'tasks');

  try {
    return JSON.parse(cachedTasks[0].taskData);
  } catch (error) {
    console.error('Error parsing cached task data:', error);
    await invalidateCache(userId, userOpenId, 'tasks');
    return null;
  }
}

/**
 * Set cached tasks for a user
 */
export async function setCachedTasks(
  userId: number,
  userOpenId: string,
  tasks: any,
  ttlSeconds: number = 300
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error('Database not available');
    return;
  }
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  // Delete existing cache
  await db
    .delete(trelloCachedTasks)
    .where(
      and(
        eq(trelloCachedTasks.userId, userId),
        eq(trelloCachedTasks.userOpenId, userOpenId)
      )
    );

  // Insert new cache
  await db.insert(trelloCachedTasks).values({
    userId,
    userOpenId,
    taskData: JSON.stringify(tasks),
    cachedAt: now,
    expiresAt,
  });

  // Update or create metadata
  const existingMetadata = await db
    .select()
    .from(trelloCacheMetadata)
    .where(
      and(
        eq(trelloCacheMetadata.userId, userId),
        eq(trelloCacheMetadata.userOpenId, userOpenId),
        eq(trelloCacheMetadata.cacheKey, 'tasks')
      )
    )
    .limit(1);

  if (existingMetadata.length > 0) {
    await db
      .update(trelloCacheMetadata)
      .set({
        lastFetched: now,
        expiresAt,
        ttlSeconds,
        updatedAt: now,
      })
      .where(eq(trelloCacheMetadata.id, existingMetadata[0].id));
  } else {
    await db.insert(trelloCacheMetadata).values({
      userId,
      userOpenId,
      cacheKey: 'tasks',
      lastFetched: now,
      expiresAt,
      ttlSeconds,
      hitCount: 0,
      missCount: 0,
    });
  }
}

/**
 * Invalidate cache for a specific key
 */
export async function invalidateCache(
  userId: number,
  userOpenId: string,
  cacheKey: string
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error('Database not available');
    return;
  }

  // Delete cache data based on key
  if (cacheKey === 'tasks') {
    await db
      .delete(trelloCachedTasks)
      .where(
        and(
          eq(trelloCachedTasks.userId, userId),
          eq(trelloCachedTasks.userOpenId, userOpenId)
        )
      );
  } else if (cacheKey === 'boards') {
    await db
      .delete(trelloCachedBoards)
      .where(
        and(
          eq(trelloCachedBoards.userId, userId),
          eq(trelloCachedBoards.userOpenId, userOpenId)
        )
      );
  } else if (cacheKey.startsWith('cards:')) {
    const boardId = cacheKey.split(':')[1];
    await db
      .delete(trelloCachedCards)
      .where(
        and(
          eq(trelloCachedCards.userId, userId),
          eq(trelloCachedCards.userOpenId, userOpenId),
          eq(trelloCachedCards.boardId, boardId)
        )
      );
  }

  // Delete metadata
  await db
    .delete(trelloCacheMetadata)
    .where(
      and(
        eq(trelloCacheMetadata.userId, userId),
        eq(trelloCacheMetadata.userOpenId, userOpenId),
        eq(trelloCacheMetadata.cacheKey, cacheKey)
      )
    );
}

/**
 * Invalidate all cache for a user
 */
export async function invalidateAllCache(
  userId: number,
  userOpenId: string
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error('Database not available');
    return;
  }

  await db
    .delete(trelloCachedTasks)
    .where(
      and(
        eq(trelloCachedTasks.userId, userId),
        eq(trelloCachedTasks.userOpenId, userOpenId)
      )
    );

  await db
    .delete(trelloCachedBoards)
    .where(
      and(
        eq(trelloCachedBoards.userId, userId),
        eq(trelloCachedBoards.userOpenId, userOpenId)
      )
    );

  await db
    .delete(trelloCachedCards)
    .where(
      and(
        eq(trelloCachedCards.userId, userId),
        eq(trelloCachedCards.userOpenId, userOpenId)
      )
    );

  await db
    .delete(trelloCacheMetadata)
    .where(
      and(
        eq(trelloCacheMetadata.userId, userId),
        eq(trelloCacheMetadata.userOpenId, userOpenId)
      )
    );
}

/**
 * Clean up expired cache entries
 */
export async function cleanupExpiredCache(): Promise<number> {
  const db = await getDb();
  if (!db) {
    console.error('Database not available');
    return 0;
  }
  const now = new Date();

  // Get expired cache keys
  const expiredMetadata = await db
    .select()
    .from(trelloCacheMetadata)
    .where(lt(trelloCacheMetadata.expiresAt, now));

  let deletedCount = 0;

  for (const metadata of expiredMetadata) {
    await invalidateCache(metadata.userId, metadata.userOpenId, metadata.cacheKey);
    deletedCount++;
  }

  return deletedCount;
}

/**
 * Get cache statistics for a user
 */
export async function getCacheStats(
  userId: number,
  userOpenId: string
): Promise<CacheStats[]> {
  const db = await getDb();
  if (!db) {
    console.error('Database not available');
    return [];
  }

  const metadata = await db
    .select()
    .from(trelloCacheMetadata)
    .where(
      and(
        eq(trelloCacheMetadata.userId, userId),
        eq(trelloCacheMetadata.userOpenId, userOpenId)
      )
    );

  return metadata.map((m: any) => ({
    cacheKey: m.cacheKey,
    hitCount: m.hitCount,
    missCount: m.missCount,
    hitRate: m.hitCount + m.missCount > 0 
      ? (m.hitCount / (m.hitCount + m.missCount)) * 100 
      : 0,
    lastFetched: m.lastFetched,
    expiresAt: m.expiresAt,
  }));
}

/**
 * Record cache hit
 */
async function recordCacheHit(
  userId: number,
  userOpenId: string,
  cacheKey: string
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error('Database not available');
    return;
  }

  const metadata = await db
    .select()
    .from(trelloCacheMetadata)
    .where(
      and(
        eq(trelloCacheMetadata.userId, userId),
        eq(trelloCacheMetadata.userOpenId, userOpenId),
        eq(trelloCacheMetadata.cacheKey, cacheKey)
      )
    )
    .limit(1);

  if (metadata.length > 0) {
    await db
      .update(trelloCacheMetadata)
      .set({
        hitCount: metadata[0].hitCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(trelloCacheMetadata.id, metadata[0].id));
  }
}

/**
 * Record cache miss
 */
async function recordCacheMiss(
  userId: number,
  userOpenId: string,
  cacheKey: string,
  ttlSeconds: number
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error('Database not available');
    return;
  }

  const metadata = await db
    .select()
    .from(trelloCacheMetadata)
    .where(
      and(
        eq(trelloCacheMetadata.userId, userId),
        eq(trelloCacheMetadata.userOpenId, userOpenId),
        eq(trelloCacheMetadata.cacheKey, cacheKey)
      )
    )
    .limit(1);

  if (metadata.length > 0) {
    await db
      .update(trelloCacheMetadata)
      .set({
        missCount: metadata[0].missCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(trelloCacheMetadata.id, metadata[0].id));
  } else {
    // Create metadata on first miss
    const now = new Date();
    await db.insert(trelloCacheMetadata).values({
      userId,
      userOpenId,
      cacheKey,
      lastFetched: now,
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
      ttlSeconds,
      hitCount: 0,
      missCount: 1,
    });
  }
}
