/**
 * Brand Configuration
 *
 * Centralized brand identity constants.
 * These are the single source of truth for brand-related values.
 */

export const BRAND = {
  /** Official brand name (no space) */
  NAME: "DenaliHealth",

  /** Primary domain (with www prefix as configured in Vercel) */
  DOMAIN: "www.denali.health",

  /** Full site URL */
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "https://www.denali.health",

  /** Parent company name */
  COMPANY_NAME: "Qash Solutions Inc",

  /** Company relationship prefix */
  COMPANY_PREFIX: "a unit of",

  /** Brand tagline */
  TAGLINE: "Medicare denials—addressed proactively",

  /** Copyright year (auto-updates) */
  get COPYRIGHT_YEAR() {
    return new Date().getFullYear();
  },

  /** Full copyright text */
  get COPYRIGHT_TEXT() {
    return `© ${this.COPYRIGHT_YEAR} ${this.NAME}. All rights reserved.`;
  },

  /** Full company attribution */
  get COMPANY_ATTRIBUTION() {
    return `${this.COMPANY_PREFIX} ${this.COMPANY_NAME}`;
  },
} as const;

/**
 * Get the full site URL
 * Prefers environment variable, falls back to brand constant
 */
export function getSiteUrl(): string {
  return BRAND.SITE_URL;
}

/**
 * Get brand name
 */
export function getBrandName(): string {
  return BRAND.NAME;
}
