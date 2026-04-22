import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { AUTH, SYSTEM } from "@/config/messages";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: AUTH.SIGN_IN_REQUIRED }, { status: 401 });

  // Verify counselor role
  const roleResult = await query<{ role: string }>(`SELECT role FROM users WHERE id = $1`, [user.userId]);
  if (roleResult.rows[0]?.role !== "counselor") {
    return NextResponse.json({ error: AUTH.ADMIN_ONLY }, { status: 403 });
  }

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
    return NextResponse.json({ error: SYSTEM.LOAD_STATS }, { status: 500 });
  }
}
