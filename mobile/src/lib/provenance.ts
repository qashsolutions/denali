/**
 * Provenance record — SELF-PROMPTING RULES v2 § EVIDENCE & PROVENANCE
 * PIPELINE. Every curated clinical entry (interpretation bands/strings,
 * biomarker ranges, coded vocabularies) carries one of these.
 *
 * Lifecycle:
 *   - `review_status` starts "pending_clinical_review" on every entry CC
 *     authors. The ‡ provisional mark renders until a NAMED human review
 *     clears it — CC never sets "clinically_reviewed".
 *   - `pmid_or_code_system_version` + `retrieved_at` are filled by the
 *     terminology-verifier (PubMed / ICD-10 MCP connectors, dev/CI only).
 *     Unsourceable cutoffs are FLAGGED for the operator, never invented.
 *
 * Pure type module — no side effects, importable from node-env tests and
 * from both the interpretation table and the onboarding vocabularies
 * without creating a screens→onboarding dependency.
 */

export type ReviewStatus = "pending_clinical_review" | "clinically_reviewed";

export interface ProvenanceRecord {
  /** Human-readable citation or source statement (never empty). */
  source: string;
  /**
   * PMID for literature-sourced cutoffs; code-system version (e.g.
   * "ICD-10-CM 2026") for vocabularies. Null until the
   * terminology-verifier pins it.
   */
  pmid_or_code_system_version: string | null;
  /** ISO date the citation/code-set was last verified. Null until verified. */
  retrieved_at: string | null;
  /** CC never writes "clinically_reviewed" — named human review only. */
  review_status: ReviewStatus;
}
