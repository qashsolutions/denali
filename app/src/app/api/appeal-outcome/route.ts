/**
 * Appeal Outcome API Route
 *
 * POST /api/appeal-outcome
 *
 * Records the outcome of an appeal for learning purposes.
 * This helps improve coverage path recommendations.
 */

import { NextRequest, NextResponse } from "next/server";
import { recordAppealOutcome } from "@/lib/learning";

interface AppealOutcomeRequest {
  appealId: string;
  outcome: "approved" | "denied" | "partial";
  denialReason?: string;
  approvalNotes?: string;
  daysToDecision?: number;
}

export async function POST(request: NextRequest) {
  try {
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

    return NextResponse.json({
      success: true,
      message: "Thank you for reporting your appeal outcome. This helps us improve our recommendations.",
    });
  } catch (error) {
    console.error("Appeal outcome error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}
