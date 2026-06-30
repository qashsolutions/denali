/**
 * Consent-gate tests — Phase 1 mobile (Wave 2 / mobile-upload-parse-builder).
 *
 * Verifies the multi-layer enforcement pattern documented in
 * root CLAUDE.md § Consent Toggle Enforcement:
 *
 *   - When `health_data_ai` is OFF, the upload client MUST NOT call
 *     `apiPost("/api/parse-report", …)` even if the consumer code path
 *     somehow reaches the submit step.
 *   - `fetchHealthDataAiConsent` returns true ONLY when the route's
 *     `{ consent: { health_data_ai: true } }` map says so. Anything else —
 *     false, missing, unknown shape, network failure — collapses to false
 *     (fail-closed).
 *
 * 2026-06-10: corrected the mocked response to the ACTUAL route shape
 * `{ consent: { health_data_ai, ... } }`. The prior mocks used
 * `{ consents: [...] }` / `{ health_data_ai }`, which never matched the
 * route — so the reader returned false unconditionally and Upload always
 * showed "AI parsing is off".
 */

import { describe, it, expect, vi } from "vitest";

import type { ApiClient } from "@/contracts";

import { fetchHealthDataAiConsent } from "../consentClient";
import { parseReport } from "../parseClient";

function makeApi(overrides: Partial<ApiClient>): ApiClient {
  return {
    sendOtp: vi.fn(),
    verifyOtp: vi.fn(),
    refresh: vi.fn(),
    signOut: vi.fn(),
    isAuthenticated: () => true,
    getCurrentUser: () => ({ userId: "u-1", email: "x@y.z" }),
    onSignInRequired: () => () => {},
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiPatch: vi.fn(),
    apiDelete: vi.fn(),
    chat: vi.fn(),
    ...overrides,
  } as ApiClient;
}

describe("fetchHealthDataAiConsent — fail-closed semantics", () => {
  it("returns true when consent.health_data_ai is true (real route shape)", async () => {
    const api = makeApi({
      apiGet: vi.fn().mockResolvedValue({
        consent: {
          health_data_ai: true,
          health_data_storage: false,
          analytics: false,
        },
      }),
    });
    expect(await fetchHealthDataAiConsent(api)).toBe(true);
  });

  it("returns false when consent.health_data_ai is false", async () => {
    const api = makeApi({
      apiGet: vi.fn().mockResolvedValue({
        consent: { health_data_ai: false },
      }),
    });
    expect(await fetchHealthDataAiConsent(api)).toBe(false);
  });

  it("returns false when health_data_ai is absent from the consent map", async () => {
    const api = makeApi({
      apiGet: vi.fn().mockResolvedValue({ consent: {} }),
    });
    expect(await fetchHealthDataAiConsent(api)).toBe(false);
  });

  it("returns false when the response shape is unknown (no consent key)", async () => {
    const api = makeApi({
      apiGet: vi.fn().mockResolvedValue({ unexpected: "shape" }),
    });
    expect(await fetchHealthDataAiConsent(api)).toBe(false);
  });

  it("returns false when the network call fails (fail-closed)", async () => {
    const api = makeApi({
      apiGet: vi.fn().mockRejectedValue(new Error("network down")),
    });
    expect(await fetchHealthDataAiConsent(api)).toBe(false);
  });
});

describe("consent gate — parse-report MUST NOT be called when consent is OFF", () => {
  // Simulates the UploadScreen submit path: caller checks
  // fetchHealthDataAiConsent first; if false, returns without invoking
  // parseReport. This test asserts the contract by exercising the consent
  // helper + ensuring apiPost was never called when consent is false.

  it("apiPost is never called when consent fetch returns false", async () => {
    const apiPostSpy = vi.fn();
    const api = makeApi({
      apiGet: vi.fn().mockResolvedValue({
        consent: { health_data_ai: false },
      }),
      apiPost: apiPostSpy,
    });

    const consentOk = await fetchHealthDataAiConsent(api);
    expect(consentOk).toBe(false);

    if (consentOk) {
      await parseReport(api, {
        reportType: "lab",
        extractedText: "should not be sent",
      });
    }

    expect(apiPostSpy).not.toHaveBeenCalled();
  });

  it("apiPost IS called when consent fetch returns true", async () => {
    const apiPostSpy = vi.fn().mockResolvedValue({
      observations: [],
      summary: "ok",
    });
    const api = makeApi({
      apiGet: vi.fn().mockResolvedValue({
        consent: { health_data_ai: true },
      }),
      apiPost: apiPostSpy,
    });

    const consentOk = await fetchHealthDataAiConsent(api);
    expect(consentOk).toBe(true);

    if (consentOk) {
      await parseReport(api, {
        reportType: "lab",
        extractedText: "real text",
      });
    }

    expect(apiPostSpy).toHaveBeenCalledTimes(1);
    const [path, body] = apiPostSpy.mock.calls[0];
    expect(path).toBe("/api/parse-report");
    expect(body).toMatchObject({
      report_type: "lab",
      extracted_text: "real text",
    });
  });
});
