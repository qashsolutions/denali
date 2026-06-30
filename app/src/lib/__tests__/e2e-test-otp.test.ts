/**
 * N1-N7 negative tests for the Phase-2 E2E test-OTP bypass.
 *
 * The five-guard stack is asserted to be unreachable in production
 * regardless of any single misconfiguration. The startup assertion
 * (N7) further proves the contradiction is impossible to ship — the
 * Node process refuses to boot in that state.
 *
 * Test layout mirrors the deltas:
 *   N1: prod env + flag + everything else right → G2 deny.
 *   N2: staging env + flag absent → G1 deny.
 *   N3: staging + flag + non-allowlisted email → G3 deny.
 *   N4: staging + flag + right email + wrong code → G4 deny.
 *   N5: staging + everything + missing static password → G5 deny.
 *   N6: when the helper returns `allowed:false`, callers can safely
 *       fall through to the real OTP path (no side effects observable
 *       from outside the helper).
 *   N7: STARTUP — prod+flag throws on module load; staging+flag boots;
 *       prod+no-flag boots.
 *
 * Plus delta-specific assertions:
 *   - G1/G2 denials do NOT log (delta 2).
 *   - G3/G4/G5 denials DO log (`[E2E_TEST_OTP]` prefix).
 *   - host check is exact match against prod allowlist (delta 5) so
 *     staging.denali.health is NEVER caught.
 *   - sex-fallback shape of G4 uses constant-time compare.
 *   - PROD_HOST_ALLOWLIST contains exactly {"denali.health",
 *     "www.denali.health"}.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

// `vi.stubEnv` sidesteps `@types/node`'s read-only NODE_ENV typing
// AND restores the env automatically via `vi.unstubAllEnvs()` in
// afterEach. We import the module under test lazily inside each test
// so the module-load startup assertion can be exercised under
// different env configurations.

/** Wipe every env key the helper reads so each test starts from a known state. */
function clearEnv(): void {
  vi.stubEnv("NODE_ENV", "");
  vi.stubEnv("E2E_TEST_OTP_ENABLED", "");
  vi.stubEnv("E2E_TEST_OTP_EMAILS", "");
  vi.stubEnv("E2E_TEST_OTP_CODE", "");
  vi.stubEnv("E2E_TEST_OTP_STATIC_PASSWORD", "");
}

/** Happy-path staging env — every test starts here and removes one
 * thing to assert which guard catches it. */
function setStagingEnv(): void {
  vi.stubEnv("NODE_ENV", "development"); // anything non-"production"
  vi.stubEnv("E2E_TEST_OTP_ENABLED", "true");
  vi.stubEnv("E2E_TEST_OTP_EMAILS", "e2e@denali.health");
  vi.stubEnv("E2E_TEST_OTP_CODE", "999999");
  vi.stubEnv("E2E_TEST_OTP_STATIC_PASSWORD", "Staging-E2E-Pwd-1!");
}

const STAGING_HOST = "staging.denali.health";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.restoreAllMocks();
});

// ─── N1 / N2 / N3 / N4 / N5 — runtime guard returns ─────────────────────

describe("N1: prod env + flag + right code + allowlisted email → G2 denial", () => {
  // The module-load assertion (N7) crashes the process if we import
  // with NODE_ENV=production AND the flag set — that path is tested
  // separately. Here we boot the module in safe state and flip
  // NODE_ENV at request time to assert the request-time guard ALSO
  // catches (defense in depth: even if the boot guard somehow doesn't
  // fire, the runtime guard still denies).
  it("runtime helper denies with G2 when NODE_ENV is production", async () => {
    // Boot the module in safe state, then flip NODE_ENV for the call.
    setStagingEnv();
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const { assertE2eTestBypassAllowed } = await import("../e2e-test-otp");
    vi.stubEnv("NODE_ENV", "production");
    const result = await assertE2eTestBypassAllowed({
      email: "e2e@denali.health",
      code: "999999",
      host: STAGING_HOST,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.guard).toBe("G2");
  });

  it("runtime helper denies with G2 when host matches prod allowlist (delta 5: exact match)", async () => {
    setStagingEnv();
    vi.resetModules();
    const { assertE2eTestBypassAllowed } = await import("../e2e-test-otp");
    for (const prodHost of ["denali.health", "www.denali.health"]) {
      const result = await assertE2eTestBypassAllowed({
        email: "e2e@denali.health",
        code: "999999",
        host: prodHost,
      });
      expect(result.allowed).toBe(false);
      if (!result.allowed) expect(result.guard).toBe("G2");
    }
  });

  it("does NOT catch staging.denali.health (delta 5: substring shouldn't match)", async () => {
    setStagingEnv();
    vi.resetModules();
    const { assertE2eTestBypassAllowed } = await import("../e2e-test-otp");
    // staging.denali.health contains "denali.health" — must not catch.
    const result = await assertE2eTestBypassAllowed({
      email: "e2e@denali.health",
      code: "999999",
      host: STAGING_HOST,
    });
    expect(result.allowed).toBe(true);
  });
});

describe("N2: staging env + E2E_TEST_OTP_ENABLED absent → G1 denial", () => {
  it("returns { allowed: false, guard: 'G1' } when flag is unset", async () => {
    setStagingEnv();
    delete process.env.E2E_TEST_OTP_ENABLED;
    vi.resetModules();
    const { assertE2eTestBypassAllowed } = await import("../e2e-test-otp");
    const result = await assertE2eTestBypassAllowed({
      email: "e2e@denali.health",
      code: "999999",
      host: STAGING_HOST,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.guard).toBe("G1");
  });

  it("treats 'TRUE' / '1' / truthy non-'true' as flag NOT SET (exact string match)", async () => {
    setStagingEnv();
    vi.resetModules();
    const { assertE2eTestBypassAllowed } = await import("../e2e-test-otp");
    for (const bad of ["TRUE", "True", "1", "yes", "y", " true ", "true\n"]) {
      process.env.E2E_TEST_OTP_ENABLED = bad;
      const result = await assertE2eTestBypassAllowed({
        email: "e2e@denali.health",
        code: "999999",
        host: STAGING_HOST,
      });
      expect(result.allowed).toBe(false);
      if (!result.allowed) expect(result.guard).toBe("G1");
    }
  });
});

describe("N3: staging + flag on + non-allowlisted email → G3 denial", () => {
  it("returns { allowed: false, guard: 'G3' } for an email not on the allowlist", async () => {
    setStagingEnv();
    vi.resetModules();
    const { assertE2eTestBypassAllowed } = await import("../e2e-test-otp");
    const result = await assertE2eTestBypassAllowed({
      email: "random@example.com",
      code: "999999",
      host: STAGING_HOST,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.guard).toBe("G3");
  });

  it("denies G3 when E2E_TEST_OTP_EMAILS is empty/missing (no allowlist == no test users)", async () => {
    setStagingEnv();
    delete process.env.E2E_TEST_OTP_EMAILS;
    vi.resetModules();
    const { assertE2eTestBypassAllowed } = await import("../e2e-test-otp");
    const result = await assertE2eTestBypassAllowed({
      email: "e2e@denali.health",
      code: "999999",
      host: STAGING_HOST,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.guard).toBe("G3");
  });
});

describe("N4: staging + flag on + right email + wrong code → G4 denial", () => {
  it("returns { allowed: false, guard: 'G4' } for a wrong code", async () => {
    setStagingEnv();
    vi.resetModules();
    const { assertE2eTestBypassAllowed } = await import("../e2e-test-otp");
    const result = await assertE2eTestBypassAllowed({
      email: "e2e@denali.health",
      code: "123456",
      host: STAGING_HOST,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.guard).toBe("G4");
  });

  it("denies G4 when E2E_TEST_OTP_CODE is missing (empty expected → never matches)", async () => {
    setStagingEnv();
    delete process.env.E2E_TEST_OTP_CODE;
    vi.resetModules();
    const { assertE2eTestBypassAllowed } = await import("../e2e-test-otp");
    const result = await assertE2eTestBypassAllowed({
      email: "e2e@denali.health",
      code: "999999",
      host: STAGING_HOST,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.guard).toBe("G4");
  });
});

describe("N5: staging + flag + email + code right + missing static password → G5 denial", () => {
  it("returns { allowed: false, guard: 'G5' } when E2E_TEST_OTP_STATIC_PASSWORD is missing", async () => {
    setStagingEnv();
    delete process.env.E2E_TEST_OTP_STATIC_PASSWORD;
    vi.resetModules();
    const { assertE2eTestBypassAllowed } = await import("../e2e-test-otp");
    const result = await assertE2eTestBypassAllowed({
      email: "e2e@denali.health",
      code: "999999",
      host: STAGING_HOST,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.guard).toBe("G5");
  });

  it("denies G5 when password is empty string", async () => {
    setStagingEnv();
    process.env.E2E_TEST_OTP_STATIC_PASSWORD = "";
    vi.resetModules();
    const { assertE2eTestBypassAllowed } = await import("../e2e-test-otp");
    const result = await assertE2eTestBypassAllowed({
      email: "e2e@denali.health",
      code: "999999",
      host: STAGING_HOST,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.guard).toBe("G5");
  });
});

describe("Happy path: all five guards passed → { allowed: true, staticPassword }", () => {
  it("returns allowed=true with the static password when all guards pass", async () => {
    setStagingEnv();
    vi.resetModules();
    const { assertE2eTestBypassAllowed } = await import("../e2e-test-otp");
    const result = await assertE2eTestBypassAllowed({
      email: "e2e@denali.health",
      code: "999999",
      host: STAGING_HOST,
    });
    expect(result.allowed).toBe(true);
    if (result.allowed) expect(result.staticPassword).toBe("Staging-E2E-Pwd-1!");
  });
});

// ─── N6 — real OTP path unchanged when mode is off ──────────────────────

describe("N6: real OTP path unchanged when E2E mode is off", () => {
  it("with flag absent the helper denies at G1 with no env-var reads beyond NODE_ENV/flag", async () => {
    clearEnv();
    // NODE_ENV intentionally unset.
    vi.resetModules();
    const { assertE2eTestBypassAllowed } = await import("../e2e-test-otp");
    // No EMAIL / CODE / PASSWORD env vars configured AT ALL.
    const result = await assertE2eTestBypassAllowed({
      email: "anyone@example.com",
      code: "111111",
      host: "anyhost.example.com",
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.guard).toBe("G1");
  });

  it("returning allowed:false means the route falls through — helper itself has no side effects", async () => {
    // We can't directly observe "no DB write" from a unit test of the
    // helper, but the helper's return shape (no DB / Cognito calls in
    // its body) is its contract. Reading the source confirms it.
    setStagingEnv();
    delete process.env.E2E_TEST_OTP_ENABLED;
    vi.resetModules();
    const { assertE2eTestBypassAllowed } = await import("../e2e-test-otp");
    // Call twice with G1-denial; assert idempotent.
    const r1 = await assertE2eTestBypassAllowed({
      email: "any@e",
      code: "x",
      host: "y",
    });
    const r2 = await assertE2eTestBypassAllowed({
      email: "any@e",
      code: "x",
      host: "y",
    });
    expect(r1).toEqual(r2);
    expect(r1.allowed).toBe(false);
  });
});

// ─── N7 — module-load startup assertion ────────────────────────────────

describe("N7: STARTUP fail-closed assertion (delta 4 backup)", () => {
  it("prod + flag set → throws on first import (refuses to boot)", async () => {
    clearEnv();
    vi.stubEnv("NODE_ENV", "production");
    process.env.E2E_TEST_OTP_ENABLED = "true";
    vi.resetModules();
    await expect(import("../e2e-test-otp")).rejects.toThrow(
      /FATAL.*production/i,
    );
  });

  it("staging + flag set → boots normally", async () => {
    clearEnv();
    vi.stubEnv("NODE_ENV", "development");
    process.env.E2E_TEST_OTP_ENABLED = "true";
    vi.resetModules();
    await expect(import("../e2e-test-otp")).resolves.toBeDefined();
  });

  it("prod + flag unset → boots normally (real production path)", async () => {
    clearEnv();
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.E2E_TEST_OTP_ENABLED;
    vi.resetModules();
    await expect(import("../e2e-test-otp")).resolves.toBeDefined();
  });

  it("staging + flag unset → boots normally", async () => {
    clearEnv();
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.E2E_TEST_OTP_ENABLED;
    vi.resetModules();
    await expect(import("../e2e-test-otp")).resolves.toBeDefined();
  });
});

// ─── delta-2 logging behavior ──────────────────────────────────────────

describe("Logging behavior (delta 2)", () => {
  it("G1 denial does NOT log", async () => {
    clearEnv();
    vi.stubEnv("NODE_ENV", "development");
    // E2E_TEST_OTP_ENABLED absent → G1
    vi.resetModules();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { assertE2eTestBypassAllowed } = await import("../e2e-test-otp");
    await assertE2eTestBypassAllowed({
      email: "e2e@denali.health",
      code: "999999",
      host: STAGING_HOST,
    });
    expect(warnSpy).not.toHaveBeenCalledWith(
      "[E2E_TEST_OTP]",
      expect.anything(),
    );
  });

  it("G2 denial does NOT log", async () => {
    setStagingEnv();
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { assertE2eTestBypassAllowed } = await import("../e2e-test-otp");
    vi.stubEnv("NODE_ENV", "production");
    await assertE2eTestBypassAllowed({
      email: "e2e@denali.health",
      code: "999999",
      host: STAGING_HOST,
    });
    expect(warnSpy).not.toHaveBeenCalledWith(
      "[E2E_TEST_OTP]",
      expect.anything(),
    );
  });

  it("G3 denial DOES log with [E2E_TEST_OTP] prefix and outcome=denied_guard_fail", async () => {
    setStagingEnv();
    vi.resetModules();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { assertE2eTestBypassAllowed } = await import("../e2e-test-otp");
    await assertE2eTestBypassAllowed({
      email: "wrong@example.com",
      code: "999999",
      host: STAGING_HOST,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "[E2E_TEST_OTP]",
      expect.stringContaining('"deniedGuard":"G3"'),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      "[E2E_TEST_OTP]",
      expect.stringContaining('"outcome":"denied_guard_fail"'),
    );
  });

  it("G4 denial DOES log with deniedGuard=G4", async () => {
    setStagingEnv();
    vi.resetModules();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { assertE2eTestBypassAllowed } = await import("../e2e-test-otp");
    await assertE2eTestBypassAllowed({
      email: "e2e@denali.health",
      code: "111111",
      host: STAGING_HOST,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "[E2E_TEST_OTP]",
      expect.stringContaining('"deniedGuard":"G4"'),
    );
  });

  it("G5 denial DOES log with deniedGuard=G5", async () => {
    setStagingEnv();
    delete process.env.E2E_TEST_OTP_STATIC_PASSWORD;
    vi.resetModules();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { assertE2eTestBypassAllowed } = await import("../e2e-test-otp");
    await assertE2eTestBypassAllowed({
      email: "e2e@denali.health",
      code: "999999",
      host: STAGING_HOST,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "[E2E_TEST_OTP]",
      expect.stringContaining('"deniedGuard":"G5"'),
    );
  });

  it("Success DOES log with outcome=allowed", async () => {
    setStagingEnv();
    vi.resetModules();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { assertE2eTestBypassAllowed } = await import("../e2e-test-otp");
    await assertE2eTestBypassAllowed({
      email: "e2e@denali.health",
      code: "999999",
      host: STAGING_HOST,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "[E2E_TEST_OTP]",
      expect.stringContaining('"outcome":"allowed"'),
    );
  });
});

// ─── PROD_HOST_ALLOWLIST shape ─────────────────────────────────────────

describe("PROD_HOST_ALLOWLIST contents", () => {
  it("contains exactly the two prod host strings (delta 5)", async () => {
    setStagingEnv();
    vi.resetModules();
    const { __TEST_ONLY } = await import("../e2e-test-otp");
    expect(__TEST_ONLY.PROD_HOST_ALLOWLIST.has("denali.health")).toBe(true);
    expect(__TEST_ONLY.PROD_HOST_ALLOWLIST.has("www.denali.health")).toBe(true);
    expect(__TEST_ONLY.PROD_HOST_ALLOWLIST.has("staging.denali.health")).toBe(false);
    expect(__TEST_ONLY.PROD_HOST_ALLOWLIST.size).toBe(2);
  });
});

// ─── Constant-time compare smoke ───────────────────────────────────────

describe("constantTimeEqual", () => {
  it("returns true for equal strings", async () => {
    setStagingEnv();
    vi.resetModules();
    const { __TEST_ONLY } = await import("../e2e-test-otp");
    expect(__TEST_ONLY.constantTimeEqual("999999", "999999")).toBe(true);
  });
  it("returns false for unequal strings of equal length", async () => {
    setStagingEnv();
    vi.resetModules();
    const { __TEST_ONLY } = await import("../e2e-test-otp");
    expect(__TEST_ONLY.constantTimeEqual("999999", "999998")).toBe(false);
  });
  it("returns false for strings of different lengths", async () => {
    setStagingEnv();
    vi.resetModules();
    const { __TEST_ONLY } = await import("../e2e-test-otp");
    expect(__TEST_ONLY.constantTimeEqual("999999", "9999999")).toBe(false);
    expect(__TEST_ONLY.constantTimeEqual("999999", "")).toBe(false);
  });
});

// ─── N8 — send-otp rotation-skip guard (G1-G3 subset, no code / password) ──
// send-otp runs BEFORE any code is entered, so its rotation-skip guard checks
// only G1-G3. It must deny in prod exactly like the full bypass, so the static
// test password is kept (rotation skipped) ONLY in a NODE_ENV != production env.
describe("N8: assertE2eTestSendBypassAllowed (send-otp rotation skip)", () => {
  const SEND = { email: "e2e@denali.health", host: STAGING_HOST };

  it("returns true when G1-G3 pass", async () => {
    setStagingEnv();
    vi.resetModules();
    const { assertE2eTestSendBypassAllowed } = await import("../e2e-test-otp");
    expect(await assertE2eTestSendBypassAllowed(SEND)).toBe(true);
  });

  it("returns false (G1) when the flag is unset", async () => {
    setStagingEnv();
    vi.stubEnv("E2E_TEST_OTP_ENABLED", "");
    vi.resetModules();
    const { assertE2eTestSendBypassAllowed } = await import("../e2e-test-otp");
    expect(await assertE2eTestSendBypassAllowed(SEND)).toBe(false);
  });

  it("returns false (G2) when NODE_ENV is production", async () => {
    // Boot in a safe state (the startup assertion refuses to boot when flag +
    // prod coexist), then flip NODE_ENV at request time — same as the N1 tests.
    setStagingEnv();
    vi.resetModules();
    const { assertE2eTestSendBypassAllowed } = await import("../e2e-test-otp");
    vi.stubEnv("NODE_ENV", "production");
    expect(await assertE2eTestSendBypassAllowed(SEND)).toBe(false);
  });

  it("returns false (G2) when host is a prod host", async () => {
    setStagingEnv();
    vi.resetModules();
    const { assertE2eTestSendBypassAllowed } = await import("../e2e-test-otp");
    expect(
      await assertE2eTestSendBypassAllowed({
        email: "e2e@denali.health",
        host: "denali.health",
      }),
    ).toBe(false);
  });

  it("returns false (G3) when the email is not allowlisted", async () => {
    setStagingEnv();
    vi.resetModules();
    const { assertE2eTestSendBypassAllowed } = await import("../e2e-test-otp");
    expect(
      await assertE2eTestSendBypassAllowed({
        email: "attacker@evil.com",
        host: STAGING_HOST,
      }),
    ).toBe(false);
  });
});
