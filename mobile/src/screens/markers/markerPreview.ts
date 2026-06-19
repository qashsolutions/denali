/**
 * markerPreview — dashboard preview rows for the "Your markers" card.
 *
 * Surfaces the user's latest marker VALUES (labs, vitals) on the dashboard so
 * saved uploads actually feed the health view, instead of collapsing into a
 * bare count.
 *
 * CLINICAL / PRIVACY BOUNDARY (load-bearing — a prior raw value-preview was
 * REMOVED for leaking free-text intake answers onto the dashboard; see
 * DomainCard single-domain comment):
 *   - NUMERIC-ONLY. Rows without a numeric `value_num` are excluded, so no
 *     free-text value (e.g. a typed symptom/condition answer) can ever render
 *     here. Callers must also scope this to the `health_markers` domain — never
 *     `health_history`.
 *   - The chip is the REPORT's OWN flag via `ragForRow` (sourced) — never an
 *     invented interpretation. A row with no stated flag → `rag: null` → the
 *     caller shows the value with no chip and makes no claim.
 *   - Display only: `latestPerCode` selects by recency, never by value, and the
 *     plain-language `display` name is shown — never the LOINC code (D25).
 *
 * Pure + node-safe (no react-native imports) so it unit-tests directly.
 */

import type { ObservationRow } from "@/contracts";
import { ragForRow, type RagResult } from "@/upload/reportInterpretation";

import { latestPerCode } from "./latestPerCode";
import { formatMarkerValue } from "./markerCatalog";

export interface MarkerPreviewItem {
  /** Observation row id — stable React key. */
  id: string;
  /** Plain-language marker name (never the LOINC code). */
  label: string;
  /** Display-rounded value + unit, e.g. "6.8 %" or "80 U/L". */
  value: string;
  /** The report's own flag → chip, or null (value-only, no claim). */
  rag: RagResult | null;
}

/**
 * The latest-per-code NUMERIC marker rows, newest first, capped at `limit`,
 * as dashboard preview items. See the module header for the numeric-only +
 * sourced-flag boundary the caller relies on.
 */
export function markerPreviewItems(
  rows: ReadonlyArray<ObservationRow>,
  limit: number,
): MarkerPreviewItem[] {
  const numeric = rows.filter((r) => r.value_num != null);
  return latestPerCode(numeric)
    .slice(0, Math.max(0, limit))
    .map((r) => {
      const num = r.value_num as number;
      const formatted = formatMarkerValue(r.code, num);
      return {
        id: r.id,
        label: r.display,
        value: r.unit ? `${formatted} ${r.unit}` : formatted,
        rag: ragForRow(r),
      };
    });
}
