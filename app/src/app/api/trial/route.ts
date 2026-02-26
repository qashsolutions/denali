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

const TRIAL_DURATION_DAYS = PRICING.TRIAL_DURATION_DAYS;

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const subResult = await query<{
      trial_start: string | null;
      trial_end: string | null;
      trial_converted: boolean | null;
      status: string | null;
    }>(
      `SELECT trial_start, trial_end, trial_converted, status FROM subscriptions WHERE user_id = $1 LIMIT 1`,
      [user.userId]
    );
    const sub = subResult.rows[0] ?? null;

    if (!sub?.trial_start) {
      return NextResponse.json({ status: "none", daysRemaining: 0 });
    }

    const now = new Date();
    const end = new Date(sub.trial_end!);

    if (sub.trial_converted) {
      return NextResponse.json({ status: "converted", daysRemaining: 0 });
    }

    if (end > now) {
      const daysRemaining = Math.ceil(
        (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return NextResponse.json({ status: "active", daysRemaining });
    }

    return NextResponse.json({ status: "expired", daysRemaining: 0 });
  } catch (error) {
    console.error("[Trial] GET error:", error);
    return NextResponse.json({ error: "Failed to check trial" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if already has a trial or active subscription
    const existingResult = await query<{ id: string; trial_start: string | null; status: string | null }>(
      `SELECT id, trial_start, status FROM subscriptions WHERE user_id = $1 LIMIT 1`,
      [user.userId]
    );
    const existing = existingResult.rows[0] ?? null;

    if (existing?.trial_start) {
      return NextResponse.json(
        { error: "Trial already used" },
        { status: 409 }
      );
    }

    if (existing?.status === "active") {
      return NextResponse.json(
        { error: "Already has active subscription" },
        { status: 409 }
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
      [user.userId, "trial", "trialing", now.toISOString(), trialEnd.toISOString(), false]
    );

    // Update user plan to trial
    await query(
      `UPDATE users SET plan = 'trial' WHERE id = $1`,
      [user.userId]
    );

    logAudit("TRIAL_STARTED", {
      userId: user.userId,
      resourceType: "subscription",
      metadata: { trialEnd: trialEnd.toISOString(), durationDays: TRIAL_DURATION_DAYS },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      trialEnd: trialEnd.toISOString(),
      daysRemaining: TRIAL_DURATION_DAYS,
    });
  } catch (error) {
    console.error("[Trial] POST error:", error);
    return NextResponse.json({ error: "Failed to start trial" }, { status: 500 });
  }
}
