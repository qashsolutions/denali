/**
 * Profile API Route
 *
 * GET   /api/profile — returns the authenticated user's profile
 * PATCH /api/profile — updates user prerequisites (birth_year, is_on_medicare)
 *
 * Auth via Cognito JWT; data from RDS PostgreSQL.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { withMetrics } from "@/lib/metrics";
import { AUTH, VALIDATION, SYSTEM } from "@/config/messages";

async function _GET(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  const [profileResult, usageResult, verificationResult] = await Promise.all([
    query<{
      plan: string;
      role: string;
      is_admin: boolean;
      birth_year: number | null;
      is_on_medicare: boolean;
    }>(
      `SELECT plan, role, is_admin, birth_year, is_on_medicare FROM users WHERE id = $1 LIMIT 1`,
      [user.userId],
    ),
    query<{ appeal_count: number; appeal_credits: number }>(
      `SELECT appeal_count, appeal_credits FROM usage WHERE email = $1 LIMIT 1`,
      [user.email],
    ),
    query<{
      idme_verified: boolean;
      idme_first_name: string | null;
      idme_gender: string | null;
    }>(
      `SELECT COALESCE(idme_verified, false) as idme_verified, idme_first_name, idme_gender FROM user_verification WHERE user_id = $1 LIMIT 1`,
      [user.userId],
    ),
  ]);

  const profile = profileResult.rows[0];
  const usage = usageResult.rows[0];
  const verification = verificationResult.rows[0];

  return NextResponse.json({
    authenticated: true,
    userId: user.userId,
    email: user.email,
    plan: profile?.plan || "trial",
    role: profile?.role || "patient",
    isAdmin: profile?.is_admin || false,
    birthYear: profile?.birth_year ?? null,
    isOnMedicare: profile?.is_on_medicare ?? false,
    appealCount: usage?.appeal_count || 0,
    appealCredits: usage?.appeal_credits || 0,
    idmeVerified: verification?.idme_verified || false,
    firstName: verification?.idme_first_name || null,
    gender: verification?.idme_gender || null,
    // Feature flag: whether app requires ID.me identity verification before Blue Button
    // false = Connected Apps Directory (BB works without ID.me)
    // true = Medicare App Library (ID.me required before BB)
    requireIdentityVerification:
      process.env.REQUIRE_IDENTITY_VERIFICATION === "true",
  });
}

async function _PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: AUTH.SIGN_IN_REQUIRED },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: VALIDATION.INVALID_INPUT },
        { status: 400 },
      );
    }

    const bodyRecord = body as Record<string, unknown>;
    const allowedKeys = ["birth_year", "is_on_medicare"] as const;
    const unknownKeys = Object.keys(bodyRecord).filter(
      (k) => !(allowedKeys as readonly string[]).includes(k),
    );
    if (unknownKeys.length > 0) {
      return NextResponse.json(
        { error: VALIDATION.INVALID_INPUT },
        { status: 400 },
      );
    }

    const setClauses: string[] = [];
    const params: Array<number | boolean | null> = [];
    const changedFields: string[] = [];

    if ("birth_year" in bodyRecord) {
      const by = bodyRecord.birth_year;
      const currentYear = new Date().getFullYear();
      const valid =
        by === null ||
        (typeof by === "number" &&
          Number.isInteger(by) &&
          by >= 1900 &&
          by <= currentYear);
      if (!valid) {
        return NextResponse.json(
          { error: VALIDATION.INVALID_INPUT },
          { status: 400 },
        );
      }
      setClauses.push(`birth_year = $${params.length + 2}`);
      params.push(by as number | null);
      changedFields.push("birth_year");
    }

    if ("is_on_medicare" in bodyRecord) {
      const iom = bodyRecord.is_on_medicare;
      if (typeof iom !== "boolean") {
        return NextResponse.json(
          { error: VALIDATION.INVALID_INPUT },
          { status: 400 },
        );
      }
      setClauses.push(`is_on_medicare = $${params.length + 2}`);
      params.push(iom);
      changedFields.push("is_on_medicare");
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { error: VALIDATION.INVALID_INPUT },
        { status: 400 },
      );
    }

    setClauses.push("updated_at = now()");

    const updateSql = `UPDATE users SET ${setClauses.join(", ")} WHERE id = $1 RETURNING birth_year, is_on_medicare`;
    const result = await query<{
      birth_year: number | null;
      is_on_medicare: boolean;
    }>(updateSql, [user.userId, ...params]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: SYSTEM.SAVE_PREFERENCE },
        { status: 500 },
      );
    }

    logAudit("SETTINGS_CHANGED", {
      userId: user.userId,
      resourceType: "account",
      metadata: { fields: changedFields },
      request,
    }).catch(() => {});

    const updated = result.rows[0];
    return NextResponse.json({
      success: true,
      birthYear: updated.birth_year,
      isOnMedicare: updated.is_on_medicare,
    });
  } catch (error) {
    console.error("[Profile] PATCH error:", error);
    return NextResponse.json(
      { error: SYSTEM.SAVE_PREFERENCE },
      { status: 500 },
    );
  }
}

export const GET = withMetrics(_GET, "/api/profile");
export const PATCH = withMetrics(_PATCH, "/api/profile");
