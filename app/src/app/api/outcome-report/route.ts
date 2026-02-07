/**
 * Outcome Report API Route
 *
 * POST /api/outcome-report
 *
 * Token-based outcome submission. No auth required.
 * Called from the /outcome page (email links) or in-chat reporting.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { recordAppealOutcome } from "@/lib/learning";

interface OutcomeReportRequest {
  token: string;
  outcome: "approved" | "denied" | "partial" | "pending";
}

export async function POST(request: NextRequest) {
  try {
    const body: OutcomeReportRequest = await request.json();

    // Validate
    if (!body.token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const validOutcomes = ["approved", "denied", "partial", "pending"];
    if (!body.outcome || !validOutcomes.includes(body.outcome)) {
      return NextResponse.json(
        { error: "Valid outcome is required (approved, denied, partial, or pending)" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Look up the followup by token
    const { data: followup, error: lookupError } = await supabase
      .from("outcome_followups")
      .select("id, appeal_id, email, responded_at")
      .eq("token", body.token)
      .single();

    if (lookupError || !followup) {
      return NextResponse.json(
        { error: "Invalid or expired token." },
        { status: 404 }
      );
    }

    // Check if already responded
    if (followup.responded_at) {
      return NextResponse.json({
        success: true,
        message: "You've already reported this outcome. Thank you!",
        earnedCredit: false,
      });
    }

    // Record the outcome on the followup
    const { error: updateError } = await supabase
      .from("outcome_followups")
      .update({
        outcome: body.outcome,
        responded_at: new Date().toISOString(),
      })
      .eq("id", followup.id);

    if (updateError) {
      console.error("[outcome-report] Failed to update followup:", updateError);
      return NextResponse.json(
        { error: "Failed to record outcome." },
        { status: 500 }
      );
    }

    // Record in learning system (updates appeals, coverage_paths, mappings)
    if (body.outcome !== "pending") {
      await recordAppealOutcome(followup.appeal_id, body.outcome as "approved" | "denied" | "partial");
    }

    // Apply incentive: decrement appeal_count by 1
    let earnedCredit = false;
    const { data: incentiveResult } = await supabase.rpc("apply_outcome_incentive", {
      p_email: followup.email,
    });

    if (incentiveResult) {
      earnedCredit = true;
    }

    // Cancel remaining followups for this appeal (no need for day_60 if day_30 was answered)
    await supabase
      .from("outcome_followups")
      .update({ responded_at: new Date().toISOString(), outcome: body.outcome })
      .eq("appeal_id", followup.appeal_id)
      .is("responded_at", null);

    return NextResponse.json({
      success: true,
      message: "Thank you for reporting your appeal outcome.",
      earnedCredit,
    });
  } catch (error) {
    console.error("[outcome-report] Error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
