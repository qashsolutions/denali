/**
 * Birth-year modal — dismiss endpoint
 *
 * POST /api/profile/birth-year-reminder/dismiss
 *
 * Sets users.birth_year_modal_dismissed_at = NOW(). Triggers
 * the 7-day cooldown enforced by the modal eligibility check.
 *
 * Server-managed; not exposed via /api/profile PATCH allowlist
 * to prevent clients from sending arbitrary timestamps.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { withMetrics } from "@/lib/metrics";
import { AUTH, SYSTEM } from "@/config/messages";

async function _POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: AUTH.SIGN_IN_REQUIRED },
        { status: 401 },
      );
    }

    await query(
      `UPDATE users
         SET birth_year_modal_dismissed_at = now(),
             updated_at = now()
       WHERE id = $1`,
      [user.userId],
    );

    logAudit("BIRTH_YEAR_REMINDER_DISMISSED", {
      userId: user.userId,
      resourceType: "account",
      metadata: { source: "modal" },
      request,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Profile] birth-year reminder dismiss error:", error);
    return NextResponse.json(
      { error: SYSTEM.SAVE_PREFERENCE },
      { status: 500 },
    );
  }
}

export const POST = withMetrics(
  _POST,
  "/api/profile/birth-year-reminder/dismiss",
);
