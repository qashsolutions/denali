/**
 * FHIR Disconnect Route
 *
 * POST /api/fhir/disconnect
 *
 * Disconnects Blue Button: deletes tokens + cache.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    // Delete connection and cache in parallel
    await Promise.all([
      admin
        .from("ehr_connections")
        .delete()
        .eq("user_id", user.id)
        .eq("provider", "bluebutton"),
      admin
        .from("fhir_cache")
        .delete()
        .eq("user_id", user.id),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[FHIR disconnect] Error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}
