import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await query<{
      open_cases: string;
      filed_this_month: string;
      outcomes_reported: string;
      approved_count: string;
      denied_count: string;
      partial_count: string;
      avg_resolution_days: string | null;
    }>(`SELECT * FROM get_counselor_stats($1)`, [user.userId]);

    return NextResponse.json({ stats: result.rows[0] ?? null });
  } catch (err) {
    console.error("[counselor/stats] Failed:", err);
    return NextResponse.json({ error: "Unable to load stats. Please try again." }, { status: 500 });
  }
}
