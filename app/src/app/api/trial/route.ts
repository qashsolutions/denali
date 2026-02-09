/**
 * Trial API Route
 *
 * POST /api/trial — start free trial
 * GET  /api/trial — check trial status
 *
 * CMS criteria A4: trial access for Medicare patients
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";
import { PRICING } from "@/config";

const TRIAL_DURATION_DAYS = PRICING.TRIAL_DURATION_DAYS;

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("trial_start, trial_end, trial_converted, status")
      .eq("user_id", user.id)
      .single();

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

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if already has a trial or active subscription
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id, trial_start, status")
      .eq("user_id", user.id)
      .single();

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
    const { error: upsertError } = await supabase
      .from("subscriptions")
      .upsert(
        {
          user_id: user.id,
          plan: "trial",
          status: "trialing",
          trial_start: now.toISOString(),
          trial_end: trialEnd.toISOString(),
          trial_converted: false,
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("[Trial] Upsert error:", upsertError);
      return NextResponse.json({ error: "Failed to start trial" }, { status: 500 });
    }

    // Update user plan to trial
    await supabase
      .from("users")
      .update({ plan: "trial" })
      .eq("id", user.id);

    logAudit("TRIAL_STARTED", {
      userId: user.id,
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
