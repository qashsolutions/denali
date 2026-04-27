/**
 * Birth-year modal — disable endpoint
 *
 * POST /api/profile/birth-year-reminder/disable
 *
 * Sets users.birth_year_modal_disabled = true. Permanent
 * silence until the user re-enables via Settings (which calls
 * the enable endpoint).
 *
 * Triggered by:
 *   - "Don't show again" button on the modal
 *   - "Show year-of-birth reminder" toggle in Settings (off)
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
         SET birth_year_modal_disabled = true,
             updated_at = now()
       WHERE id = $1`,
      [user.userId],
    );

    logAudit("BIRTH_YEAR_REMINDER_DISABLED", {
      userId: user.userId,
      resourceType: "account",
      metadata: { source: "modal_or_settings" },
      request,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Profile] birth-year reminder disable error:", error);
    return NextResponse.json(
      { error: SYSTEM.SAVE_PREFERENCE },
      { status: 500 },
    );
  }
}

export const POST = withMetrics(
  _POST,
  "/api/profile/birth-year-reminder/disable",
);
