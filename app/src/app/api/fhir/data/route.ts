/**
 * FHIR Data Route
 *
 * GET /api/fhir/data
 *
 * Returns transformed health data from cache.
 * If cache is stale (>24h), triggers a fresh sync.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCachedHealthData, syncHealthData } from "@/lib/fhir/sync";
import { hasActiveConnection } from "@/lib/fhir/tokens";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    logAudit("FHIR_DATA_ACCESS", {
      userId: user.id,
      resourceType: "ehr_connection",
    }).catch(() => {});

    // Check if user has an active connection
    const connected = await hasActiveConnection(user.id);
    if (!connected) {
      return NextResponse.json(
        { connected: false, patient: null, coverage: [], claims: [] }
      );
    }

    // Try cache first
    const cached = await getCachedHealthData(user.id);
    if (cached) {
      return NextResponse.json({
        connected: true,
        ...cached,
      });
    }

    // Cache miss — sync fresh data
    try {
      const fresh = await syncHealthData(user.id);
      return NextResponse.json({
        connected: true,
        ...fresh,
      });
    } catch (syncError) {
      console.error("[FHIR data] Sync failed:", syncError);
      return NextResponse.json(
        { connected: true, error: "Failed to fetch health data. Try refreshing." },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("[FHIR data] Error:", error);
    return NextResponse.json(
      { error: "Failed to load health data" },
      { status: 500 }
    );
  }
}
