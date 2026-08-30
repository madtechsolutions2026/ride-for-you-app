import Redis from 'ioredis';

// High-speed In-Memory Cache Store (fallback with 0ms overhead)
interface CacheEntry {
  data: any;
  expiresAt: number;
}

const memoryStore = new Map<string, CacheEntry>();

let redisClient: Redis | null = null;
let isRedisConnected = false;

// Initialize Redis if REDIS_URL is provided in .env
if (process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
    });

    redisClient.connect().then(() => {
      isRedisConnected = true;
      console.log('⚡ Redis Cache Connected (Jet Speed active)');
    }).catch((err) => {
      console.log('ℹ️ Redis not available, using High-Speed In-Memory Cache (<0.1ms latency)');
      isRedisConnected = false;
    });
  } catch (e) {
    console.log('ℹ️ Using High-Speed In-Memory Cache (<0.1ms latency)');
  }
}

/**
 * Get cached item by key
 */
export async function getCache<T>(key: string): Promise<T | null> {
  // Check Redis if connected
  if (isRedisConnected && redisClient) {
    try {
      const raw = await redisClient.get(key);
      if (raw) return JSON.parse(raw);
    } catch (err) {
      // Fallback to memory
    }
  }

  // Memory cache fallback
  const entry = memoryStore.get(key);
  if (entry) {
    if (Date.now() <= entry.expiresAt) {
      return entry.data as T;
    }
    memoryStore.delete(key);
  }

  return null;
}

/**
 * Set cached item with TTL in seconds (default 120s)
 */
export async function setCache(key: string, data: any, ttlSeconds = 120): Promise<void> {
  // Save to Memory
  memoryStore.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });

  // Save to Redis if connected
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(data), 'EX', ttlSeconds);
    } catch (err) {}
  }
}

/**
 * Invalidate cache key or pattern
 */
export async function delCache(key: string): Promise<void> {
  memoryStore.delete(key);

  if (isRedisConnected && redisClient) {
    try {
      await redisClient.del(key);
    } catch (err) {}
  }
}

/**
 * Invalidate all keys matching a prefix
 */
export async function delCachePrefix(prefix: string): Promise<void> {
  for (const k of memoryStore.keys()) {
    if (k.startsWith(prefix)) {
      memoryStore.delete(k);
    }
  }

  if (isRedisConnected && redisClient) {
    try {
      const keys = await redisClient.keys(`${prefix}*`);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch (err) {}
  }
}
