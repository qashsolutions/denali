/**
 * Alert Preferences API
 *
 * GET  /api/alerts/preferences — return user's alert preferences + plan eligibility
 * PUT  /api/alerts/preferences — update alert preference (opt-in toggle)
 *
 * Auth via Cognito JWT. Follows consent/route.ts pattern.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { ALERT_TYPES, getEligibleAlertTypes } from "@/config/alerts";
import type { AlertType } from "@/config/alerts";
import { AUTH, VALIDATION, SYSTEM } from "@/config/messages";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: AUTH.SIGN_IN_REQUIRED }, { status: 401 });
    }

    // Get user's plan
    const userResult = await query<{ plan: string; is_admin: boolean }>(
      `SELECT plan, is_admin FROM users WHERE id = $1`,
      [user.userId]
    );
    const plan = userResult.rows[0]?.plan ?? null;
    const isAdmin = userResult.rows[0]?.is_admin ?? false;
    const eligible = getEligibleAlertTypes(plan, isAdmin);

    // Get stored preferences (missing = disabled — opt-in required per CMS)
    const prefs = await query<{ alert_type: string; enabled: boolean }>(
      `SELECT alert_type, enabled FROM alert_preferences WHERE user_id = $1`,
      [user.userId]
    );

    const prefMap = new Map(prefs.rows.map((p) => [p.alert_type, p.enabled]));

    const preferences: Record<string, boolean> = {};
    const eligibility: Record<string, boolean> = {};

    for (const type of ALERT_TYPES) {
      preferences[type] = prefMap.get(type) ?? false; // default disabled (opt-in)
      eligibility[type] = eligible.includes(type);
    }

    return NextResponse.json({ preferences, eligibility, plan });
  } catch (error) {
    console.error("[Alert Prefs] GET error:", error);
    return NextResponse.json(
      { error: SYSTEM.LOAD_PREFERENCES },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: AUTH.SIGN_IN_REQUIRED }, { status: 401 });
    }

    const body = await request.json();
    const { alertType, enabled } = body as { alertType: string; enabled: boolean };

    if (!ALERT_TYPES.includes(alertType as AlertType)) {
      return NextResponse.json({ error: VALIDATION.INVALID_ALERT_TYPE }, { status: 400 });
    }

    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: VALIDATION.ALERT_TOGGLE_INVALID }, { status: 400 });
    }

    const now = new Date().toISOString();

    await query(
      `INSERT INTO alert_preferences (user_id, alert_type, enabled, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, alert_type) DO UPDATE
         SET enabled = EXCLUDED.enabled,
             updated_at = EXCLUDED.updated_at`,
      [user.userId, alertType, enabled, now]
    );

    logAudit("ALERT_PREFERENCE_UPDATED", {
      userId: user.userId,
      resourceType: "settings",
      metadata: { alertType, enabled },
      request,
    }).catch(() => {});

    return NextResponse.json({ success: true, alertType, enabled });
  } catch (error) {
    console.error("[Alert Prefs] PUT error:", error);
    return NextResponse.json(
      { error: SYSTEM.SAVE_PREFERENCE },
      { status: 500 }
    );
  }
}
