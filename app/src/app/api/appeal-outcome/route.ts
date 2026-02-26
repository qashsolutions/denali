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
import { logAudit } from "@/lib/audit";

interface AppealOutcomeRequest {
  appealId: string;
  outcome: "approved" | "denied" | "partial";
  denialReason?: string;
  approvalNotes?: string;
  daysToDecision?: number;
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body: AppealOutcomeRequest = await request.json();

    // Validate request
    if (!body.appealId) {
      return NextResponse.json(
        { error: "Appeal ID is required" },
        { status: 400 }
      );
    }

    if (!body.outcome || !["approved", "denied", "partial"].includes(body.outcome)) {
      return NextResponse.json(
        { error: "Valid outcome is required (approved, denied, or partial)" },
        { status: 400 }
      );
    }

    // Record the outcome
    const success = await recordAppealOutcome(body.appealId, body.outcome, {
      denialReason: body.denialReason,
      approvalNotes: body.approvalNotes,
      daysToDecision: body.daysToDecision,
    });

    if (!success) {
      return NextResponse.json(
        { error: "Failed to record outcome. Please try again." },
        { status: 500 }
      );
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
        console.log(`[Appeal Outcome] Incentive applied for ${user.email}`);
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
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
