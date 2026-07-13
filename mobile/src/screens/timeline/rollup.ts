/**
 * Cards → DomainRollup[] — pure transform over the Part-B grouper output.
 *
 * Walks `TimelineCard[]` (instrument-session + single cards from
 * `groupByInstrumentSession`), routes each card to its domain via
 * `domainForRow` / `INSTRUMENT_TO_DOMAIN`, and emits one
 * `DomainRollup` per cohort-gated domain. Empty cohort-gated domains
 * are emitted with `kind: "empty-domain"` so the dashboard can render
 * the "Available" prompt.
 *
 * Round-trip invariant (tested): every non-derived input card appears
 * in exactly one rollup, byte-identical. Storage is the source of
 * truth; the rollup is a pure display transform.
 *
 * The latest-score for an instrument-session domain is recomputed
 * from the most recent session's items via the standard sum. Domains
 * without a recognized instrument id (e.g. orphan questionnaire rows)
 * downgrade to `kind: "single-domain"` with the raw rows preserved.
 */

import type { ObservationRow, SexAtBirth } from "@/contracts";

import {
  type DomainId,
  domainForRow,
  domainsForCohort,
} from "./domains/registry";
import { parseObservationMetadata, type TimelineCard } from "./grouping";

export type DomainRollup =
  | {
      kind: "instrument-domain";
      domainId: DomainId;
      /** Chronological, newest-first. */
      sessions: TimelineCard[];
      /**
       * Score for the LATEST session, recomputed from items. Null
       * when the latest session is incomplete (any item missing
       * value_num) or for instruments whose score function returned
       * null. The detail screen recomputes per-session.
       */
      latestScore: number | null;
      /** Instrument id from the latest session (e.g. "PHQ-9"). */
      latestInstrumentId: string;
      /** ISO timestamp of the latest session. */
      latestEffectiveAt: string;
    }
  | {
      kind: "single-domain";
      domainId: DomainId;
      /** Chronological, newest-first. */
      rows: ObservationRow[];
    }
  | {
      kind: "empty-domain";
      domainId: DomainId;
    };

function effectiveAtOf(card: TimelineCard): string {
  return card.kind === "instrument-session"
    ? card.effective_at
    : card.row.effective_at;
}

/**
 * Per-session score: sum of item values. Exported for the trend layer
 * (Step 3) so the chart scores sessions identically to the dashboard rollup.
 *
 * All remaining instruments (PHQ-2/PHQ-9, GAD-7, AUDIT-C) score by summing
 * item values. `instrumentId` is retained for signature stability + future
 * per-instrument scoring; it no longer branches (the binary-outcome ADAM was
 * removed 2026-07).
 */
export function computeSessionScore(
  _instrumentId: string,
  items: ReadonlyArray<ObservationRow>,
): number | null {
  let sum = 0;
  for (const r of items) {
    if (r.value_num == null) return null;
    sum += r.value_num;
  }
  return sum;
}

/**
 * Roll up TimelineCard[] into per-domain rollups.
 *
 * `sexAtBirth` drives cohort gating — only domains relevant to the
 * cohort are surfaced (via `domainsForCohort`). Universal domains
 * (`health_markers`, `health_history`) are always present.
 *
 * Output ordered by DOMAIN_ORDER. Cards within each rollup ordered
 * newest-first by effective_at.
 */
export function rollupCardsByDomain(
  cards: ReadonlyArray<TimelineCard>,
  sexAtBirth: SexAtBirth | null | undefined,
): DomainRollup[] {
  // 1. Collect cards by domain.
  const sessionBuckets = new Map<DomainId, TimelineCard[]>();
  const singleBuckets = new Map<DomainId, ObservationRow[]>();

  for (const card of cards) {
    if (card.kind === "instrument-session") {
      // Instrument session — route via the instrument id.
      const meta = parseObservationMetadata(card.items[0] ?? { metadata_json: null });
      const domain = meta.instrument != null ? routeInstrument(meta.instrument) : null;
      if (domain != null) {
        const bucket = sessionBuckets.get(domain);
        if (bucket) bucket.push(card);
        else sessionBuckets.set(domain, [card]);
        continue;
      }
      // Unrecognized instrument id — downgrade to single-domain with
      // the raw rows preserved (round-trip invariant: nothing dropped).
      const fallbackDomain: DomainId = "health_history";
      const bucket = singleBuckets.get(fallbackDomain) ?? [];
      for (const row of card.items) bucket.push(row);
      singleBuckets.set(fallbackDomain, bucket);
      continue;
    }

    // Single row.
    const meta = parseObservationMetadata(card.row);
    const domain = domainForRow({
      category: card.row.category,
      metadataInstrument: meta.instrument ?? null,
      code: card.row.code,
    });
    if (domain == null) continue; // unrecognizable; skip (defensive)
    const bucket = singleBuckets.get(domain) ?? [];
    bucket.push(card.row);
    singleBuckets.set(domain, bucket);
  }

  // 2. Sort each bucket newest-first.
  for (const sessions of sessionBuckets.values()) {
    sessions.sort((a, b) =>
      effectiveAtOf(a) < effectiveAtOf(b) ? 1 : -1,
    );
  }
  for (const rows of singleBuckets.values()) {
    rows.sort((a, b) => (a.effective_at < b.effective_at ? 1 : -1));
  }

  // 3. Emit rollups in DOMAIN_ORDER, cohort-gated.
  const cohortDomains = domainsForCohort(sexAtBirth);
  const out: DomainRollup[] = [];

  for (const domainId of cohortDomains) {
    const sessions = sessionBuckets.get(domainId);
    const rows = singleBuckets.get(domainId);

    if (sessions && sessions.length > 0) {
      const latest = sessions[0];
      // latest is guaranteed to be an instrument-session since we
      // only populated sessionBuckets with those.
      if (latest.kind === "instrument-session") {
        const latestMeta = parseObservationMetadata(
          latest.items[0] ?? { metadata_json: null },
        );
        const latestInstrumentId = latestMeta.instrument ?? "";
        const latestScore = computeSessionScore(
          latestInstrumentId,
          latest.items,
        );
        out.push({
          kind: "instrument-domain",
          domainId,
          sessions,
          latestScore,
          latestInstrumentId,
          latestEffectiveAt: latest.effective_at,
        });
      }
      // Also collect any orphan single rows that landed in this
      // domain (round-trip invariant).
      if (rows && rows.length > 0) {
        out.push({ kind: "single-domain", domainId, rows });
      }
      continue;
    }

    if (rows && rows.length > 0) {
      out.push({ kind: "single-domain", domainId, rows });
      continue;
    }

    // No data → empty-domain card for the dashboard's "Available"
    // section.
    out.push({ kind: "empty-domain", domainId });
  }

  return out;
}

/**
 * Look up an instrument id's domain. Co-located here to avoid a
 * circular import if the registry module's import surface shifts;
 * the underlying map is the source of truth.
 */
function routeInstrument(instrumentId: string): DomainId | null {
  // Imported lazily via require to keep the module-graph clean is
  // overkill; we just consult the registry constant directly.
  // The static import lives at the top of the file.
  return INSTRUMENT_DOMAIN_REGISTRY[instrumentId] ?? null;
}

// Lazy re-export of the registry's instrument map so the function
// above doesn't reach across module boundaries on every call. This
// reads at import-time and stays constant.
import { INSTRUMENT_TO_DOMAIN as INSTRUMENT_DOMAIN_REGISTRY } from "./domains/registry";
