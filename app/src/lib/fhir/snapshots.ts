/**
 * Diabetes Snapshots — Longitudinal Lab History
 *
 * Appends diabetes-relevant lab results from FHIR to the
 * diabetes_snapshots table for trend tracking.
 * Uses admin client (bypasses RLS). Fire-and-forget.
 */

import { createAdminClient } from "@/lib/supabase-admin";
import type { LabResult } from "./transforms";

/**
 * Parse formatted date string ("January 15, 2026") → "2026-01-15"
 */
function parseLabDate(formatted: string): string | null {
  try {
    const d = new Date(formatted);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

/**
 * Append diabetes lab results to the snapshots table.
 * Uses ON CONFLICT DO NOTHING to skip duplicates.
 */
export async function appendDiabetesSnapshots(
  userId: string,
  labs: LabResult[]
): Promise<void> {
  const rows = labs
    .filter((l) => l.loincCode) // Only labs with LOINC codes
    .map((l) => {
      const observedDate = parseLabDate(l.date);
      if (!observedDate) return null;
      return {
        user_id: userId,
        loinc_code: l.loincCode,
        lab_name: l.name,
        value: l.value,
        unit: l.unit,
        observed_date: observedDate,
        source: "fhir" as const,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("diabetes_snapshots")
    .upsert(rows, { onConflict: "user_id,loinc_code,observed_date", ignoreDuplicates: true });

  if (error) {
    console.warn("[Snapshots] Append failed:", error.message);
  }
}
