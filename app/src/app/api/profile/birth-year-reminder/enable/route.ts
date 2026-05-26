/**
 * Birth-year modal — enable endpoint
 *
 * POST /api/profile/birth-year-reminder/enable
 *
 * Sets users.birth_year_modal_disabled = false AND clears
 * users.birth_year_modal_dismissed_at. Re-enabling resets
 * both flags so the user gets a fresh chance to see the modal
 * (no stale 7-day cooldown still in effect from a prior
 * dismiss).
 *
 * Triggered by:
 *   - "Show year-of-birth reminder" toggle in Settings (on)
 *
 * Server-managed; not exposed via /api/profile PATCH allowlist.
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
         SET birth_year_modal_disabled = false,
             birth_year_modal_dismissed_at = NULL,
             updated_at = now()
       WHERE id = $1`,
      [user.userId],
    );

    logAudit("BIRTH_YEAR_REMINDER_ENABLED", {
      userId: user.userId,
      resourceType: "account",
      metadata: { source: "settings" },
      request,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Profile] birth-year reminder enable error:", error);
    return NextResponse.json(
      { error: SYSTEM.SAVE_PREFERENCE },
      { status: 500 },
    );
  }
}

export const POST = withMetrics(
  _POST,
  "/api/profile/birth-year-reminder/enable",
);
