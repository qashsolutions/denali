/**
 * bandTint — the pure BandId → TintClass mapping.
 *
 * Extracted from pill.ts so node-only consumers (e.g. dashboardAttention.ts +
 * its test) can use the severity classification WITHOUT importing pill.ts,
 * which pulls in react-native (StyleSheet / fonts) and can't be parsed in the
 * node test env. pill.ts re-exports this, so existing callers are unchanged.
 *
 * Keyed on the stable BandId, never on display strings, so string-table edits
 * can't change severity styling. The trend chart, the pills, and the dashboard
 * attention callout all share this — they can never disagree.
 */

import type { BandId, TintClass } from "./interpretation/tableV1";

export function tintClassForBand(band: {
  bandId: BandId;
  tint?: TintClass;
}): TintClass {
  // Curated per-band override (v1.3, table-owned) wins.
  if (band.tint) return band.tint;
  switch (band.bandId) {
    // ok — screen-negative / lowest-severity / in-range bands.
    case "negative":
    case "minimal":
    case "lower-risk":
    case "healthy-weight":
    case "bone-normal":
      return "ok";
    // soft — within-normal bands.
    case "lower-normal":
    case "higher-normal":
      return "soft";
    // watch — calm attention. WHO biomarker out-of-range bands stay "watch"
    // (calm), not "alarm" — clinical surfaces stay calm; the reviewer may
    // escalate via the table's per-band `tint` override before sign-off.
    case "mild":
    case "moderate":
    case "higher-risk":
    case "underweight":
    case "overweight":
    case "obesity":
    case "severe-obesity":
    case "bone-low":
    case "osteoporosis":
      return "watch";
    // alarm — severe screener bands (alarm tokens' only UI consumer
    // besides the crisis path).
    case "moderately-severe":
    case "severe":
    case "likely-aud":
    case "positive":
      return "alarm";
  }
}
