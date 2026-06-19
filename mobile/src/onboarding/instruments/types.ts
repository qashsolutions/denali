/**
 * Validated instrument types — Phase 1 mobile.
 *
 * Each instrument is defined as a typed module exporting:
 *   - `id`              — stable code used for the SUMMARY observation
 *   - `codeSystem`      — "LOINC" when an official LOINC panel exists,
 *                         "internal" otherwise (MRS / ADAM / IPSS).
 *   - `displayName`     — human-readable instrument name
 *   - `items`           — canonical published items in order
 *   - `responseOptions` — per-instrument scale labels
 *   - `score(responses)` — pure scoring function (no side effects)
 *
 * The screen renders the items, collects responses, calls `score`, and
 * writes one observation per item PLUS one summary observation with
 * `value_num = score`.
 */

export type InstrumentId =
  | "PHQ-9"
  | "PHQ-2"
  | "GAD-7"
  | "AUDIT-C"
  | "Epworth"
  | "MRS"
  | "ADAM"
  | "IPSS";

/** Per-instrument response shape. */
export type InstrumentResponses = ReadonlyArray<number | null>;

export interface InstrumentItem {
  /** 1-based item number as published. */
  number: number;
  /** Exact published wording — DO NOT paraphrase. */
  text: string;
  /** Stable per-item code used for the per-item observation. */
  itemCode: string;
}

export interface ResponseOption {
  value: number;
  label: string;
  /**
   * Optional short italic hint shown under the label to calibrate a
   * self-rating scale (e.g. what "Mild" vs "Severe" means). This is
   * Denali-authored CALIBRATION copy — NOT part of a verbatim validated
   * instrument — so it must only describe perceived intensity, never a
   * diagnosis or recommendation, and its wording is clinical-review gated.
   */
  helperText?: string;
  /**
   * Governance flag for `helperText`: `true` while the calibration copy is
   * pending a named clinical reviewer's sign-off; `false` once cleared.
   * REQUIRED whenever `helperText` is set — enforced by
   * `instruments/__tests__/helperTextGovernance.test.ts` so no un-reviewed
   * calibration copy ships silently (mirrors InterpretationBand.provisional).
   */
  helperTextProvisional?: boolean;
}

export interface InstrumentDefinition {
  id: InstrumentId;
  /** LOINC panel code (e.g. 44249-1 for PHQ-9) when available. */
  loincCode: string;
  /** "LOINC" when loincCode is an official LOINC panel; "internal" otherwise. */
  codeSystem: "LOINC" | "internal";
  displayName: string;
  items: ReadonlyArray<InstrumentItem>;
  responseOptions: ReadonlyArray<ResponseOption>;
  /** Compute the canonical score. Returns null if any required item is unanswered. */
  score(responses: InstrumentResponses): number | null;
  /** Optional clinical hint shown alongside the score. Plain language. */
  interpret?: (score: number) => string;
}
