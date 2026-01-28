/**
 * Learning System Configuration
 *
 * Centralized settings for the ML learning system including
 * confidence thresholds, feedback boosts, and pruning parameters.
 */

/**
 * Confidence thresholds for learned mappings
 */
export const CONFIDENCE_CONFIG = {
  /** Minimum confidence to include in prompt injection */
  minForPrompt: parseFloat(process.env.LEARNING_MIN_CONFIDENCE || "0.6"),

  /** Minimum confidence before pruning */
  minBeforePrune: parseFloat(process.env.LEARNING_PRUNE_THRESHOLD || "0.3"),

  /** Initial confidence for new mappings (before boost) */
  initial: parseFloat(process.env.LEARNING_INITIAL_CONFIDENCE || "0.5"),

  /** Maximum confidence value */
  max: 1.0,

  /** Minimum confidence value */
  min: 0.0,
} as const;

/**
 * Feedback boost/penalty values
 */
export const FEEDBACK_CONFIG = {
  /** Confidence boost for positive feedback (thumbs up) */
  positiveBoost: parseFloat(process.env.LEARNING_POSITIVE_BOOST || "0.1"),

  /** Confidence penalty for negative feedback (thumbs down) */
  negativePenalty: parseFloat(process.env.LEARNING_NEGATIVE_PENALTY || "0.15"),

  /** Boost for successful tool usage */
  toolSuccessBoost: parseFloat(process.env.LEARNING_TOOL_SUCCESS_BOOST || "0.05"),

  /** Boost for successful coverage path */
  coverageSuccessBoost: parseFloat(process.env.LEARNING_COVERAGE_BOOST || "0.1"),
} as const;

/**
 * Pruning configuration for old/low-confidence data
 */
export const PRUNING_CONFIG = {
  /** Maximum age in days before considering for pruning */
  maxAgeDays: parseInt(process.env.LEARNING_PRUNE_MAX_AGE || "90", 10),

  /** Minimum use count to be exempt from age-based pruning */
  minUsesToPreserve: parseInt(process.env.LEARNING_MIN_USES_PRESERVE || "5", 10),

  /** Batch size for pruning operations */
  batchSize: parseInt(process.env.LEARNING_PRUNE_BATCH_SIZE || "100", 10),
} as const;

/**
 * Entity extraction configuration
 */
export const ENTITY_EXTRACTION_CONFIG = {
  /** Minimum phrase length to extract */
  minPhraseLength: parseInt(process.env.LEARNING_MIN_PHRASE_LENGTH || "2", 10),

  /** Maximum phrase length to extract */
  maxPhraseLength: parseInt(process.env.LEARNING_MAX_PHRASE_LENGTH || "50", 10),

  /** Maximum entities to extract per type */
  maxEntitiesPerType: parseInt(process.env.LEARNING_MAX_ENTITIES || "10", 10),
} as const;

/**
 * Calculate new confidence after feedback
 */
export function calculateConfidenceAfterFeedback(
  currentConfidence: number,
  isPositive: boolean
): number {
  const adjustment = isPositive
    ? FEEDBACK_CONFIG.positiveBoost
    : -FEEDBACK_CONFIG.negativePenalty;

  const newConfidence = currentConfidence + adjustment;

  // Clamp to valid range
  return Math.max(CONFIDENCE_CONFIG.min, Math.min(CONFIDENCE_CONFIG.max, newConfidence));
}

/**
 * Check if a mapping should be included in prompt injection
 */
export function shouldIncludeInPrompt(confidence: number): boolean {
  return confidence >= CONFIDENCE_CONFIG.minForPrompt;
}

/**
 * Check if a mapping should be pruned
 */
export function shouldPrune(
  confidence: number,
  lastUsedDate: Date,
  useCount: number
): boolean {
  // Below minimum threshold
  if (confidence < CONFIDENCE_CONFIG.minBeforePrune) {
    return true;
  }

  // Check age-based pruning (unless heavily used)
  if (useCount < PRUNING_CONFIG.minUsesToPreserve) {
    const ageInDays = (Date.now() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays > PRUNING_CONFIG.maxAgeDays) {
      return true;
    }
  }

  return false;
}
