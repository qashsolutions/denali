/**
 * FHIR Disconnect Route
 *
 * POST /api/fhir/disconnect
 *
 * Disconnects Blue Button: deletes tokens + cache.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Delete connection, cache, and diabetes data in parallel
    await Promise.all([
      query(`DELETE FROM ehr_connections WHERE user_id = $1 AND provider = 'bluebutton'`, [user.userId]),
      query(`DELETE FROM fhir_cache WHERE user_id = $1`, [user.userId]),
      query(`DELETE FROM diabetes_snapshots WHERE user_id = $1`, [user.userId]),
      query(`DELETE FROM diabetes_insights WHERE user_id = $1`, [user.userId]),
    ]);

    logAudit("FHIR_DISCONNECT", {
      userId: user.userId,
      resourceType: "ehr_connection",
      metadata: { provider: "bluebutton" },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[FHIR disconnect] Error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}
