/**
 * Pure helpers for the onboarding input primitives.
 *
 * Lives outside the component files so it can be unit-tested under
 * Node-only vitest (no jsdom, no React Native runtime). The components
 * import these helpers and stay focused on rendering.
 */
import type { CodeSystem } from "@/contracts";

// ─── Slider ───────────────────────────────────────────────────────────────

/**
 * Clamp `value` to the inclusive [min, max] range. Used by SliderInput's
 * tap-handler when the hit-target math rounds outside the configured range.
 */
export function clamp(value: number, min: number, max: number): number {
  // NaN-safety: NaN compares unordered with everything, so guard explicitly.
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Round `value` to the nearest multiple of `step`, anchored at `min`.
 * Used by SliderInput so the rendered value snaps to step boundaries
 * (e.g. severity 0..10 step 1, or BMI 15..50 step 0.5).
 */
export function snapToStep(value: number, min: number, step: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) {
    return value;
  }
  const offset = value - min;
  const snapped = Math.round(offset / step) * step + min;
  // Rounding to a fixed decimal count avoids accumulated FP error like
  // 0.30000000000000004 when step=0.1; we use the step's decimal count.
  const stepStr = String(step);
  const decimals = stepStr.includes(".")
    ? stepStr.split(".")[1].length
    : 0;
  return Number(snapped.toFixed(decimals));
}

/**
 * Total number of discrete positions the slider occupies. Used by the
 * component for hit-area math and the readout `n of N` indicator.
 * Returns 0 when the range is invalid.
 */
export function sliderStepCount(
  min: number,
  max: number,
  step: number,
): number {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step)) {
    return 0;
  }
  if (step <= 0 || max < min) return 0;
  return Math.floor((max - min) / step) + 1;
}

/**
 * Returns the value at a given step index (0-based). Inverse of the
 * tap-handler's `(value - min) / step` math.
 */
export function valueAtStepIndex(
  min: number,
  step: number,
  index: number,
): number {
  return snapToStep(min + step * index, min, step);
}

// ─── Autocomplete ─────────────────────────────────────────────────────────

export interface AutocompleteEntry {
  code: string;
  code_system: CodeSystem;
  display: string;
  aliases?: ReadonlyArray<string>;
}

/**
 * Case-insensitive, accent-insensitive (best-effort) substring filter.
 * Matches on `display` and any `aliases`. Returns entries in insertion
 * order — vocabularies are curated, so original ordering is meaningful
 * (most-common first). When the query is empty, returns the full list.
 */
export function filterAutocomplete<E extends AutocompleteEntry>(
  entries: ReadonlyArray<E>,
  query: string,
  limit?: number,
): ReadonlyArray<E> {
  const q = normalizeForMatch(query);
  if (q.length === 0) {
    return typeof limit === "number" ? entries.slice(0, limit) : entries;
  }
  const out: E[] = [];
  for (const e of entries) {
    if (entryMatches(e, q)) {
      out.push(e);
      if (typeof limit === "number" && out.length >= limit) break;
    }
  }
  return out;
}

function entryMatches(entry: AutocompleteEntry, normQuery: string): boolean {
  if (normalizeForMatch(entry.display).includes(normQuery)) return true;
  const aliases = entry.aliases ?? [];
  for (const a of aliases) {
    if (normalizeForMatch(a).includes(normQuery)) return true;
  }
  return false;
}

/**
 * Lower-case and strip diacritics for forgiving substring matching.
 * Stripping diacritics is best-effort via NFD normalization — keeps
 * "Crohn's" / "Crohn" / "crohn" matching the same and helps users on
 * keyboards that don't share the curated vocabulary's character set.
 */
export function normalizeForMatch(s: string): string {
  if (typeof s !== "string") return "";
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Build the "uncoded other" autocomplete result for free-text input
 * the user opted into via `allowOther`. The `code` is derived from the
 * text so longitudinal grouping still works ("my own term" → stable
 * code "denali.user.<slug>"). `isUncoded: true` flags the entry for
 * future re-coding by an analyst.
 */
export interface AutocompleteSelection {
  code: string;
  code_system: CodeSystem;
  display: string;
  isUncoded?: boolean;
}

export function buildOtherSelection(rawText: string): AutocompleteSelection | null {
  const trimmed = rawText.trim();
  if (trimmed.length === 0) return null;
  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  if (slug.length === 0) return null;
  return {
    code: `denali.user.${slug}`,
    code_system: "internal",
    display: trimmed,
    isUncoded: true,
  };
}

// ─── Family history (structured) ──────────────────────────────────────────

/**
 * USCDI-aligned relation set. Order is the order shown in the picker.
 * "Other" is intentionally last; it's a free-text fallback when none of
 * the structured options apply (e.g., aunt / uncle / cousin).
 */
export type FamilyRelation =
  | "parent"
  | "sibling"
  | "child"
  | "grandparent"
  | "aunt_or_uncle"
  | "other";

export const FAMILY_RELATION_LABELS: Readonly<
  Record<FamilyRelation, string>
> = {
  parent: "Parent",
  sibling: "Sibling",
  child: "Child",
  grandparent: "Grandparent",
  aunt_or_uncle: "Aunt or uncle",
  other: "Other relative",
};

export interface FamilyHistoryDraft {
  relation: FamilyRelation | null;
  /** From the AutocompleteInput — null when the user hasn't picked yet. */
  selection: AutocompleteSelection | null;
  /** Optional integer age at onset. */
  onsetAge: number | null;
}

export interface FamilyHistoryRecord {
  relation: FamilyRelation;
  conditionCode: string;
  conditionCodeSystem: CodeSystem;
  conditionDisplay: string;
  /** `true` when the user typed an "other" not in the vocabulary. */
  conditionIsUncoded: boolean;
  onsetAge: number | null;
}

/**
 * Can the family-history draft be saved? A record is complete when
 * relation + condition selection are present. Onset age is optional.
 */
export function canSaveFamilyHistory(draft: FamilyHistoryDraft): boolean {
  return draft.relation != null && draft.selection != null;
}

/**
 * Build the saveable record from a draft. Returns null when required
 * fields are missing (caller must `canSaveFamilyHistory` first).
 */
export function buildFamilyHistoryRecord(
  draft: FamilyHistoryDraft,
): FamilyHistoryRecord | null {
  if (!canSaveFamilyHistory(draft)) return null;
  // Non-null guards because canSave is true here.
  const relation = draft.relation as FamilyRelation;
  const selection = draft.selection as AutocompleteSelection;
  return {
    relation,
    conditionCode: selection.code,
    conditionCodeSystem: selection.code_system,
    conditionDisplay: selection.display,
    conditionIsUncoded: selection.isUncoded === true,
    onsetAge:
      draft.onsetAge != null && Number.isFinite(draft.onsetAge)
        ? draft.onsetAge
        : null,
  };
}

/**
 * Build the `metadata_json` payload the IntakeOnboarding flow stores
 * alongside the `category="family_history"` observation. The DAL's
 * `metadata_json` column is `string | null`, so this returns the JSON
 * stringification ready for insert.
 */
export function familyHistoryMetadataJson(
  record: FamilyHistoryRecord,
): string {
  return JSON.stringify({
    relation: record.relation,
    onset_age: record.onsetAge,
    condition_display: record.conditionDisplay,
    condition_is_uncoded: record.conditionIsUncoded,
  });
}

/**
 * Round-trip helper for tests: parse the stored metadata JSON back into
 * the structured shape so the test can assert the relation + onset_age
 * landed correctly. Returns null on parse failure.
 */
export interface FamilyHistoryMetadataParsed {
  relation: string;
  onset_age: number | null;
  condition_display: string;
  condition_is_uncoded: boolean;
}

export function parseFamilyHistoryMetadata(
  json: string,
): FamilyHistoryMetadataParsed | null {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.relation !== "string") return null;
    if (typeof obj.condition_display !== "string") return null;
    if (typeof obj.condition_is_uncoded !== "boolean") return null;
    const age = obj.onset_age;
    const ageNorm =
      age == null
        ? null
        : typeof age === "number" && Number.isFinite(age)
          ? age
          : null;
    return {
      relation: obj.relation,
      onset_age: ageNorm,
      condition_display: obj.condition_display,
      condition_is_uncoded: obj.condition_is_uncoded,
    };
  } catch {
    return null;
  }
}

// ─── Likert ───────────────────────────────────────────────────────────────

/**
 * Validate a Likert response: the value must be an integer in [0, N-1]
 * where N is the number of options the instrument supplies. The
 * component uses this for accessibility hints and the test for
 * round-trip correctness.
 */
export function isValidLikertValue(
  value: number,
  optionCount: number,
): boolean {
  return (
    Number.isInteger(value) &&
    optionCount > 0 &&
    value >= 0 &&
    value < optionCount
  );
}

// ─── Closure-safety snapshot assembly ─────────────────────────────────────

/**
 * Build a new responses array with `value` set at `idx`. The caller is
 * an auto-advance handler that has just received a new tap and needs to
 * pass the updated snapshot to the persist function EXPLICITLY (to
 * avoid the stale-closure class — pre-tap closure-captured state would
 * lack the just-set last value, causing the persist call to write
 * `null` for the final item).
 *
 * Returns a fresh array of length `total`; never mutates the input.
 * If `prev` is undefined/null, seeds with all-nulls. If `prev` is the
 * wrong length, pads (with null) or truncates to `total`.
 *
 * Used by InstrumentsScreen for both the PHQ-2/PHQ-9 mood path and the
 * GAD-7 / AUDIT-C / Epworth / IPSS / MRS / ADAM menu path.
 */
export function assembleNextResponses(
  prev: ReadonlyArray<number | null> | null | undefined,
  idx: number,
  value: number,
  total: number,
): Array<number | null> {
  const base: Array<number | null> = Array.from({ length: total }, (_, i) =>
    prev != null && i < prev.length ? prev[i] : null,
  );
  base[idx] = value;
  return base;
}

/**
 * Build a new keyed-answers map with `key` set to `value`. Same closure-
 * safety pattern as `assembleNextResponses` — IntakeOnboardingScreen's
 * lifestyle path calls this so the auto-advance persist sees the just-
 * tapped value (previously the closure captured the pre-tap lifestyle
 * map and the last response was lost on persist).
 *
 * Generic over the WHOLE shape `T` (not just <K, V>) so callers preserve
 * the full record type through the call. Otherwise TS narrows `K` to the
 * single literal key passed in and consumers lose access to the other
 * properties on the returned object.
 *
 * Returns a fresh object; never mutates the input.
 */
export function assembleNextKeyedAnswers<T extends object>(
  prev: Readonly<T>,
  key: keyof T,
  value: T[keyof T],
): T {
  return { ...prev, [key]: value } as T;
}
