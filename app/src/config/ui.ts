/**
 * UI Configuration
 *
 * Centralized UI text, starter questions, and display settings.
 */

/**
 * Starter questions shown on empty chat state
 */
export const STARTER_QUESTIONS = [
  "Will Medicare cover my MRI?",
  "What does my doctor need to document?",
  "Help me appeal a denial",
  "How do I know if a service is covered?",
] as const;

/**
 * Time-based greeting configuration
 * Hours are in 24-hour format
 */
export const GREETING_CONFIG = {
  morning: {
    start: 5,
    end: 12,
    greeting: "Good morning",
  },
  afternoon: {
    start: 12,
    end: 17,
    greeting: "Good afternoon",
  },
  evening: {
    start: 17,
    end: 21,
    greeting: "Good evening",
  },
  night: {
    start: 21,
    end: 5,
    greeting: "Hi there",
  },
} as const;

/**
 * Get time-based greeting
 */
export function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();

  if (hour >= GREETING_CONFIG.morning.start && hour < GREETING_CONFIG.morning.end) {
    return GREETING_CONFIG.morning.greeting;
  }
  if (hour >= GREETING_CONFIG.afternoon.start && hour < GREETING_CONFIG.afternoon.end) {
    return GREETING_CONFIG.afternoon.greeting;
  }
  if (hour >= GREETING_CONFIG.evening.start && hour < GREETING_CONFIG.evening.end) {
    return GREETING_CONFIG.evening.greeting;
  }
  return GREETING_CONFIG.night.greeting;
}

/**
 * Medicare-specific constants (regulatory, not configurable)
 */
export const MEDICARE_CONSTANTS = {
  /** First-level appeal deadline in days (42 CFR 405.904) */
  APPEAL_DEADLINE_DAYS: 120,

  /** Reconsideration deadline in days */
  RECONSIDERATION_DEADLINE_DAYS: 180,
} as const;

/**
 * Accessibility settings
 */
export const ACCESSIBILITY_CONFIG = {
  /** Minimum font size in pixels */
  minFontSize: 16,

  /** Minimum touch target size in pixels */
  minTouchTarget: 44,

  /** Default high contrast mode */
  defaultHighContrast: false,
} as const;
