/**
 * Outcome Report API Route
 *
 * POST /api/outcome-report
 *
 * Token-based outcome submission. No auth required.
 * Called from the /outcome page (email links) or in-chat reporting.
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { recordAppealOutcome } from "@/lib/learning";
import { VALIDATION, SYSTEM } from "@/config/messages";

interface OutcomeReportRequest {
  token: string;
  outcome: "approved" | "denied" | "partial" | "pending";
}

export async function POST(request: NextRequest) {
  try {
    const body: OutcomeReportRequest = await request.json();

    // Validate
    if (!body.token) {
      return NextResponse.json({ error: VALIDATION.TOKEN_REQUIRED }, { status: 400 });
    }

    const validOutcomes = ["approved", "denied", "partial", "pending"];
    if (!body.outcome || !validOutcomes.includes(body.outcome)) {
      return NextResponse.json(
        { error: VALIDATION.OUTCOME_REQUIRED },
        { status: 400 }
      );
    }

    // Look up the followup by token
    const followupResult = await query<{ id: string; appeal_id: string; email: string; responded_at: string | null }>(
      `SELECT id, appeal_id, email, responded_at FROM outcome_followups WHERE token = $1 LIMIT 1`,
      [body.token]
    );
    const followup = followupResult.rows[0] ?? null;

    if (!followup) {
      return NextResponse.json(
        { error: VALIDATION.TOKEN_INVALID },
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
    await query(
      `UPDATE outcome_followups SET outcome = $1, responded_at = $2 WHERE id = $3`,
      [body.outcome, new Date().toISOString(), followup.id]
    );

    // Record in learning system
    if (body.outcome !== "pending") {
      await recordAppealOutcome(followup.appeal_id, body.outcome as "approved" | "denied" | "partial");
    }

    // Apply incentive
    let earnedCredit = false;
    const incentiveResult = await query<{ apply_outcome_incentive: boolean }>(
      `SELECT apply_outcome_incentive($1)`,
      [followup.email]
    );
    if (incentiveResult.rows[0]?.apply_outcome_incentive) {
      earnedCredit = true;
    }

    // Cancel remaining followups for this appeal
    await query(
      `UPDATE outcome_followups SET responded_at = $1, outcome = $2
       WHERE appeal_id = $3 AND responded_at IS NULL`,
      [new Date().toISOString(), body.outcome, followup.appeal_id]
    );

    return NextResponse.json({
      success: true,
      message: "Thank you for reporting your appeal outcome.",
      earnedCredit,
    });
  } catch (error) {
    console.error("[outcome-report] Error:", error);
    return NextResponse.json(
      { error: SYSTEM.GENERIC_ERROR },
      { status: 500 }
    );
  }
}
