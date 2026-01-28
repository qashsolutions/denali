/**
 * Cache Configuration
 *
 * Centralized cache settings including TTLs and limits.
 */

/** Time constants in milliseconds */
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

/**
 * Cache TTL (Time-To-Live) configuration by API type
 * Values in milliseconds
 */
export const CACHE_TTL = {
  /** NPI data rarely changes - 24 hours */
  NPI: parseInt(process.env.CACHE_TTL_NPI || String(24 * HOUR), 10),

  /** PubMed articles - 12 hours */
  PUBMED: parseInt(process.env.CACHE_TTL_PUBMED || String(12 * HOUR), 10),

  /** NCD policies may update - 6 hours */
  NCD: parseInt(process.env.CACHE_TTL_NCD || String(6 * HOUR), 10),

  /** LCD policies may update - 6 hours */
  LCD: parseInt(process.env.CACHE_TTL_LCD || String(6 * HOUR), 10),

  /** ICD-10 codes are stable - 24 hours */
  ICD10: parseInt(process.env.CACHE_TTL_ICD10 || String(24 * HOUR), 10),

  /** CPT codes are stable - 24 hours */
  CPT: parseInt(process.env.CACHE_TTL_CPT || String(24 * HOUR), 10),

  /** SAD list is stable - 24 hours */
  SAD: parseInt(process.env.CACHE_TTL_SAD || String(24 * HOUR), 10),

  /** Default TTL for unspecified types - 1 hour */
  DEFAULT: parseInt(process.env.CACHE_TTL_DEFAULT || String(HOUR), 10),
} as const;

/**
 * Cache size limits
 */
export const CACHE_LIMITS = {
  /** Maximum entries per cache type */
  maxEntries: parseInt(process.env.CACHE_MAX_ENTRIES || "1000", 10),

  /** Cleanup interval in milliseconds */
  cleanupInterval: parseInt(process.env.CACHE_CLEANUP_INTERVAL || String(HOUR), 10),
} as const;

/**
 * Get TTL for a specific cache type
 */
export function getCacheTTL(type: keyof typeof CACHE_TTL): number {
  return CACHE_TTL[type] ?? CACHE_TTL.DEFAULT;
}

/**
 * Check if a cached entry is still valid
 */
export function isCacheValid(timestamp: number, ttl: number): boolean {
  return Date.now() - timestamp < ttl;
}
