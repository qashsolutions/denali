/**
 * GET /api/diabetes/snapshots
 *
 * Returns longitudinal lab history from diabetes_snapshots for the authenticated user.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const result = await query<{
      loinc_code: string;
      lab_name: string;
      value: string;
      unit: string;
      observed_date: string;
    }>(
      `SELECT loinc_code, lab_name, value, unit, observed_date
       FROM diabetes_snapshots
       WHERE user_id = $1
       ORDER BY observed_date ASC`,
      [user.userId]
    );

    const snapshots = result.rows.map((r) => ({
      loincCode: r.loinc_code,
      labName: r.lab_name,
      value: Number(r.value),
      unit: r.unit,
      date: r.observed_date,
    }));

    return NextResponse.json({ snapshots });
  } catch (err) {
    console.error("[Diabetes/snapshots API] Error:", err);
    return NextResponse.json({ error: "Unable to load your lab history. Please try again." }, { status: 500 });
  }
}
