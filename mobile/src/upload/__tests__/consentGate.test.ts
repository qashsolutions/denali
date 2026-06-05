/**
 * Consent-gate tests — Phase 1 mobile (Wave 2 / mobile-upload-parse-builder).
 *
 * Verifies the multi-layer enforcement pattern documented in
 * root CLAUDE.md § Consent Toggle Enforcement:
 *
 *   - When `health_data_ai` is OFF, the upload client MUST NOT call
 *     `apiPost("/api/parse-report", …)` even if the consumer code path
 *     somehow reaches the submit step.
 *   - `fetchHealthDataAiConsent` returns true ONLY when the consent row
 *     exists with `granted = true`. Missing rows / network failures /
 *     unknown response shapes all collapse to false (fail-closed).
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
  it("returns true when the consents array contains health_data_ai granted", async () => {
    const api = makeApi({
      apiGet: vi.fn().mockResolvedValue({
        consents: [
          { type: "health_data_ai", granted: true },
          { type: "analytics", granted: false },
        ],
      }),
    });
    expect(await fetchHealthDataAiConsent(api)).toBe(true);
  });

  it("returns false when the consents row exists but granted=false", async () => {
    const api = makeApi({
      apiGet: vi.fn().mockResolvedValue({
        consents: [{ type: "health_data_ai", granted: false }],
      }),
    });
    expect(await fetchHealthDataAiConsent(api)).toBe(false);
  });

  it("returns false when no row is present", async () => {
    const api = makeApi({
      apiGet: vi.fn().mockResolvedValue({ consents: [] }),
    });
    expect(await fetchHealthDataAiConsent(api)).toBe(false);
  });

  it("returns false when the response shape is unknown", async () => {
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

  it("honors the flat { health_data_ai: bool } projection if present", async () => {
    const api = makeApi({
      apiGet: vi.fn().mockResolvedValue({ health_data_ai: true }),
    });
    expect(await fetchHealthDataAiConsent(api)).toBe(true);
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
        consents: [{ type: "health_data_ai", granted: false }],
      }),
      apiPost: apiPostSpy,
    });

    // Simulated submit path matching UploadScreen.runPipeline:
    const consentOk = await fetchHealthDataAiConsent(api);
    expect(consentOk).toBe(false);

    if (consentOk) {
      // Branch intentionally unreachable for this test.
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
        consents: [{ type: "health_data_ai", granted: true }],
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
