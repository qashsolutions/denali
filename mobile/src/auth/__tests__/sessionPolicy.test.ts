/**
 * sessionPolicy — unit tests.
 *
 * The 30-day NIST 800-63B cap (D15) is the mobile session-hygiene anchor —
 * deliberately longer than the web's 7-day cap because mobile is local-first
 * and gates launch behind biometrics. These tests pin the boundary so any
 * future tweak surfaces as a deliberate decision.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isSessionExpired, SESSION_MAX_MS } from "../sessionPolicy";

const FIXED_NOW = new Date("2026-06-04T12:00:00.000Z").getTime();

describe("sessionPolicy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exports SESSION_MAX_MS = 30 days exactly", () => {
    expect(SESSION_MAX_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("returns false when sessionIssuedAt is null (no session, not 'expired')", () => {
    expect(isSessionExpired(null)).toBe(false);
  });

  it("returns false at exactly the boundary (=SESSION_MAX_MS old)", () => {
    // Strict inequality in the implementation: `> SESSION_MAX_MS` is expired,
    // `=== SESSION_MAX_MS` is still within bounds. Matches middleware.ts.
    const at = FIXED_NOW - SESSION_MAX_MS;
    expect(isSessionExpired(String(at))).toBe(false);
  });

  it("returns true 1 ms past the boundary", () => {
    const at = FIXED_NOW - SESSION_MAX_MS - 1;
    expect(isSessionExpired(String(at))).toBe(true);
  });

  it("returns false for a session minted 'now'", () => {
    expect(isSessionExpired(String(FIXED_NOW))).toBe(false);
  });

  it("returns true for an obviously stale session", () => {
    const fortyDaysAgo = FIXED_NOW - 40 * 24 * 60 * 60 * 1000;
    expect(isSessionExpired(String(fortyDaysAgo))).toBe(true);
  });

  it("treats a corrupted (non-numeric) value as expired (fail-safe)", () => {
    expect(isSessionExpired("not-a-number")).toBe(true);
    expect(isSessionExpired("")).toBe(true);
  });
});
