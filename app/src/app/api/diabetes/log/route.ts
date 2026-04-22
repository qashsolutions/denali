/**
 * Diabetes Log API Route
 *
 * GET  /api/diabetes/log   — list user's entries (30 most recent)
 * POST /api/diabetes/log   — create entry
 * DELETE /api/diabetes/log?id=<id> — delete entry
 *
 * Auth required. Any signed-in user can use this.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { withMetrics } from "@/lib/metrics";
import { AUTH, VALIDATION, SYSTEM } from "@/config/messages";

const VALID_ENTRY_TYPES = ["glucose", "activity", "meal", "note"] as const;
const VALID_CONTEXTS = [
  "fasting",
  "before_meal",
  "after_meal",
  "bedtime",
  "other",
] as const;

type EntryType = (typeof VALID_ENTRY_TYPES)[number];
type GlucoseContext = (typeof VALID_CONTEXTS)[number];

async function _GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: AUTH.SIGN_IN_REQUIRED },
        { status: 401 },
      );
    }

    const result = await query<{
      id: string;
      logged_at: string;
      entry_type: string;
      glucose_value: number | null;
      glucose_context: string | null;
      activity_minutes: number | null;
      activity_type: string | null;
      note: string | null;
    }>(
      `SELECT id, logged_at, entry_type, glucose_value, glucose_context,
              activity_minutes, activity_type, note
       FROM diabetes_log
       WHERE user_id = $1
       ORDER BY logged_at DESC
       LIMIT 30`,
      [user.userId],
    );

    return NextResponse.json({ entries: result.rows });
  } catch {
    return NextResponse.json({ error: SYSTEM.SAVE_LOG }, { status: 500 });
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

    const body = await request.json();
    const {
      entry_type,
      logged_at,
      glucose_value,
      glucose_context,
      activity_minutes,
      activity_type,
      note,
    } = body as {
      entry_type: EntryType;
      logged_at?: string;
      glucose_value?: number;
      glucose_context?: GlucoseContext;
      activity_minutes?: number;
      activity_type?: string;
      note?: string;
    };

    // Validate entry_type
    if (!entry_type || !VALID_ENTRY_TYPES.includes(entry_type)) {
      return NextResponse.json(
        { error: VALIDATION.INVALID_LOG_TYPE },
        { status: 400 },
      );
    }

    // Validate glucose_context if provided
    if (glucose_context && !VALID_CONTEXTS.includes(glucose_context)) {
      return NextResponse.json(
        { error: VALIDATION.INVALID_GLUCOSE_CONTEXT },
        { status: 400 },
      );
    }

    // Validate activity_minutes if provided
    if (
      activity_minutes != null &&
      (typeof activity_minutes !== "number" || activity_minutes <= 0)
    ) {
      return NextResponse.json(
        { error: VALIDATION.ACTIVITY_POSITIVE },
        { status: 400 },
      );
    }

    const result = await query<{
      id: string;
      logged_at: string;
      entry_type: string;
    }>(
      `INSERT INTO diabetes_log
         (user_id, entry_type, logged_at, glucose_value, glucose_context, activity_minutes, activity_type, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        user.userId,
        entry_type,
        logged_at || new Date().toISOString(),
        entry_type === "glucose" ? (glucose_value ?? null) : null,
        entry_type === "glucose" ? (glucose_context ?? null) : null,
        entry_type === "activity" ? (activity_minutes ?? null) : null,
        entry_type === "activity" ? (activity_type ?? null) : null,
        ["meal", "note"].includes(entry_type) ? (note ?? null) : null,
      ],
    );

    const entry = result.rows[0];

    logAudit("DIABETES_LOG_ENTRY", {
      userId: user.userId,
      resourceType: "diabetes_log",
      resourceId: entry?.id,
      metadata: { entry_type },
    }).catch(() => {});

    return NextResponse.json({ entry }, { status: 201 });
  } catch {
    return NextResponse.json({ error: SYSTEM.SAVE_LOG }, { status: 500 });
  }
}

async function _DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: AUTH.SIGN_IN_REQUIRED },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: VALIDATION.MISSING_ENTRY_ID },
        { status: 400 },
      );
    }

    await query(`DELETE FROM diabetes_log WHERE id = $1 AND user_id = $2`, [
      id,
      user.userId,
    ]);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: SYSTEM.SAVE_LOG }, { status: 500 });
  }
}

export const GET = withMetrics(_GET, "/api/diabetes/log");
export const POST = withMetrics(_POST, "/api/diabetes/log");
export const DELETE = withMetrics(_DELETE, "/api/diabetes/log");
