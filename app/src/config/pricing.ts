/**
 * Pricing Configuration
 *
 * Centralized pricing values for the application.
 * These can be overridden via environment variables.
 */

export const PRICING = {
  /** Number of free appeals before paywall */
  FREE_APPEAL_LIMIT: 3,

  /** Single appeal one-time payment */
  SINGLE_APPEAL: {
    amount: parseInt(process.env.NEXT_PUBLIC_PRICE_SINGLE_APPEAL || "10", 10),
    currency: "USD",
    label: "One-time",
    stripePriceId: process.env.STRIPE_PRICE_SINGLE || "price_single_appeal",
  },

  /** Unlimited monthly subscription */
  UNLIMITED_MONTHLY: {
    amount: parseInt(process.env.NEXT_PUBLIC_PRICE_UNLIMITED_MONTHLY || "25", 10),
    currency: "USD",
    label: "per month",
    stripePriceId: process.env.STRIPE_PRICE_UNLIMITED || "price_unlimited_monthly",
  },
} as const;

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

// DEAD CODE — No consumers. Callers use formatPrice(PRICING.UNLIMITED_MONTHLY.amount) directly.
// Commented out 2026-02-06.
// export function getUnlimitedPrice(): string {
//   return formatPrice(PRICING.UNLIMITED_MONTHLY.amount);
// }
