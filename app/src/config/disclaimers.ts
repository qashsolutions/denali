/**
 * Centralized CMS-compliant disclaimers for AI-generated content and
 * medical information surfaces.
 *
 * These strings are the single source of truth for all user-facing
 * AI/medical-advice disclaimers, added in response to CMS Round-2
 * feedback on AI output accuracy and medical-advice language
 * (FTC guidance + CMS Interoperability Framework).
 *
 * Pick the variant that fits the available space:
 *   - DISCLAIMER_SHORT: inline captions (chat bubble, card footers)
 *   - DISCLAIMER_MEDIUM: page-level banners (AI-rendered pages)
 *   - DISCLAIMER_LONG: document footers (reports, appeal letters, emails, PDFs)
 */

export const DISCLAIMER_SHORT =
  "AI-generated · Can have errors · Not medical advice · Consult your healthcare provider";

export const DISCLAIMER_MEDIUM =
  "AI-generated analysis can have errors · Not medical advice · Consult your healthcare provider before making medical decisions";

export const DISCLAIMER_LONG =
  "This content is AI-generated and can have errors. It is not medical advice and is not a substitute for professional medical diagnosis or treatment. Please consult with a healthcare provider before making medical decisions. For medical emergencies, call 911.";
