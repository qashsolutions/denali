/**
 * API Configuration
 *
 * Centralized API endpoints and model configuration.
 */

import { BRAND } from "./brand";

export const API_CONFIG = {
  /** Claude/Anthropic configuration */
  claude: {
    /** Chat model: Sonnet 4.5 (fast, good for conversation + tool calls) */
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
    /** Appeal model: Opus 4.5 (slower, better quality for complex letter generation) */
    appealModel: process.env.ANTHROPIC_APPEAL_MODEL || "claude-opus-4-5-20251101",
    maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || "4096", 10),
    maxToolIterations: parseInt(process.env.CLAUDE_MAX_TOOL_ITERATIONS || "5", 10),
    /** Per-iteration timeout in ms (prevents single API call from hanging) */
    iterationTimeoutMs: parseInt(process.env.CLAUDE_ITERATION_TIMEOUT || "60000", 10),
  },

  /** MCP (Model Context Protocol) endpoints */
  mcp: {
    cmsCoverage: process.env.CMS_COVERAGE_MCP_URL || "https://mcp.deepsense.ai/cms_coverage/mcp",
    npiRegistry: process.env.NPI_REGISTRY_MCP_URL || "https://mcp.deepsense.ai/npi_registry/mcp",
    pubmed: process.env.PUBMED_MCP_URL || "https://mcp.deepsense.ai/pubmed/mcp",
    icd10: process.env.ICD10_MCP_URL || "https://mcp.deepsense.ai/icd10/mcp",
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
