/**
 * Rate Limiting Configuration
 *
 * Centralized rate limiting, retry, and circuit breaker settings.
 */

/**
 * Rate limits per API type
 * requestsPerMinute: sustained rate
 * burstSize: max concurrent requests
 */
export const RATE_LIMITS = {
  /** NPI Registry - generous limits */
  NPI: {
    requestsPerMinute: parseInt(process.env.RATE_LIMIT_NPI_RPM || "60", 10),
    burstSize: parseInt(process.env.RATE_LIMIT_NPI_BURST || "10", 10),
  },

  /** PubMed - strict rate limits (NCBI policy) */
  PUBMED: {
    requestsPerMinute: parseInt(process.env.RATE_LIMIT_PUBMED_RPM || "3", 10),
    burstSize: parseInt(process.env.RATE_LIMIT_PUBMED_BURST || "3", 10),
  },

  /** CMS MCP - moderate limits */
  CMS_MCP: {
    requestsPerMinute: parseInt(process.env.RATE_LIMIT_CMS_RPM || "30", 10),
    burstSize: parseInt(process.env.RATE_LIMIT_CMS_BURST || "5", 10),
  },

  /** Claude API - generous limits */
  CLAUDE: {
    requestsPerMinute: parseInt(process.env.RATE_LIMIT_CLAUDE_RPM || "50", 10),
    burstSize: parseInt(process.env.RATE_LIMIT_CLAUDE_BURST || "10", 10),
  },

  /** Default for unspecified APIs */
  DEFAULT: {
    requestsPerMinute: parseInt(process.env.RATE_LIMIT_DEFAULT_RPM || "30", 10),
    burstSize: parseInt(process.env.RATE_LIMIT_DEFAULT_BURST || "5", 10),
  },
} as const;

/**
 * Retry configuration for failed requests
 */
export const RETRY_CONFIG = {
  /** Maximum number of retry attempts */
  maxRetries: parseInt(process.env.RETRY_MAX_ATTEMPTS || "3", 10),

  /** Initial delay before first retry (ms) */
  initialDelayMs: parseInt(process.env.RETRY_INITIAL_DELAY || "1000", 10),

  /** Maximum delay between retries (ms) */
  maxDelayMs: parseInt(process.env.RETRY_MAX_DELAY || "30000", 10),

  /** Backoff multiplier (exponential) */
  backoffMultiplier: parseFloat(process.env.RETRY_BACKOFF_MULTIPLIER || "2"),

  /** Jitter factor (0-1) to randomize delays */
  jitterFactor: parseFloat(process.env.RETRY_JITTER_FACTOR || "0.2"),
} as const;

/**
 * Circuit breaker configuration
 */
export const CIRCUIT_BREAKER_CONFIG = {
  /** Number of failures before opening circuit */
  failureThreshold: parseInt(process.env.CIRCUIT_FAILURE_THRESHOLD || "5", 10),

  /** Time to wait before attempting recovery (ms) */
  resetTimeoutMs: parseInt(process.env.CIRCUIT_RESET_TIMEOUT || "60000", 10),

  /** Number of requests allowed in half-open state */
  halfOpenRequests: parseInt(process.env.CIRCUIT_HALF_OPEN_REQUESTS || "2", 10),
} as const;

/**
 * Calculate retry delay with exponential backoff and jitter
 */
export function calculateRetryDelay(attempt: number): number {
  const baseDelay = RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
  const cappedDelay = Math.min(baseDelay, RETRY_CONFIG.maxDelayMs);
  const jitter = cappedDelay * RETRY_CONFIG.jitterFactor * (Math.random() * 2 - 1);
  return Math.round(cappedDelay + jitter);
}

/**
 * Get rate limit config for a specific API type
 */
export function getRateLimitConfig(type: keyof typeof RATE_LIMITS) {
  return RATE_LIMITS[type] ?? RATE_LIMITS.DEFAULT;
}
