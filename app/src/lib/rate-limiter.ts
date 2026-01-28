/**
 * Rate Limiting & Retry Logic
 *
 * Implements:
 * - Token bucket rate limiting per API
 * - Exponential backoff with jitter for retries
 * - Circuit breaker pattern for failing APIs
 */

import {
  RATE_LIMITS,
  RETRY_CONFIG,
  CIRCUIT_BREAKER_CONFIG,
} from "@/config";

// Re-export for backwards compatibility
export { RATE_LIMITS, RETRY_CONFIG, CIRCUIT_BREAKER_CONFIG };

// Token bucket rate limiter
interface TokenBucket {
  tokens: number;
  lastRefill: number;
  requestsPerMinute: number;
  burstSize: number;
}

// Circuit breaker state
interface CircuitBreaker {
  state: "closed" | "open" | "half-open";
  failures: number;
  lastFailure: number;
  halfOpenSuccesses: number;
}

// Rate limiter state per API
const rateLimiters: Map<string, TokenBucket> = new Map();
const circuitBreakers: Map<string, CircuitBreaker> = new Map();

/**
 * Get or create a rate limiter for an API
 */
function getRateLimiter(
  apiName: string,
  config?: { requestsPerMinute: number; burstSize: number }
): TokenBucket {
  let limiter = rateLimiters.get(apiName);

  if (!limiter) {
    const defaultConfig =
      RATE_LIMITS[apiName as keyof typeof RATE_LIMITS] || RATE_LIMITS.DEFAULT;
    const finalConfig = config || defaultConfig;

    limiter = {
      tokens: finalConfig.burstSize,
      lastRefill: Date.now(),
      requestsPerMinute: finalConfig.requestsPerMinute,
      burstSize: finalConfig.burstSize,
    };
    rateLimiters.set(apiName, limiter);
  }

  return limiter;
}

/**
 * Refill tokens based on time elapsed
 */
function refillTokens(limiter: TokenBucket): void {
  const now = Date.now();
  const elapsed = now - limiter.lastRefill;
  const tokensToAdd = (elapsed / 60000) * limiter.requestsPerMinute;

  limiter.tokens = Math.min(limiter.burstSize, limiter.tokens + tokensToAdd);
  limiter.lastRefill = now;
}

/**
 * Try to acquire a token for making a request
 */
export function tryAcquireToken(apiName: string): boolean {
  const limiter = getRateLimiter(apiName);
  refillTokens(limiter);

  if (limiter.tokens >= 1) {
    limiter.tokens -= 1;
    return true;
  }

  return false;
}

/**
 * Get time until next token is available (in ms)
 */
export function getTimeUntilNextToken(apiName: string): number {
  const limiter = getRateLimiter(apiName);
  refillTokens(limiter);

  if (limiter.tokens >= 1) {
    return 0;
  }

  const tokensNeeded = 1 - limiter.tokens;
  const msPerToken = 60000 / limiter.requestsPerMinute;
  return Math.ceil(tokensNeeded * msPerToken);
}

/**
 * Wait for a token to become available
 */
export async function waitForToken(apiName: string): Promise<void> {
  const waitTime = getTimeUntilNextToken(apiName);
  if (waitTime > 0) {
    await sleep(waitTime);
  }

  // Try to acquire, should succeed now
  if (!tryAcquireToken(apiName)) {
    // Edge case: contention, wait a bit more
    await sleep(100);
    tryAcquireToken(apiName);
  }
}

/**
 * Get or create a circuit breaker for an API
 */
function getCircuitBreaker(apiName: string): CircuitBreaker {
  let breaker = circuitBreakers.get(apiName);

  if (!breaker) {
    breaker = {
      state: "closed",
      failures: 0,
      lastFailure: 0,
      halfOpenSuccesses: 0,
    };
    circuitBreakers.set(apiName, breaker);
  }

  return breaker;
}

/**
 * Check if circuit allows request
 */
export function isCircuitClosed(apiName: string): boolean {
  const breaker = getCircuitBreaker(apiName);
  const now = Date.now();

  switch (breaker.state) {
    case "closed":
      return true;

    case "open":
      // Check if reset timeout has passed
      if (now - breaker.lastFailure >= CIRCUIT_BREAKER_CONFIG.resetTimeoutMs) {
        breaker.state = "half-open";
        breaker.halfOpenSuccesses = 0;
        return true;
      }
      return false;

    case "half-open":
      // Allow limited requests in half-open state
      return breaker.halfOpenSuccesses < CIRCUIT_BREAKER_CONFIG.halfOpenRequests;
  }
}

/**
 * Record a successful request
 */
export function recordSuccess(apiName: string): void {
  const breaker = getCircuitBreaker(apiName);

  if (breaker.state === "half-open") {
    breaker.halfOpenSuccesses++;
    if (breaker.halfOpenSuccesses >= CIRCUIT_BREAKER_CONFIG.halfOpenRequests) {
      // Close the circuit
      breaker.state = "closed";
      breaker.failures = 0;
    }
  } else if (breaker.state === "closed") {
    // Reset failure count on success
    breaker.failures = Math.max(0, breaker.failures - 1);
  }
}

/**
 * Record a failed request
 */
export function recordFailure(apiName: string): void {
  const breaker = getCircuitBreaker(apiName);
  breaker.failures++;
  breaker.lastFailure = Date.now();

  if (breaker.state === "half-open") {
    // Immediately open circuit on failure in half-open state
    breaker.state = "open";
  } else if (
    breaker.state === "closed" &&
    breaker.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold
  ) {
    breaker.state = "open";
  }
}

/**
 * Get circuit breaker status
 */
export function getCircuitStatus(apiName: string): {
  state: string;
  failures: number;
  canRequest: boolean;
} {
  const breaker = getCircuitBreaker(apiName);
  return {
    state: breaker.state,
    failures: breaker.failures,
    canRequest: isCircuitClosed(apiName),
  };
}

/**
 * Reset circuit breaker (for testing/admin)
 */
export function resetCircuitBreaker(apiName: string): void {
  const breaker = getCircuitBreaker(apiName);
  breaker.state = "closed";
  breaker.failures = 0;
  breaker.lastFailure = 0;
  breaker.halfOpenSuccesses = 0;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateBackoffDelay(attempt: number): number {
  const baseDelay =
    RETRY_CONFIG.initialDelayMs *
    Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
  const cappedDelay = Math.min(baseDelay, RETRY_CONFIG.maxDelayMs);

  // Add jitter (±20%)
  const jitter = cappedDelay * RETRY_CONFIG.jitterFactor;
  const randomJitter = (Math.random() * 2 - 1) * jitter;

  return Math.round(cappedDelay + randomJitter);
}

/**
 * Retry error types
 */
export class RetryableError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "RetryableError";
  }
}

export class NonRetryableError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "NonRetryableError";
  }
}

export class CircuitOpenError extends Error {
  constructor(apiName: string) {
    super(`Circuit breaker is open for ${apiName}. Try again later.`);
    this.name = "CircuitOpenError";
  }
}

export class RateLimitError extends Error {
  constructor(
    apiName: string,
    public readonly retryAfterMs: number
  ) {
    super(`Rate limit exceeded for ${apiName}. Retry after ${retryAfterMs}ms.`);
    this.name = "RateLimitError";
  }
}

/**
 * Determine if an error is retryable
 */
function isRetryable(error: unknown): boolean {
  if (error instanceof NonRetryableError) {
    return false;
  }

  if (error instanceof RetryableError) {
    return true;
  }

  if (error instanceof Error) {
    // Network errors are retryable
    if (
      error.message.includes("network") ||
      error.message.includes("timeout") ||
      error.message.includes("ECONNRESET") ||
      error.message.includes("ETIMEDOUT")
    ) {
      return true;
    }

    // Check for HTTP status codes in error message
    const statusMatch = error.message.match(/status[:\s]*(\d+)/i);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      // 429 (rate limit), 500, 502, 503, 504 are retryable
      return status === 429 || (status >= 500 && status < 600);
    }
  }

  // Default to retryable for unknown errors
  return true;
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  apiName: string,
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? RETRY_CONFIG.maxRetries;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check circuit breaker
    if (!isCircuitClosed(apiName)) {
      throw new CircuitOpenError(apiName);
    }

    // Check rate limit (wait if needed on first attempt)
    if (attempt === 0) {
      await waitForToken(apiName);
    } else {
      // On retry, check if we can make the request
      if (!tryAcquireToken(apiName)) {
        const waitTime = getTimeUntilNextToken(apiName);
        throw new RateLimitError(apiName, waitTime);
      }
    }

    try {
      const result = await fn();
      recordSuccess(apiName);
      return result;
    } catch (error) {
      lastError = error;
      recordFailure(apiName);

      // Check if we should retry
      if (attempt < maxRetries && isRetryable(error)) {
        const delay = calculateBackoffDelay(attempt);
        options.onRetry?.(attempt + 1, error, delay);
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }

  throw lastError;
}

/**
 * Wrap a fetch function with rate limiting, retry, and circuit breaker
 */
export function createRateLimitedFetcher(apiName: string) {
  return async function rateLimitedFetch(
    url: string,
    options?: RequestInit
  ): Promise<Response> {
    return withRetry(apiName, async () => {
      const response = await fetch(url, options);

      // Handle rate limiting from server
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000;
        throw new RateLimitError(apiName, waitMs);
      }

      // Handle server errors (retryable)
      if (response.status >= 500) {
        throw new RetryableError(
          `Server error: ${response.status}`,
          response.status
        );
      }

      // Handle client errors (not retryable except 429)
      if (response.status >= 400) {
        throw new NonRetryableError(
          `Client error: ${response.status}`,
          response.status
        );
      }

      return response;
    });
  };
}

/**
 * Get all rate limiter and circuit breaker stats
 */
export function getAllStats(): {
  rateLimiters: Array<{
    name: string;
    tokens: number;
    requestsPerMinute: number;
  }>;
  circuitBreakers: Array<{ name: string; state: string; failures: number }>;
} {
  const rlStats: Array<{
    name: string;
    tokens: number;
    requestsPerMinute: number;
  }> = [];
  const cbStats: Array<{ name: string; state: string; failures: number }> = [];

  for (const [name, limiter] of rateLimiters.entries()) {
    refillTokens(limiter);
    rlStats.push({
      name,
      tokens: Math.floor(limiter.tokens * 100) / 100,
      requestsPerMinute: limiter.requestsPerMinute,
    });
  }

  for (const [name, breaker] of circuitBreakers.entries()) {
    cbStats.push({
      name,
      state: breaker.state,
      failures: breaker.failures,
    });
  }

  return {
    rateLimiters: rlStats,
    circuitBreakers: cbStats,
  };
}

/**
 * Reset all rate limiters and circuit breakers (for testing)
 */
export function resetAll(): void {
  rateLimiters.clear();
  circuitBreakers.clear();
}
