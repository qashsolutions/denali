/**
 * Profile API Route
 *
 * GET   /api/profile — returns the authenticated user's profile
 * PATCH /api/profile — updates user prerequisites (birth_year, is_on_medicare,
 *                     sex_at_birth, gender_identity)
 *
 * Auth via Cognito JWT; data from RDS PostgreSQL.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { withMetrics } from "@/lib/metrics";
import { AUTH, VALIDATION, SYSTEM } from "@/config/messages";
import {
  isValidSexAtBirth,
  isValidGenderIdentity,
  type SexAtBirth,
  type GenderIdentity,
} from "@/types/user-demographics";

async function _GET(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  const [profileResult, usageResult, verificationResult, stripeResult] = await Promise.all([
    query<{
      plan: string;
      role: string;
      is_admin: boolean;
      birth_year: number | null;
      is_on_medicare: boolean;
      sex_at_birth: string | null;
      gender_identity: string | null;
      birth_year_modal_dismissed_at: Date | null;
      birth_year_modal_disabled: boolean;
    }>(
      `SELECT plan, role, is_admin, birth_year, is_on_medicare,
              sex_at_birth, gender_identity,
              birth_year_modal_dismissed_at, birth_year_modal_disabled
       FROM users WHERE id = $1 LIMIT 1`,
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
    query<{ has_stripe_customer: boolean }>(
      `SELECT (stripe_customer_id IS NOT NULL) AS has_stripe_customer
       FROM subscriptions
       WHERE user_id = $1 AND status IN ('active', 'trialing', 'past_due')
       LIMIT 1`,
      [user.userId],
    ),
  ]);

  const profile = profileResult.rows[0];
  const usage = usageResult.rows[0];
  const verification = verificationResult.rows[0];
  const stripe = stripeResult.rows[0];

  // Narrow DB string|null → typed enum|null via the value-set validators.
  // Defense against value-set drift / legacy data — unrecognised values
  // return null so the client treats the field as "not yet answered".
  const sabRaw = profile?.sex_at_birth ?? null;
  const sexAtBirth: SexAtBirth | null = isValidSexAtBirth(sabRaw)
    ? sabRaw
    : null;
  const giRaw = profile?.gender_identity ?? null;
  const genderIdentity: GenderIdentity | null = isValidGenderIdentity(giRaw)
    ? giRaw
    : null;

  const response = NextResponse.json({
    authenticated: true,
    userId: user.userId,
    email: user.email,
    plan: profile?.plan || "trial",
    role: profile?.role || "patient",
    isAdmin: profile?.is_admin || false,
    birthYear: profile?.birth_year ?? null,
    isOnMedicare: profile?.is_on_medicare ?? false,
    sexAtBirth, // Chunk 3 — null = not yet answered (or invalid DB value coerced to null)
    genderIdentity, // Chunk 3 — optional; null = not set
    birthYearModalDismissedAt:
      profile?.birth_year_modal_dismissed_at?.toISOString() ?? null,
    birthYearModalDisabled: profile?.birth_year_modal_disabled ?? false,
    appealCount: usage?.appeal_count || 0,
    appealCredits: usage?.appeal_credits || 0,
    idmeVerified: verification?.idme_verified || false,
    firstName: verification?.idme_first_name || null,
    gender: verification?.idme_gender || null,
    hasStripeCustomer: stripe?.has_stripe_customer || false,
    // Feature flag: whether app requires ID.me identity verification before Blue Button
    // false = Connected Apps Directory (BB works without ID.me)
    // true = Medicare App Library (ID.me required before BB)
    requireIdentityVerification:
      process.env.REQUIRE_IDENTITY_VERIFICATION === "true",
  });

  // Heal medicare_status cookie for sessions created before this gate
  // landed (the verify-otp cookie set won't have run for them). Only
  // touches the cookie when DB has a real answer.
  const hasMedicareCookie = request.cookies.has("medicare_status");
  const iom = profile?.is_on_medicare;
  if (!hasMedicareCookie && (iom === true || iom === false)) {
    response.cookies.set("medicare_status", iom ? "yes" : "no", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
  }

  return response;
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
    const allowedKeys = [
      "birth_year",
      "is_on_medicare",
      "sex_at_birth",
      "gender_identity",
    ] as const;
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
    const params: Array<number | boolean | string | null> = [];
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

    // sex_at_birth — accepts null or a valid SexAtBirth enum string.
    // Invalid string → 400. Mirrors is_on_medicare's per-field branch.
    if ("sex_at_birth" in bodyRecord) {
      const sab = bodyRecord.sex_at_birth;
      if (sab !== null && !isValidSexAtBirth(sab)) {
        return NextResponse.json(
          { error: VALIDATION.INVALID_INPUT, field: "sex_at_birth" },
          { status: 400 },
        );
      }
      setClauses.push(`sex_at_birth = $${params.length + 2}`);
      params.push(sab as SexAtBirth | null);
      changedFields.push("sex_at_birth");
    }

    // gender_identity — accepts null or a valid GenderIdentity enum string.
    // Persists to DB but does NOT drive a cookie (not gated by middleware).
    if ("gender_identity" in bodyRecord) {
      const gi = bodyRecord.gender_identity;
      if (gi !== null && !isValidGenderIdentity(gi)) {
        return NextResponse.json(
          { error: VALIDATION.INVALID_INPUT, field: "gender_identity" },
          { status: 400 },
        );
      }
      setClauses.push(`gender_identity = $${params.length + 2}`);
      params.push(gi as GenderIdentity | null);
      changedFields.push("gender_identity");
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { error: VALIDATION.INVALID_INPUT },
        { status: 400 },
      );
    }

    setClauses.push("updated_at = now()");

    const updateSql = `UPDATE users SET ${setClauses.join(", ")} WHERE id = $1 RETURNING birth_year, is_on_medicare, sex_at_birth, gender_identity`;
    const result = await query<{
      birth_year: number | null;
      is_on_medicare: boolean;
      sex_at_birth: string | null;
      gender_identity: string | null;
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
    const response = NextResponse.json({
      success: true,
      birthYear: updated.birth_year,
      isOnMedicare: updated.is_on_medicare,
      sexAtBirth: updated.sex_at_birth,
      genderIdentity: updated.gender_identity,
    });

    // Sync medicare_status cookie when is_on_medicare is part of this PATCH
    // — without this, the onboarding form's PATCH succeeds but middleware
    // still sees no cookie and loops the user back to /onboarding/medicare.
    if (changedFields.includes("is_on_medicare")) {
      response.cookies.set(
        "medicare_status",
        updated.is_on_medicare ? "yes" : "no",
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 30 * 24 * 60 * 60,
        },
      );
    }

    // Sync sex_at_birth_status cookie when sex_at_birth is part of this PATCH.
    // Mirror logic: set when non-null (carries the enum value), clear when
    // null (Max-Age=0 — Next.js cookie clear convention, same as signout).
    // gender_identity does NOT drive a cookie — it isn't gated by middleware.
    if (changedFields.includes("sex_at_birth")) {
      const sabCookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
      };
      if (updated.sex_at_birth !== null) {
        response.cookies.set("sex_at_birth_status", updated.sex_at_birth, {
          ...sabCookieOpts,
          maxAge: 30 * 24 * 60 * 60,
        });
      } else {
        // Clearing — user's answer reset to NULL. Drop the cookie so
        // middleware re-routes to the interstitial on next /app navigation.
        response.cookies.set("sex_at_birth_status", "", {
          ...sabCookieOpts,
          maxAge: 0,
        });
      }
    }

    return response;
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
