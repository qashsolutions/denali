import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * MedicareOnboardingForm — Pure Helper Tests (no React render)
 *
 * Tests the extracted helpers in isolation:
 *   - submitOnboarding()       — PATCH /api/profile with the typed payload
 *   - buildOnboardingPayload() — payload-construction logic (Step 6)
 *   - canSubmitOnboarding()    — submit-enabled gate
 *   - healMedicareCookie()     — GET /api/profile cookie heal
 *
 * Node environment (no jsdom). No React. No router. Form rendering and
 * navigation are covered by Playwright E2E — see docs/reference/testing.md.
 * The "use client" directive is on the default export, not the named exports,
 * so these can be imported in a node test context.
 */

// next/navigation is imported by the module. Mock it so the module loads cleanly.
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn() })),
}));

// react hooks are imported by the module. Mock them so the module loads cleanly.
vi.mock("react", async (importOriginal) => {
  const original = await importOriginal<typeof import("react")>();
  return {
    ...original,
    useState: vi.fn((init: unknown) => [init, vi.fn()]),
    useEffect: vi.fn(),
  };
});

import {
  submitOnboarding,
  buildOnboardingPayload,
  canSubmitOnboarding,
  healMedicareCookie,
  type OnboardingPayload,
} from "../MedicareOnboardingForm";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = mockFetch;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── canSubmitOnboarding — submit-enabled gate ──────────────────────────────

describe("canSubmitOnboarding", () => {
  it("returns true when both required fields are answered", () => {
    expect(canSubmitOnboarding("male", true)).toBe(true);
    expect(canSubmitOnboarding("female", false)).toBe(true);
    expect(canSubmitOnboarding("unknown", true)).toBe(true);
  });

  it("returns false when sex_at_birth is null (Medicare answered)", () => {
    expect(canSubmitOnboarding(null, true)).toBe(false);
    expect(canSubmitOnboarding(null, false)).toBe(false);
  });

  it("returns false when isOnMedicare is null (sex_at_birth answered)", () => {
    expect(canSubmitOnboarding("male", null)).toBe(false);
    expect(canSubmitOnboarding("female", null)).toBe(false);
  });

  it("returns false when both are null", () => {
    expect(canSubmitOnboarding(null, null)).toBe(false);
  });

  // gender_identity is NOT part of the gate — it's optional.
});

// ─── buildOnboardingPayload — payload construction ──────────────────────────

describe("buildOnboardingPayload", () => {
  it("includes both required fields when gender_identity is null", () => {
    const payload = buildOnboardingPayload("male", true, null);
    expect(payload).toEqual({
      is_on_medicare: true,
      sex_at_birth: "male",
    });
    // Critical: gender_identity key must NOT be present when null.
    // Step 5's PATCH uses `"gender_identity" in body` to decide whether to
    // touch the column — omitting the key is the "don't touch" signal.
    expect("gender_identity" in payload).toBe(false);
  });

  it("includes gender_identity when the user selected a value", () => {
    const payload = buildOnboardingPayload("female", false, "non-binary");
    expect(payload).toEqual({
      is_on_medicare: false,
      sex_at_birth: "female",
      gender_identity: "non-binary",
    });
  });

  it("maps Prefer-not-to-say UI selection to sex_at_birth='unknown' in payload", () => {
    const payload = buildOnboardingPayload("unknown", true, null);
    expect(payload.sex_at_birth).toBe("unknown");
  });

  it("supports every GenderIdentity enum value", () => {
    const values = [
      "male",
      "female",
      "non-binary",
      "transgender-male",
      "transgender-female",
      "other",
      "prefer-not-to-say",
    ] as const;
    for (const gi of values) {
      const payload = buildOnboardingPayload("male", true, gi);
      expect(payload.gender_identity).toBe(gi);
    }
  });
});

// ─── submitOnboarding — PATCH call shape ────────────────────────────────────

describe("submitOnboarding", () => {
  it("calls /api/profile with PATCH, JSON body, and credentials", async () => {
    const fakeResponse = new Response(JSON.stringify({ success: true }), {
      status: 200,
    });
    mockFetch.mockResolvedValue(fakeResponse);

    const payload: OnboardingPayload = {
      is_on_medicare: true,
      sex_at_birth: "male",
    };
    const result = await submitOnboarding(payload);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/profile");
    expect(init.method).toBe("PATCH");
    expect(init.credentials).toBe("include");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
    expect(init.body).toBe(JSON.stringify(payload));
    expect(result).toBe(fakeResponse);
  });

  it("serializes a full three-field payload (onboarding happy path)", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );

    await submitOnboarding({
      is_on_medicare: true,
      sex_at_birth: "female",
      gender_identity: "female",
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const parsed = JSON.parse(init.body as string);
    expect(parsed).toEqual({
      is_on_medicare: true,
      sex_at_birth: "female",
      gender_identity: "female",
    });
  });

  it("does NOT include gender_identity key when the payload omits it", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );

    // Builder used in production: gender_identity null → key omitted entirely.
    const payload = buildOnboardingPayload("male", true, null);
    await submitOnboarding(payload);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const parsed = JSON.parse(init.body as string);
    expect("gender_identity" in parsed).toBe(false);
  });

  it("returns the fetch Response object directly (caller inspects status)", async () => {
    const fakeResponse = new Response(
      JSON.stringify({ error: "bad", field: "sex_at_birth" }),
      { status: 400 },
    );
    mockFetch.mockResolvedValue(fakeResponse);

    const result = await submitOnboarding({
      is_on_medicare: true,
      sex_at_birth: "male",
    });
    expect(result).toBe(fakeResponse);
    expect(result.status).toBe(400);
  });
});

// ─── healMedicareCookie — GET /api/profile heal (unchanged from Chunk 2) ────

describe("healMedicareCookie", () => {
  it("calls /api/profile with credentials:include and no explicit method (GET)", async () => {
    const fakeResponse = new Response(JSON.stringify({ authenticated: true }), {
      status: 200,
    });
    mockFetch.mockResolvedValue(fakeResponse);

    const result = await healMedicareCookie();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/profile");
    expect(init.credentials).toBe("include");
    // No method override — browser defaults to GET
    expect((init as { method?: string }).method).toBeUndefined();
    expect(result).toBe(fakeResponse);
  });

  it("returns null when fetch throws (network error)", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await healMedicareCookie();

    expect(result).toBeNull();
  });

  it("returns the response even on a non-200 status (error handling is caller's job)", async () => {
    const fakeResponse = new Response(null, { status: 401 });
    mockFetch.mockResolvedValue(fakeResponse);

    const result = await healMedicareCookie();
    expect(result).toBe(fakeResponse);
  });
});
