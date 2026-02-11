/**
 * Pricing Configuration
 *
 * Centralized pricing values for the application.
 * These can be overridden via environment variables.
 */

export const PRICING = {
  /** Trial duration in days (CMS criteria A4) */
  TRIAL_DURATION_DAYS: 14,

  /** Appeal credits granted with trial */
  TRIAL_APPEAL_CREDITS: 1 as number,

  /** Appeal credits reset monthly for subscribers */
  MONTHLY_APPEAL_CREDITS: 3 as number,

  /** Daily chat message limits */
  CHAT_LIMITS: {
    /** Unauthenticated users */
    ANON: 1 as number,
    /** Trial users (active trial) */
    TRIAL: 3 as number,
    /** Per-appeal purchasers */
    PER_APPEAL: 5 as number,
    /** Monthly subscribers (0 = unlimited) */
    PAID: 0 as number,
  },

  /** Single appeal one-time payment */
  SINGLE_APPEAL: {
    amount: parseInt(process.env.NEXT_PUBLIC_PRICE_SINGLE_APPEAL || "10", 10),
    currency: "USD",
    label: "One-time",
    stripePriceId: process.env.STRIPE_PRICE_PAY_PER_CLAIM || "price_single_appeal",
  },

  /** Monthly subscription (3 appeals/month + unlimited chat) */
  MONTHLY: {
    amount: parseInt(process.env.NEXT_PUBLIC_PRICE_UNLIMITED_MONTHLY || "20", 10),
    currency: "USD",
    label: "per month",
    appealLimit: 3 as number,
    stripePriceId: process.env.STRIPE_PRICE_UNLIMITED_MONTHLY || "price_unlimited_monthly",
  },
  /** File upload size limits (bytes). 0 = disabled (anon), -1 = unlimited (admin). */
  UPLOAD_LIMITS: {
    ANON: 0 as number,
    TRIAL: 2 * 1024 * 1024 as number,
    PER_APPEAL: 6 * 1024 * 1024 as number,
    MONTHLY: 10 * 1024 * 1024 as number,
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
    case "monthly":
      return PRICING.UPLOAD_LIMITS.MONTHLY;
    case "per_appeal":
      return PRICING.UPLOAD_LIMITS.PER_APPEAL;
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

// DEAD CODE — No consumers. Callers use formatPrice(PRICING.SINGLE_APPEAL.amount) directly.
// Commented out 2026-02-06.
// export function getSingleAppealPrice(): string {
//   return formatPrice(PRICING.SINGLE_APPEAL.amount);
// }

// DEAD CODE — No consumers. Callers use formatPrice(PRICING.MONTHLY.amount) directly.
// Commented out 2026-02-06.
// export function getMonthlyPrice(): string {
//   return formatPrice(PRICING.MONTHLY.amount);
// }
