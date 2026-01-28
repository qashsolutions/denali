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
 * Medicare-specific constants (regulatory values by year)
 *
 * These values are set by CMS annually and should be updated each year.
 * Future enhancement: These could be stored in Supabase and learned/updated
 * from user-provided data patterns.
 */
export const MEDICARE_CONSTANTS = {
  /** First-level appeal deadline in days (42 CFR 405.904) */
  APPEAL_DEADLINE_DAYS: 120,

  /** Reconsideration deadline in days */
  RECONSIDERATION_DEADLINE_DAYS: 180,

  /**
   * Annual thresholds by year
   * These are CMS-published values that change annually
   */
  ANNUAL_THRESHOLDS: {
    2024: {
      /** ALJ hearing amount in controversy threshold */
      ALJ_THRESHOLD: 180,
      /** Federal court amount in controversy threshold */
      FEDERAL_COURT_THRESHOLD: 1840,
      /** Part B deductible */
      PART_B_DEDUCTIBLE: 240,
    },
    2025: {
      ALJ_THRESHOLD: 190,
      FEDERAL_COURT_THRESHOLD: 1900,
      PART_B_DEDUCTIBLE: 257,
    },
    2026: {
      ALJ_THRESHOLD: 200,
      FEDERAL_COURT_THRESHOLD: 1960,
      PART_B_DEDUCTIBLE: 265,
    },
  } as Record<number, { ALJ_THRESHOLD: number; FEDERAL_COURT_THRESHOLD: number; PART_B_DEDUCTIBLE: number }>,

  /**
   * Get threshold for the current year (or most recent available)
   */
  getCurrentThresholds() {
    const currentYear = new Date().getFullYear();
    const years = Object.keys(this.ANNUAL_THRESHOLDS)
      .map(Number)
      .sort((a, b) => b - a);

    // Return current year if available, otherwise most recent year
    for (const year of years) {
      if (year <= currentYear) {
        return { year, ...this.ANNUAL_THRESHOLDS[year] };
      }
    }
    // Fallback to most recent year if all are in the future
    const latestYear = years[0];
    return { year: latestYear, ...this.ANNUAL_THRESHOLDS[latestYear] };
  },
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
