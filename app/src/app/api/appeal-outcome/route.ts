/**
 * Appeal Outcome API Route
 *
 * POST /api/appeal-outcome
 *
 * Records the outcome of an appeal for learning purposes.
 * This helps improve coverage path recommendations.
 */

import { NextRequest, NextResponse } from "next/server";
import { recordAppealOutcome, applyOutcomeIncentive } from "@/lib/learning";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { withMetrics } from "@/lib/metrics";
import { AUTH, VALIDATION, SYSTEM } from "@/config/messages";

interface AppealOutcomeRequest {
  appealId: string;
  outcome: "approved" | "denied" | "partial";
  denialReason?: string;
  approvalNotes?: string;
  daysToDecision?: number;
}

async function _POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: AUTH.SIGN_IN_REQUIRED },
        { status: 401 },
      );
    }

    // Stage 2 gate: appeals are Medicare-only.
    const medicareResult = await query<{ is_on_medicare: boolean | null }>(
      `SELECT is_on_medicare FROM users WHERE id = $1 LIMIT 1`,
      [user.userId],
    );
    if (medicareResult.rows[0]?.is_on_medicare !== true) {
      return NextResponse.json(
        { error: "appeals_require_medicare" },
        { status: 403 },
      );
    }

    const body: AppealOutcomeRequest = await request.json();

    // Validate request
    if (!body.appealId) {
      return NextResponse.json(
        { error: VALIDATION.APPEAL_ID_REQUIRED },
        { status: 400 },
      );
    }

    if (
      !body.outcome ||
      !["approved", "denied", "partial"].includes(body.outcome)
    ) {
      return NextResponse.json(
        { error: VALIDATION.OUTCOME_REQUIRED },
        { status: 400 },
      );
    }

    // Record the outcome
    const success = await recordAppealOutcome(body.appealId, body.outcome, {
      denialReason: body.denialReason,
      approvalNotes: body.approvalNotes,
      daysToDecision: body.daysToDecision,
    });

    if (!success) {
      return NextResponse.json({ error: SYSTEM.SAVE_OUTCOME }, { status: 500 });
    }

    logAudit("APPEAL_OUTCOME", {
      userId: user.userId,
      resourceType: "appeal",
      resourceId: body.appealId,
      metadata: { outcome: body.outcome },
      request,
    }).catch(() => {});

    // Apply outcome incentive: give user a free appeal credit for reporting
    let incentiveApplied = false;
    if (user.email) {
      incentiveApplied = await applyOutcomeIncentive(user.email);
      if (incentiveApplied) {
        console.log("[Appeal Outcome] Incentive applied for user:", user.userId);
      }
    }

    return NextResponse.json({
      success: true,
      incentiveApplied,
      message: incentiveApplied
        ? "Thank you for reporting your appeal outcome! You've earned a free appeal credit."
        : "Thank you for reporting your appeal outcome. This helps us improve our recommendations.",
    });
  } catch (error) {
    console.error("Appeal outcome error:", error);
    return NextResponse.json({ error: SYSTEM.GENERIC_ERROR }, { status: 500 });
  }
}

export const POST = withMetrics(_POST, "/api/appeal-outcome");
