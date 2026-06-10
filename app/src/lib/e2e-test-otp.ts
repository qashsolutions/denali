/**
 * Phase-2 — non-prod fixed-OTP test bypass for Maestro automation.
 *
 * **DO NOT DEPLOY THIS PATH IN PRODUCTION.**
 *
 * Lives in its own file (isolated, clearly named) so the bypass code
 * never leaks into the real OTP verification path's branches. The
 * `verify-otp` route calls `assertE2eTestBypassAllowed()` BEFORE the
 * real DB / Cognito work; only when the function returns
 * `{ allowed: true }` does the route use the static test password to
 * complete a real Cognito session for the designated test account.
 *
 * Guard stack (defense in depth — every guard required, in this order):
 *
 *   G1: process.env.E2E_TEST_OTP_ENABLED === "true" (exact string match,
 *       no truthiness). Absent from every prod task def revision.
 *
 *   G2: NODE_ENV !== "production" AND request host is NOT in the
 *       PROD_HOST_ALLOWLIST. Two independent signals — env var AND
 *       request host.
 *
 *   G3: email is in process.env.E2E_TEST_OTP_EMAILS (comma-separated,
 *       lowercased, exact match). Random users are denied even when
 *       G1+G2 satisfy.
 *
 *   G4: code matches process.env.E2E_TEST_OTP_CODE via constant-time
 *       comparison (prevents timing leaks).
 *
 *   G5: process.env.E2E_TEST_OTP_STATIC_PASSWORD is non-empty (injected
 *       at task start from AWS Secrets Manager secret
 *       `denali/staging/e2e-test-account-password`, staging task def
 *       ONLY).
 *
 * BACKUP — startup-time fail-closed assertion:
 *   Runs at module load (i.e. on the FIRST import of this file in the
 *   Node process). If E2E_TEST_OTP_ENABLED is true AND NODE_ENV is
 *   "production", the process throws — the ECS container fails its
 *   health check, the deploy rolls back, and the operator is paged via
 *   the existing `denali-prod-alerts` SNS. The contradiction is
 *   IMPOSSIBLE TO SHIP, not just impossible to use.
 *
 * Logging (operator delta 2):
 *   - G1 / G2 denials: NO log (would be too noisy in prod).
 *   - G3 / G4 / G5 denials: structured log via `[E2E_TEST_OTP]` prefix.
 *   - Success: structured log via `[E2E_TEST_OTP]` prefix.
 *   - Any `[E2E_TEST_OTP]` event in prod logs → SHOULD be impossible →
 *     CloudWatch metric filter can alarm on the prefix.
 */

import { timingSafeEqual } from "node:crypto";

// ─── Startup-time fail-closed assertion (delta 4) ────────────────────────
//
// Runs once, on the first import of this module in the Node process.
// If both flags are set, throw before the server can accept a request.
//
// Wrapped in a guard so test setups that vi.resetModules() can repeatedly
// reimport without the module noticing — see __tests__/e2e-test-otp.test.ts
// for the N7 test of this exact invariant.

assertProdAndFlagNeverCoexist();

function assertProdAndFlagNeverCoexist(): void {
  const flagOn = process.env.E2E_TEST_OTP_ENABLED === "true";
  const inProd = process.env.NODE_ENV === "production";
  if (flagOn && inProd) {
    throw new Error(
      "[E2E_TEST_OTP] FATAL: E2E test OTP cannot be enabled in production. " +
        "Refusing to boot. Check the ECS task def env block.",
    );
  }
}

// ─── Constants ──────────────────────────────────────────────────────────

/**
 * Exact host names treated as production. The host header value is
 * compared by full equality (not substring) so staging.denali.health
 * never matches — explicit per operator delta 5.
 *
 * Staging host: "staging.denali.health" — verified against
 * `BLUEBUTTON_CALLBACK_URL` in CLAUDE.md.
 */
const PROD_HOST_ALLOWLIST: ReadonlySet<string> = new Set([
  "denali.health",
  "www.denali.health",
]);

// ─── Result type ────────────────────────────────────────────────────────

export type E2eTestBypassResult =
  | { allowed: true; staticPassword: string }
  | { allowed: false; guard: "G1" | "G2" | "G3" | "G4" | "G5" };

// ─── Logging (delta 2: G1/G2 silent, G3+ logged) ────────────────────────

interface E2eLogEvent {
  tag: "E2E_TEST_OTP";
  outcome: "allowed" | "denied_guard_fail";
  email: string;
  deniedGuard: "G3" | "G4" | "G5" | null;
  host: string;
  ts: string;
}

function logE2eEvent(event: E2eLogEvent): void {
  // CloudWatch metric filter on `[E2E_TEST_OTP]` substring works against
  // either the raw prefix or the JSON tag field — both are present here.
  console.warn("[E2E_TEST_OTP]", JSON.stringify(event));
}

// ─── Constant-time string compare (G4) ──────────────────────────────────

/**
 * Constant-time compare for two strings. Uses Node's `timingSafeEqual`
 * after length-padding so timing reveals no information about the
 * expected code. Returns false for any unequal input (including empty
 * expected, which means "not configured").
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length === 0 || b.length === 0) return false;
  // timingSafeEqual requires equal-length buffers. Use the MAX length as
  // the comparison target and pad both. We do a second compare on
  // length-equality at the end to defeat the padding trick.
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  const max = Math.max(aBuf.length, bBuf.length);
  const aPadded = Buffer.alloc(max);
  const bPadded = Buffer.alloc(max);
  aBuf.copy(aPadded);
  bBuf.copy(bPadded);
  // timingSafeEqual itself is constant-time over equal-length buffers.
  const bytesEq = timingSafeEqual(aPadded, bPadded);
  // Length check at the end so timing reveals nothing extra; bitwise
  // AND so both sub-comparisons must succeed.
  return bytesEq && aBuf.length === bBuf.length;
}

// ─── Main entrypoint ────────────────────────────────────────────────────

/**
 * Evaluate the five-guard stack. Returns `{ allowed: true,
 * staticPassword }` only when every guard passes. Callers must treat
 * any other return as "fall through to the real OTP path".
 *
 * Asynchronous to leave room for a future Secrets Manager fetch; today
 * the static password is injected as an env var by ECS at task start
 * (same pattern as DB_PASSWORD / COGNITO_*), so the read is sync.
 *
 * @param args - lowercased+trimmed email from the request body,
 *   user-supplied code, and the request `host` header value.
 */
export async function assertE2eTestBypassAllowed(args: {
  email: string;
  code: string;
  host: string;
}): Promise<E2eTestBypassResult> {
  // G1 — explicit env flag.
  if (process.env.E2E_TEST_OTP_ENABLED !== "true") {
    return { allowed: false, guard: "G1" }; // no log (delta 2)
  }

  // G2 — independent env + host guard.
  if (process.env.NODE_ENV === "production") {
    return { allowed: false, guard: "G2" }; // no log (delta 2)
  }
  if (PROD_HOST_ALLOWLIST.has(args.host)) {
    return { allowed: false, guard: "G2" }; // no log (delta 2)
  }

  // G3 — email allowlist (logged from here on).
  const allowlist = (process.env.E2E_TEST_OTP_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
  if (allowlist.length === 0 || !allowlist.includes(args.email)) {
    logE2eEvent({
      tag: "E2E_TEST_OTP",
      outcome: "denied_guard_fail",
      email: args.email,
      deniedGuard: "G3",
      host: args.host,
      ts: new Date().toISOString(),
    });
    return { allowed: false, guard: "G3" };
  }

  // G4 — constant-time code match.
  const expectedCode = process.env.E2E_TEST_OTP_CODE ?? "";
  if (!constantTimeEqual(args.code, expectedCode)) {
    logE2eEvent({
      tag: "E2E_TEST_OTP",
      outcome: "denied_guard_fail",
      email: args.email,
      deniedGuard: "G4",
      host: args.host,
      ts: new Date().toISOString(),
    });
    return { allowed: false, guard: "G4" };
  }

  // G5 — static password presence.
  const staticPassword = process.env.E2E_TEST_OTP_STATIC_PASSWORD ?? "";
  if (staticPassword.length === 0) {
    logE2eEvent({
      tag: "E2E_TEST_OTP",
      outcome: "denied_guard_fail",
      email: args.email,
      deniedGuard: "G5",
      host: args.host,
      ts: new Date().toISOString(),
    });
    return { allowed: false, guard: "G5" };
  }

  // All guards passed.
  logE2eEvent({
    tag: "E2E_TEST_OTP",
    outcome: "allowed",
    email: args.email,
    deniedGuard: null,
    host: args.host,
    ts: new Date().toISOString(),
  });
  return { allowed: true, staticPassword };
}

// ─── Test-only exports ──────────────────────────────────────────────────

/**
 * Test-only re-export of the startup assertion so the N7 unit test can
 * exercise it directly without triggering it via module import (which
 * runs unconditionally on first import).
 */
export const __TEST_ONLY = {
  assertProdAndFlagNeverCoexist,
  PROD_HOST_ALLOWLIST,
  constantTimeEqual,
};
