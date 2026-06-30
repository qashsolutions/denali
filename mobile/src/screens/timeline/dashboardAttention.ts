/**
 * dashboardAttention — the single "needs attention" item for Today (D35).
 *
 * Principle 7 (one attention item, no alert pile-up): surface at most ONE
 * domain at the top of the dashboard — the one whose latest check-in lands in a
 * severe ("alarm"-tint) band. Everything else stays in the calm domain grid
 * below; the grid is NOT reordered (stable layout matters for the 45+ audience).
 *
 * Pure. Reuses the SAME lookupInterpretation + tintClassForBand the DomainCard
 * uses, so the callout and the card can never disagree. Markers (BMI, bone
 * density) are "watch" tint — never "alarm" — so they never trigger this; only
 * the validated severity screeners (PHQ-9 severe, GAD-7 severe, AUDIT-C
 * likely-AUD, etc.) do. Returns null when nothing is severe.
 */

import type { SexAtBirth } from "@/contracts";

import type { DomainId } from "./domains/registry";
import { lookupInterpretation } from "./interpretation/lookup";
import type { InterpretationBand } from "./interpretation/tableV1";
import { tintClassForBand } from "./bandTint";
import type { DomainRollup } from "./rollup";

export interface AttentionItem {
  domainId: DomainId;
  band: InterpretationBand;
}

/**
 * EVERY domain whose latest check-in is in a severe ("alarm"-tint) band, in
 * rollup order (data-bearing, most-recent-first). The dashboard shows the FIRST
 * in a single compact callout and indicates any others as a "+N more" line — it
 * never stacks N cards (that would be the pile-up principle 7 forbids). Empty
 * when nothing is severe.
 */
export function severeDomains(
  rollups: ReadonlyArray<DomainRollup>,
  sexAtBirth: SexAtBirth | null,
  ageYears: number | null,
): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const r of rollups) {
    if (r.kind !== "instrument-domain") continue;
    if (r.latestScore == null) continue;
    const lookup = lookupInterpretation({
      key: r.latestInstrumentId,
      score: r.latestScore,
      sexAtBirth,
      ageYears,
      kind: "instrument",
    });
    if (lookup == null) continue;
    if (tintClassForBand(lookup.band) === "alarm") {
      out.push({ domainId: r.domainId, band: lookup.band });
    }
  }
  return out;
}
