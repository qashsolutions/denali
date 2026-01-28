/**
 * Configuration Index
 *
 * Barrel export for all configuration modules.
 */

// Pricing
export {
  PRICING,
  formatPrice,
  getSingleAppealPrice,
  getUnlimitedPrice,
} from "./pricing";

// API
export { API_CONFIG, getBaseUrl } from "./api";

// Cache
export {
  CACHE_TTL,
  CACHE_LIMITS,
  getCacheTTL,
  isCacheValid,
} from "./cache";

// Rate Limits
export {
  RATE_LIMITS,
  RETRY_CONFIG,
  CIRCUIT_BREAKER_CONFIG,
  calculateRetryDelay,
  getRateLimitConfig,
} from "./rate-limits";

// Learning
export {
  CONFIDENCE_CONFIG,
  FEEDBACK_CONFIG,
  PRUNING_CONFIG,
  ENTITY_EXTRACTION_CONFIG,
  calculateConfidenceAfterFeedback,
  shouldIncludeInPrompt,
  shouldPrune,
} from "./learning";

// UI
export {
  STARTER_QUESTIONS,
  GREETING_CONFIG,
  getTimeBasedGreeting,
  MEDICARE_CONSTANTS,
  ACCESSIBILITY_CONFIG,
} from "./ui";
