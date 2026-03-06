/**
 * Pricing Configuration
 *
 * 5-tier model: Anonymous → Trial → Starter → Plus → Unlimited
 * Chat uses Sonnet 4.6; appeals always use Opus 4.6.
 * All paid plans are monthly subscriptions (no one-time payments).
 */

export const PRICING = {
  /** Trial duration in days (CMS criteria A4) */
  TRIAL_DURATION_DAYS: 14,

  /** Appeal credits granted with trial (none — trial has no appeal access) */
  TRIAL_APPEAL_CREDITS: 0 as number,

  /** Daily chat message limits per plan (0 = unlimited) */
  CHAT_LIMITS: {
    /** Free trial users (no sign-in required) */
    TRIAL: 10 as number,
    /** Starter subscribers */
    STARTER: 20 as number,
    /** Plus subscribers */
    PLUS: 20 as number,
    /** Unlimited subscribers (0 = unlimited) */
    UNLIMITED: 0 as number,
  },

  /** Weekly frequency limits: max days per week a user can chat (0 = unlimited) */
  WEEKLY_LIMITS: {
    TRIAL: 1 as number,
    STARTER: 1 as number,
    PLUS: 0 as number,
    UNLIMITED: 0 as number,
  },

  /** Starter subscription ($10/month, 1 appeal credit) */
  STARTER: {
    amount: 10,
    currency: "USD",
    label: "per month",
    appealCredits: 1 as number,
    stripePriceId: process.env.STRIPE_PRICE_PAY_PER_CLAIM || "price_starter",
  },

  /** Plus subscription ($20/month, 2 appeal credits) */
  PLUS: {
    amount: 20,
    currency: "USD",
    label: "per month",
    appealCredits: 2 as number,
    stripePriceId: process.env.STRIPE_PRICE_MONTHLY || "price_plus",
  },

  /** Unlimited subscription ($60/month, unlimited appeals) */
  UNLIMITED: {
    amount: 60,
    currency: "USD",
    label: "per month",
    appealCredits: -1 as number, // -1 = unlimited
    stripePriceId: process.env.STRIPE_PRICE_UNLIMITED || "price_unlimited",
  },

  /** File upload size limits (bytes). 0 = disabled (anon), -1 = unlimited (admin). */
  UPLOAD_LIMITS: {
    ANON: 0 as number,
    TRIAL: 2 * 1024 * 1024 as number,
    STARTER: 4 * 1024 * 1024 as number,
    PLUS: 6 * 1024 * 1024 as number,
    UNLIMITED: 10 * 1024 * 1024 as number,
    ADMIN: -1 as number,
  },
} as const;

/**
 * Get the upload size limit for a user's plan.
 * Returns 0 for anon (disabled), -1 for admin (unlimited).
 * Returns byte limit for other plans.
 */
export function getUploadLimitForPlan(
  plan: string | null,
  isAdmin: boolean,
  isAuthenticated: boolean
): number {
  if (!isAuthenticated) return PRICING.UPLOAD_LIMITS.ANON;
  if (isAdmin) return PRICING.UPLOAD_LIMITS.ADMIN;
  switch (plan) {
    case "unlimited":
      return PRICING.UPLOAD_LIMITS.UNLIMITED;
    case "plus":
      return PRICING.UPLOAD_LIMITS.PLUS;
    case "starter":
      return PRICING.UPLOAD_LIMITS.STARTER;
    case "trial":
      return PRICING.UPLOAD_LIMITS.TRIAL;
    default:
      return PRICING.UPLOAD_LIMITS.TRIAL;
  }
}

/**
 * Format bytes as human-readable string (e.g., "2 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/**
 * Format price for display
 */
export function formatPrice(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
