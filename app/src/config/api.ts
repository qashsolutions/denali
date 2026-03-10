/**
 * API Configuration
 *
 * Centralized API endpoints and model configuration.
 */

import { BRAND } from "./brand";

export const API_CONFIG = {
  /** Claude configuration
   * Chat uses Sonnet 4.6 for cost efficiency; appeals use Opus 4.6 for quality.
   * Vercel/local: set ANTHROPIC_API_KEY → uses direct Anthropic API
   *   ANTHROPIC_MODEL=claude-sonnet-4-6-20260301
   *   ANTHROPIC_APPEAL_MODEL=claude-opus-4-6
   * ECS/Bedrock: no ANTHROPIC_API_KEY → IAM auth via task role
   *   ANTHROPIC_MODEL=arn:aws:bedrock:us-east-1:ACCOUNT:inference-profile/global.anthropic.claude-sonnet-4-6
   *   ANTHROPIC_APPEAL_MODEL=arn:aws:bedrock:us-east-1:ACCOUNT:inference-profile/global.anthropic.claude-opus-4-6-v1
   *   (prefix is "global." not "us.", no ":0" suffix, full ARN required)
   */
  claude: {
    /** Chat model — Sonnet 4.6 (direct API default) or Bedrock inference profile ID via ANTHROPIC_MODEL env */
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6-20260301",
    /** Appeal model — Opus 4.6 (direct API default) or Bedrock inference profile ID via ANTHROPIC_APPEAL_MODEL env */
    appealModel: process.env.ANTHROPIC_APPEAL_MODEL || "claude-opus-4-6",
    maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || "4096", 10),
    maxToolIterations: parseInt(process.env.CLAUDE_MAX_TOOL_ITERATIONS || "10", 10),
    /** Per-iteration timeout in ms (prevents single API call from hanging) */
    iterationTimeoutMs: parseInt(process.env.CLAUDE_ITERATION_TIMEOUT || "60000", 10),
  },

  /** Blue Button 2.0 (Medicare FHIR API) */
  blueButton: {
    baseUrl: process.env.BLUEBUTTON_BASE_URL || "https://sandbox.bluebutton.cms.gov",
    version: "v2",
    scopes: "patient/Patient.read patient/Coverage.read patient/ExplanationOfBenefit.read profile openid",
    callbackPath: "/api/fhir/callback",
  },

  /** ID.me OIDC identity verification */
  idme: {
    baseUrl: process.env.IDME_BASE_URL || "https://api.idmelabs.com",
    clientId: process.env.IDME_CLIENT_ID || "",
    clientSecret: process.env.IDME_CLIENT_SECRET || "",
    scope: "openid nist_ial2_aal2",
    callbackPath: "/api/auth/idme/callback",
  },

  /** Default pagination limits */
  defaults: {
    pageLimit: parseInt(process.env.DEFAULT_PAGE_LIMIT || "10", 10),
    maxPageLimit: parseInt(process.env.MAX_PAGE_LIMIT || "100", 10),
  },
} as const;

/**
 * Get the base URL for the application
 * Uses request origin in production, falls back to env var or localhost in dev
 */
export function getBaseUrl(requestOrigin?: string | null): string {
  // In production, always use request origin
  if (requestOrigin) {
    return requestOrigin;
  }

  // Check for explicit configuration
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Development fallback
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  // Production without origin - this shouldn't happen but handle gracefully
  console.warn("No origin provided and NEXT_PUBLIC_APP_URL not set");
  return BRAND.SITE_URL;
}
