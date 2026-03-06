import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await query<{
      id: string;
      case_ref: string;
      client_initials: string | null;
      client_state: string | null;
      denial_code: string | null;
      procedure_description: string | null;
      denial_date: string | null;
      status: string;
      outcome: string | null;
      outcome_date: string | null;
      created_at: string;
    }>(
      `SELECT id, case_ref, client_initials, client_state, denial_code,
              procedure_description, denial_date, status, outcome, outcome_date, created_at
       FROM counselor_cases
       WHERE counselor_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [user.userId]
    );

    return NextResponse.json({ cases: result.rows });
  } catch (err) {
    console.error("[counselor/cases] GET failed:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { caseId, outcome } = await request.json();
    if (!caseId || !outcome) {
      return NextResponse.json({ error: "caseId and outcome required" }, { status: 400 });
    }

    await query(
      `UPDATE counselor_cases
       SET outcome = $1, outcome_date = CURRENT_DATE, status = 'outcome_reported', updated_at = NOW()
       WHERE id = $2 AND counselor_id = $3`,
      [outcome, caseId, user.userId]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[counselor/cases] PATCH failed:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
