import { describe, it, expect, afterEach, vi } from "vitest";
import type { AuthState } from "@/hooks/useAuth";

/**
 * Unit tests for canShowBirthYearModal() in profile-cadence.ts
 *
 * The function is a pure predicate over AuthState — no DB, no network,
 * no side effects. All time-sensitive tests use vi.useFakeTimers() to
 * pin Date.now() and achieve deterministic boundary assertions.
 *
 * Cohort note: canShowBirthYearModal() does NOT branch on isOnMedicare or
 * on the numeric value of birthYear (only null vs non-null). The function
 * is cohort-agnostic — no cohort fixtures are imported.
 *
 * Contract under test (post-47af5ba, inclusive >= boundary):
 *   Show when ALL of:
 *     1. !isLoading
 *     2. userId is truthy
 *     3. birthYear === null
 *     4. birthYearModalDisabled !== true
 *     5. birthYearModalDismissedAt === null
 *        OR (Date.now() - dismissedAt) >= 7 * 24 * 60 * 60 * 1000
 *   Malformed-date → fail open (show modal)
 */

// ---------------------------------------------------------------------------
// Import — after describe/it/vi declarations so vitest hoisting is satisfied.
// profile-cadence.ts has no vi.mock()-able imports — it only has a type-only
// import of AuthState (erased at runtime). No mocks needed.
// ---------------------------------------------------------------------------

import { canShowBirthYearModal } from "@/lib/profile-cadence";

// ---------------------------------------------------------------------------
// Constants (duplicated from source so tests are self-documenting without
// importing the non-exported constant)
// ---------------------------------------------------------------------------

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 604_800_000 ms

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal but fully-typed AuthState. Only the five fields the
 * function reads are given meaningful defaults; every other required field
 * is set to its zero/false/null value so TypeScript is satisfied without
 * `as any`.
 */
function makeAuthState(overrides: Partial<AuthState> = {}): AuthState {
  const base: AuthState = {
    // Fields canShowBirthYearModal() reads
    isLoading: false,
    userId: "user-abc-123",
    birthYear: null,
    birthYearModalDisabled: false,
    birthYearModalDismissedAt: null,
    // Required fields the function never reads — zero values
    email: null,
    firstName: null,
    gender: null,
    isEmailVerified: false,
    isIdmeVerified: false,
    isMfaEnrolled: false,
    isMfaVerified: false,
    currentAAL: null,
    plan: "trial",
    role: "patient",
    appealCount: 0,
    appealCredits: 0,
    trialStatus: "none",
    trialDaysRemaining: 0,
    isAdmin: false,
    error: null,
    requireIdentityVerification: false,
    isOnMedicare: false,
  };
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("canShowBirthYearModal", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Guard 1: isLoading ───────────────────────────────────────────────────

  describe("isLoading guard", () => {
    it("returns false when isLoading is true, even if all other conditions would show the modal", () => {
      const state = makeAuthState({
        isLoading: true,
        // All other conditions satisfied
        userId: "user-abc-123",
        birthYear: null,
        birthYearModalDisabled: false,
        birthYearModalDismissedAt: null,
      });
      expect(canShowBirthYearModal(state)).toBe(false);
    });

    it("returns false when isLoading is true and userId is also missing", () => {
      const state = makeAuthState({ isLoading: true, userId: null });
      expect(canShowBirthYearModal(state)).toBe(false);
    });

    it("returns false when isLoading is true and birthYear is set", () => {
      const state = makeAuthState({ isLoading: true, birthYear: 1955 });
      expect(canShowBirthYearModal(state)).toBe(false);
    });

    it("returns false when isLoading is true and modal is disabled", () => {
      const state = makeAuthState({
        isLoading: true,
        birthYearModalDisabled: true,
      });
      expect(canShowBirthYearModal(state)).toBe(false);
    });
  });

  // ── Guard 2: userId ──────────────────────────────────────────────────────

  describe("userId guard", () => {
    it("returns false when userId is null", () => {
      const state = makeAuthState({ userId: null });
      expect(canShowBirthYearModal(state)).toBe(false);
    });

    it("returns false when userId is an empty string (falsy)", () => {
      // AuthState.userId is typed string | null; empty string is falsy
      const state = makeAuthState({ userId: "" });
      expect(canShowBirthYearModal(state)).toBe(false);
    });

    it("returns true (assuming other conditions met) when userId is a non-empty string", () => {
      const state = makeAuthState({ userId: "some-uuid" });
      expect(canShowBirthYearModal(state)).toBe(true);
    });
  });

  // ── Guard 3: birthYear ───────────────────────────────────────────────────

  describe("birthYear guard", () => {
    it("returns false when birthYear is a positive integer (already captured)", () => {
      const state = makeAuthState({ birthYear: 1958 });
      expect(canShowBirthYearModal(state)).toBe(false);
    });

    it("returns false when birthYear is any non-null number", () => {
      // The function checks !== null; zero is technically valid even if
      // semantically nonsense — the guard fires on any number
      const state = makeAuthState({ birthYear: 0 });
      expect(canShowBirthYearModal(state)).toBe(false);
    });

    it("returns true (assuming other conditions met) when birthYear is null", () => {
      const state = makeAuthState({ birthYear: null });
      expect(canShowBirthYearModal(state)).toBe(true);
    });
  });

  // ── Guard 4: birthYearModalDisabled ─────────────────────────────────────

  describe("birthYearModalDisabled guard", () => {
    it("returns false when birthYearModalDisabled is true", () => {
      const state = makeAuthState({ birthYearModalDisabled: true });
      expect(canShowBirthYearModal(state)).toBe(false);
    });

    it("returns true (assuming other conditions met) when birthYearModalDisabled is false", () => {
      const state = makeAuthState({ birthYearModalDisabled: false });
      expect(canShowBirthYearModal(state)).toBe(true);
    });
  });

  // ── Guard 5a: never dismissed (dismissedAt === null) ────────────────────

  describe("birthYearModalDismissedAt === null (vacuous-true cooldown clause)", () => {
    it("returns true when birthYearModalDismissedAt is null and all other conditions satisfied", () => {
      const state = makeAuthState({ birthYearModalDismissedAt: null });
      expect(canShowBirthYearModal(state)).toBe(true);
    });
  });

  // ── Guard 5b: cooldown boundary ─────────────────────────────────────────

  describe("7-day cooldown boundary (inclusive >= operator)", () => {
    it("returns false when dismissed just now (0 ms elapsed)", () => {
      vi.useFakeTimers();
      const now = new Date("2026-04-29T12:00:00.000Z").getTime();
      vi.setSystemTime(now);

      const state = makeAuthState({
        birthYearModalDismissedAt: new Date(now).toISOString(),
      });
      expect(canShowBirthYearModal(state)).toBe(false);
    });

    it("returns false when 1 ms has elapsed (well inside cooldown)", () => {
      vi.useFakeTimers();
      const dismissedAt = new Date("2026-04-29T12:00:00.000Z").getTime();
      vi.setSystemTime(dismissedAt + 1);

      const state = makeAuthState({
        birthYearModalDismissedAt: new Date(dismissedAt).toISOString(),
      });
      expect(canShowBirthYearModal(state)).toBe(false);
    });

    it("returns false when 6 days 23h 59m 59s 999ms have elapsed (1 ms before boundary)", () => {
      vi.useFakeTimers();
      const dismissedAt = new Date("2026-04-22T12:00:00.000Z").getTime();
      const now = dismissedAt + COOLDOWN_MS - 1; // one millisecond short
      vi.setSystemTime(now);

      const state = makeAuthState({
        birthYearModalDismissedAt: new Date(dismissedAt).toISOString(),
      });
      expect(canShowBirthYearModal(state)).toBe(false);
    });

    it("returns true when exactly 7 days have elapsed (boundary is inclusive >=)", () => {
      vi.useFakeTimers();
      const dismissedAt = new Date("2026-04-22T12:00:00.000Z").getTime();
      const now = dismissedAt + COOLDOWN_MS; // exactly 604_800_000 ms
      vi.setSystemTime(now);

      const state = makeAuthState({
        birthYearModalDismissedAt: new Date(dismissedAt).toISOString(),
      });
      expect(canShowBirthYearModal(state)).toBe(true);
    });

    it("returns true when 7 days + 1 ms have elapsed (just past boundary)", () => {
      vi.useFakeTimers();
      const dismissedAt = new Date("2026-04-22T12:00:00.000Z").getTime();
      const now = dismissedAt + COOLDOWN_MS + 1;
      vi.setSystemTime(now);

      const state = makeAuthState({
        birthYearModalDismissedAt: new Date(dismissedAt).toISOString(),
      });
      expect(canShowBirthYearModal(state)).toBe(true);
    });

    it("returns true when 8 full days have elapsed (well past cooldown)", () => {
      vi.useFakeTimers();
      const dismissedAt = new Date("2026-04-21T00:00:00.000Z").getTime();
      const now = dismissedAt + 8 * 24 * 60 * 60 * 1000;
      vi.setSystemTime(now);

      const state = makeAuthState({
        birthYearModalDismissedAt: new Date(dismissedAt).toISOString(),
      });
      expect(canShowBirthYearModal(state)).toBe(true);
    });
  });

  // ── Guard 5c: malformed-date fail-open ──────────────────────────────────

  describe("malformed birthYearModalDismissedAt (NaN-producing) — fail open", () => {
    it("returns true when dismissedAt is 'not-a-date' (Date.parse → NaN)", () => {
      const state = makeAuthState({
        birthYearModalDismissedAt: "not-a-date",
      });
      expect(canShowBirthYearModal(state)).toBe(true);
    });

    it("returns true when dismissedAt is an empty string (Date.parse → NaN)", () => {
      // Empty string: Date.parse("") → NaN on most engines
      const state = makeAuthState({
        birthYearModalDismissedAt: "",
      });
      // Note: Date.parse("") is NaN per spec on V8/Node. If this assertion
      // fails it means the engine parsed "" as something — flag as a
      // production gap (behavior would be undocumented and surprising).
      expect(canShowBirthYearModal(state)).toBe(true);
    });

    it("returns true when dismissedAt is a garbage string", () => {
      const state = makeAuthState({
        birthYearModalDismissedAt: "INVALID_TIMESTAMP_XYZ",
      });
      expect(canShowBirthYearModal(state)).toBe(true);
    });
  });

  // ── Full happy-path: all conditions satisfied ────────────────────────────

  describe("full happy-path — modal eligible", () => {
    it("returns true when user is authenticated, birthYear is null, not disabled, never dismissed", () => {
      const state = makeAuthState({
        isLoading: false,
        userId: "user-xyz",
        birthYear: null,
        birthYearModalDisabled: false,
        birthYearModalDismissedAt: null,
      });
      expect(canShowBirthYearModal(state)).toBe(true);
    });

    it("returns true when all conditions met and cooldown has expired", () => {
      vi.useFakeTimers();
      const dismissedAt = new Date("2026-04-01T00:00:00.000Z").getTime();
      vi.setSystemTime(dismissedAt + COOLDOWN_MS); // exactly at boundary

      const state = makeAuthState({
        isLoading: false,
        userId: "user-xyz",
        birthYear: null,
        birthYearModalDisabled: false,
        birthYearModalDismissedAt: new Date(dismissedAt).toISOString(),
      });
      expect(canShowBirthYearModal(state)).toBe(true);
    });
  });

  // ── Multi-condition false: confirm short-circuit order ───────────────────

  describe("short-circuit ordering — first failing guard wins", () => {
    it("isLoading: true short-circuits before userId check (both failing → false)", () => {
      const state = makeAuthState({ isLoading: true, userId: null });
      // Would be false either way; verifying no exception is thrown at guard 1
      expect(canShowBirthYearModal(state)).toBe(false);
    });

    it("userId null short-circuits before birthYear check (both failing → false)", () => {
      const state = makeAuthState({ userId: null, birthYear: 1960 });
      expect(canShowBirthYearModal(state)).toBe(false);
    });

    it("birthYear present short-circuits before disabled check (both failing → false)", () => {
      const state = makeAuthState({
        birthYear: 1972,
        birthYearModalDisabled: true,
      });
      expect(canShowBirthYearModal(state)).toBe(false);
    });
  });
});
