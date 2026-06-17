/**
 * Phase 1 mobile — upload pipeline shared types.
 *
 * Wave 2 / mobile-upload-parse-builder.
 *
 * Wire-level shapes for the `/api/parse-report` round-trip. Kept in this
 * module (not in `@/contracts`) because contracts are frozen and this is
 * consumer-side glue. The shapes mirror the route's request/response;
 * if the route shape ever changes, update both sides together.
 */

import type {
  CodeSystem,
  ObservationCategory,
  ReportType as DalReportType,
} from "@/contracts";

/** Wire-level report type — string-literal union, matches the route. */
export type ReportTypeWire = DalReportType;

/**
 * A single extracted observation returned by `/api/parse-report`. The
 * server emits `category` and `code_system` from a controlled enum; we
 * narrow to the DAL types here so the review UI can pass them straight
 * to `LocalDataDAL.insertObservation`.
 */
export interface ExtractedObservation {
  category: ObservationCategory;
  code_system: CodeSystem;
  code: string;
  display: string;
  value_num: number | null;
  value_text: string | null;
  unit: string | null;
  effective_at: string;
  /** Confidence 0..1 — surfaced in the review UI to nudge user inspection. */
  confidence: number;
  /** Short excerpt from the source text for review-screen citation. */
  source_text: string;
  /**
   * The report's OWN printed reference interval, verbatim (e.g. "8-61"), if
   * present — storage/citation only, never our own range. Optional: older
   * parse responses (pre-RAG backend) don't emit it.
   */
  reference_range?: string | null;
  /**
   * The report's OWN abnormal flag, copied verbatim from the report
   * (its "H"/"High"/"L"/"Critical" column) — NEVER a flag we infer. Drives
   * the sourced RAG chip. Optional for the same back-compat reason; when
   * absent the client falls back to scanning `source_text`.
   */
  abnormal_flag?: "normal" | "low" | "high" | "critical" | null;
}

export interface ParseReportResponse {
  observations: ExtractedObservation[];
  // NOTE: the backend still returns a model-written `summary`, but the client
  // DELIBERATELY does not type or surface it — a free-text LLM summary can
  // drift into diagnosis. The review screen shows the deterministic
  // `summarizeReport()` (report-only counts) and the stored report summary is
  // a factual value count. Intentional client/wire divergence: do NOT re-add
  // `summary` here without a clinical-boundary review of every consumer.
}

/** Internal review-UI row state. Tracks user edits + accept/reject. */
export interface ReviewRowState {
  /** The original parsed observation — never mutated. Stored for audit. */
  original: ExtractedObservation;
  /** The current (potentially edited) observation, ready to commit. */
  edited: ExtractedObservation;
  /** Whether the user has marked this row to be saved. */
  accepted: boolean;
}
