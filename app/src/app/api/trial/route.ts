/**
 * Trial API Route
 *
 * POST /api/trial — start free trial
 * GET  /api/trial — check trial status
 *
 * CMS criteria A4: trial access for Medicare patients
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { PRICING } from "@/config";
import { withMetrics } from "@/lib/metrics";
import { AUTH, SYSTEM } from "@/config/messages";

const TRIAL_DURATION_DAYS = PRICING.TRIAL_DURATION_DAYS;

async function _GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: AUTH.SIGN_IN_REQUIRED },
        { status: 401 },
      );
    }

    const subResult = await query<{
      trial_start: string | null;
      trial_end: string | null;
      trial_converted: boolean | null;
      status: string | null;
    }>(
      `SELECT trial_start, trial_end, trial_converted, status FROM subscriptions WHERE user_id = $1 LIMIT 1`,
      [user.userId],
    );
    const sub = subResult.rows[0] ?? null;

    let status: "none" | "converted" | "active" | "expired";
    let daysRemaining = 0;

    if (!sub?.trial_start) {
      status = "none";
    } else if (sub.trial_converted) {
      status = "converted";
    } else {
      const now = new Date();
      const end = new Date(sub.trial_end!);
      if (end > now) {
        status = "active";
        daysRemaining = Math.ceil(
          (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
      } else {
        status = "expired";
      }
    }

    // TEMP DEBUG — remove after verifying trial_converted fix on staging.
    // Tracking: trial_converted bug 2026-05-07. grep TRIAL_DEBUG_2026_05_07
    console.log('[TRIAL_DEBUG_2026_05_07]', JSON.stringify({
      user_id: user.userId,
      trial_start: sub?.trial_start,
      trial_converted: sub?.trial_converted,
      trial_end: sub?.trial_end,
      computed_status: status,
    }));

    return NextResponse.json({ status, daysRemaining });
  } catch (error) {
    console.error("[Trial] GET error:", error);
    return NextResponse.json(
      { error: SYSTEM.TRIAL_CHECK_FAILED },
      { status: 500 },
    );
  }
}

async function _POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: AUTH.SIGN_IN_REQUIRED },
        { status: 401 },
      );
    }

    // Check if already has a trial or active subscription
    const existingResult = await query<{
      id: string;
      trial_start: string | null;
      status: string | null;
    }>(
      `SELECT id, trial_start, status FROM subscriptions WHERE user_id = $1 LIMIT 1`,
      [user.userId],
    );
    const existing = existingResult.rows[0] ?? null;

    if (existing?.trial_start) {
      return NextResponse.json(
        { error: SYSTEM.TRIAL_ALREADY_USED },
        { status: 409 },
      );
    }

    if (existing?.status === "active") {
      return NextResponse.json(
        { error: SYSTEM.ACTIVE_SUBSCRIPTION },
        { status: 409 },
      );
    }

    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DURATION_DAYS);

    // Upsert subscription with trial
    await query(
      `INSERT INTO subscriptions (user_id, plan, status, trial_start, trial_end, trial_converted)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE
         SET plan = EXCLUDED.plan,
             status = EXCLUDED.status,
             trial_start = EXCLUDED.trial_start,
             trial_end = EXCLUDED.trial_end,
             trial_converted = EXCLUDED.trial_converted`,
      [
        user.userId,
        "trial",
        "trialing",
        now.toISOString(),
        trialEnd.toISOString(),
        false,
      ],
    );

    // Update user plan to trial
    await query(`UPDATE users SET plan = 'trial' WHERE id = $1`, [user.userId]);

    logAudit("TRIAL_STARTED", {
      userId: user.userId,
      resourceType: "subscription",
      metadata: {
        trialEnd: trialEnd.toISOString(),
        durationDays: TRIAL_DURATION_DAYS,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      trialEnd: trialEnd.toISOString(),
      daysRemaining: TRIAL_DURATION_DAYS,
    });
  } catch (error) {
    console.error("[Trial] POST error:", error);
    return NextResponse.json(
      { error: SYSTEM.TRIAL_START_FAILED },
      { status: 500 },
    );
  }
}

export const GET = withMetrics(_GET, "/api/trial");
export const POST = withMetrics(_POST, "/api/trial");
