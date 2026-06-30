/**
 * Timeline grouping helper — pure, no React.
 *
 * Collapses append-only observation rows into TimelineCard items:
 *
 *   - "questionnaire" rows from the same submission collapse into ONE
 *     instrument-session card.
 *   - All other observations stay as single cards.
 *
 * DELTA 1 (operator, 2026-06-08): rows with `source === "derived"` are
 * filtered OUT of grouping entirely. They remain in the DAL for export
 * paths but never get a top-level card and never feed display logic —
 * each card recomputes its score from the item rows directly. This
 * removes any dependency on the persistInstrument-writes-derived-total
 * detail for display correctness.
 *
 * Grouping key: (metadata_json.instrument, effective_at). The
 * persistInstrument code in `InstrumentsScreen.tsx` sets `effective_at`
 * once per submission via `new Date().toISOString()` and reuses it
 * across all item rows of that submission, so this composite key
 * cleanly delimits sessions:
 *
 *   - Two same-instrument submissions on the same calendar day get
 *     distinct millisecond timestamps → two distinct cards.
 *   - Two different instruments interleaved get both distinct
 *     timestamps AND distinct instrument keys.
 *   - PHQ-2 auto-expansion into PHQ-9 persists ONLY the final PHQ-9
 *     submission (never a separate PHQ-2 row), so the expansion path
 *     always yields a single PHQ-9 card.
 */

import type { ObservationRow } from "@/contracts";

export type TimelineCard =
  | {
      kind: "instrument-session";
      /**
       * Matches `metadata_json.instrument` from the item rows
       * (e.g. "PHQ-9", "GAD-7"). Used to look up the interpretation
       * band, the displayName, and the domain icon.
       */
      instrumentId: string;
      /** All item rows for this submission, sorted by `itemNumber`. */
      items: ObservationRow[];
      /** ISO timestamp from the items' shared `effective_at`. */
      effective_at: string;
    }
  | {
      kind: "single";
      row: ObservationRow;
    };

interface ParsedMetadata {
  instrument?: string;
  itemNumber?: number;
  itemText?: string;
}

/**
 * Tolerant metadata_json parser. Returns an empty partial on any error
 * (null input, non-object JSON, malformed). Never throws; the grouper
 * downgrades to the `single` card path when metadata is unusable.
 */
export function parseObservationMetadata(
  row: Pick<ObservationRow, "metadata_json">,
): ParsedMetadata {
  if (row.metadata_json == null) return {};
  try {
    const parsed: unknown = JSON.parse(row.metadata_json);
    if (parsed == null || typeof parsed !== "object") return {};
    return parsed as ParsedMetadata;
  } catch {
    return {};
  }
}

/**
 * Group an array of observation rows into TimelineCards.
 *
 * Pure: returns a fresh array, never mutates the input or its rows.
 * Stable order: cards are emitted in the same order their first
 * contributing row appears in the input.
 *
 * Filters: rows with `source === "derived"` are skipped entirely.
 * Questionnaire rows with a recognizable instrument id collapse into
 * `kind: "instrument-session"` cards. All other rows pass through as
 * `kind: "single"`.
 */
export function groupByInstrumentSession(
  rows: ReadonlyArray<ObservationRow>,
): TimelineCard[] {
  const cards: TimelineCard[] = [];
  const sessionIndex = new Map<string, number>();

  for (const row of rows) {
    if (row.source === "derived") continue;

    const meta = parseObservationMetadata(row);
    const isSessionRow =
      row.category === "questionnaire" && typeof meta.instrument === "string";

    if (isSessionRow) {
      const key = `${meta.instrument}|${row.effective_at}`;
      const existingIdx = sessionIndex.get(key);
      if (existingIdx != null) {
        const existing = cards[existingIdx];
        if (existing.kind === "instrument-session") {
          existing.items.push(row);
        }
        continue;
      }
      sessionIndex.set(key, cards.length);
      cards.push({
        kind: "instrument-session",
        instrumentId: meta.instrument as string,
        items: [row],
        effective_at: row.effective_at,
      });
      continue;
    }

    cards.push({ kind: "single", row });
  }

  for (const card of cards) {
    if (card.kind === "instrument-session") {
      card.items.sort((a, b) => {
        const an = parseObservationMetadata(a).itemNumber ?? 0;
        const bn = parseObservationMetadata(b).itemNumber ?? 0;
        return an - bn;
      });
    }
  }

  return cards;
}
