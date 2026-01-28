/**
 * Caching Layer
 *
 * In-memory cache with TTL support for external API calls.
 * Reduces API calls and improves response time.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
  hitCount: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

// Default TTLs for different API types (in milliseconds)
export const CACHE_TTL = {
  NPI: 24 * 60 * 60 * 1000, // 24 hours - NPI data rarely changes
  PUBMED: 12 * 60 * 60 * 1000, // 12 hours - research articles are stable
  NCD: 6 * 60 * 60 * 1000, // 6 hours - policies can update
  LCD: 6 * 60 * 60 * 1000, // 6 hours - policies can update
  ICD10: 24 * 60 * 60 * 1000, // 24 hours - codes are stable
  CPT: 24 * 60 * 60 * 1000, // 24 hours - codes are stable
  SAD: 24 * 60 * 60 * 1000, // 24 hours - SAD list is stable
  DEFAULT: 60 * 60 * 1000, // 1 hour default
} as const;

// Maximum cache entries per type to prevent memory issues
const MAX_CACHE_ENTRIES = 1000;

class Cache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    oldestEntry: null,
    newestEntry: null,
  };
  private readonly defaultTTL: number;
  private readonly maxEntries: number;
  private readonly name: string;

  constructor(
    name: string,
    defaultTTL: number = CACHE_TTL.DEFAULT,
    maxEntries: number = MAX_CACHE_ENTRIES
  ) {
    this.name = name;
    this.defaultTTL = defaultTTL;
    this.maxEntries = maxEntries;
  }

  /**
   * Generate a cache key from query parameters
   */
  private generateKey(params: Record<string, unknown>): string {
    const sortedKeys = Object.keys(params).sort();
    const keyParts = sortedKeys.map(
      (key) => `${key}:${JSON.stringify(params[key])}`
    );
    return keyParts.join("|");
  }

  /**
   * Get a value from the cache
   */
  get(params: Record<string, unknown>): T | null {
    const key = this.generateKey(params);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateStats();
      return null;
    }

    // Update hit count and stats
    entry.hitCount++;
    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set a value in the cache
   */
  set(params: Record<string, unknown>, value: T, ttl?: number): void {
    const key = this.generateKey(params);
    const now = Date.now();
    const expiresAt = now + (ttl || this.defaultTTL);

    // Evict old entries if at max capacity
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: now,
      hitCount: 0,
    });

    this.updateStats();
  }

  /**
   * Check if a key exists and is not expired
   */
  has(params: Record<string, unknown>): boolean {
    const key = this.generateKey(params);
    const entry = this.cache.get(key);

    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.updateStats();
      return false;
    }

    return true;
  }

  /**
   * Delete a specific entry
   */
  delete(params: Record<string, unknown>): boolean {
    const key = this.generateKey(params);
    const result = this.cache.delete(key);
    this.updateStats();
    return result;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      oldestEntry: null,
      newestEntry: null,
    };
  }

  /**
   * Clear expired entries
   */
  clearExpired(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleared++;
      }
    }

    this.updateStats();
    return cleared;
  }

  /**
   * Evict the oldest entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Update cache statistics
   */
  private updateStats(): void {
    this.stats.size = this.cache.size;

    if (this.cache.size === 0) {
      this.stats.oldestEntry = null;
      this.stats.newestEntry = null;
      return;
    }

    let oldest = Infinity;
    let newest = 0;

    for (const entry of this.cache.values()) {
      if (entry.createdAt < oldest) oldest = entry.createdAt;
      if (entry.createdAt > newest) newest = entry.createdAt;
    }

    this.stats.oldestEntry = oldest;
    this.stats.newestEntry = newest;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { name: string; hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      name: this.name,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Get or set pattern - fetches from cache or calls loader function
   */
  async getOrSet(
    params: Record<string, unknown>,
    loader: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get(params);
    if (cached !== null) {
      return cached;
    }

    const value = await loader();
    this.set(params, value, ttl);
    return value;
  }
}

// Singleton cache instances for each API type
export const npiCache = new Cache<unknown>("NPI", CACHE_TTL.NPI);
export const pubmedCache = new Cache<unknown>("PubMed", CACHE_TTL.PUBMED);
export const ncdCache = new Cache<unknown>("NCD", CACHE_TTL.NCD);
export const lcdCache = new Cache<unknown>("LCD", CACHE_TTL.LCD);
export const icd10Cache = new Cache<unknown>("ICD10", CACHE_TTL.ICD10);
export const cptCache = new Cache<unknown>("CPT", CACHE_TTL.CPT);
export const sadCache = new Cache<unknown>("SAD", CACHE_TTL.SAD);

// Global cache manager
export const cacheManager = {
  npi: npiCache,
  pubmed: pubmedCache,
  ncd: ncdCache,
  lcd: lcdCache,
  icd10: icd10Cache,
  cpt: cptCache,
  sad: sadCache,

  /**
   * Clear all caches
   */
  clearAll(): void {
    npiCache.clear();
    pubmedCache.clear();
    ncdCache.clear();
    lcdCache.clear();
    icd10Cache.clear();
    cptCache.clear();
    sadCache.clear();
  },

  /**
   * Clear expired entries from all caches
   */
  clearAllExpired(): Record<string, number> {
    return {
      npi: npiCache.clearExpired(),
      pubmed: pubmedCache.clearExpired(),
      ncd: ncdCache.clearExpired(),
      lcd: lcdCache.clearExpired(),
      icd10: icd10Cache.clearExpired(),
      cpt: cptCache.clearExpired(),
      sad: sadCache.clearExpired(),
    };
  },

  /**
   * Get stats for all caches
   */
  getAllStats(): Array<CacheStats & { name: string; hitRate: number }> {
    return [
      npiCache.getStats(),
      pubmedCache.getStats(),
      ncdCache.getStats(),
      lcdCache.getStats(),
      icd10Cache.getStats(),
      cptCache.getStats(),
      sadCache.getStats(),
    ];
  },

  /**
   * Get aggregate stats
   */
  getAggregateStats(): {
    totalHits: number;
    totalMisses: number;
    totalSize: number;
    overallHitRate: number;
  } {
    const stats = this.getAllStats();
    const totalHits = stats.reduce((sum, s) => sum + s.hits, 0);
    const totalMisses = stats.reduce((sum, s) => sum + s.misses, 0);
    const totalSize = stats.reduce((sum, s) => sum + s.size, 0);
    const total = totalHits + totalMisses;

    return {
      totalHits,
      totalMisses,
      totalSize,
      overallHitRate: total > 0 ? totalHits / total : 0,
    };
  },
};

// Periodic cleanup (run every hour)
let cleanupInterval: NodeJS.Timeout | null = null;

export function startCacheCleanup(intervalMs: number = 60 * 60 * 1000): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  cleanupInterval = setInterval(() => {
    const cleared = cacheManager.clearAllExpired();
    console.log("[Cache] Cleared expired entries:", cleared);
  }, intervalMs);
}

export function stopCacheCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Export the Cache class for custom instances
export { Cache };
