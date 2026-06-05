/**
 * consentToggle — pure helper tests.
 *
 * Asserts:
 *   1. buildConsentPatchBody returns the exact shape the web route expects.
 *   2. applyConsentToggle calls apiPatch with the right path + body for
 *      each of the three toggle types.
 */

import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "@/contracts";

import {
  applyConsentToggle,
  buildConsentPatchBody,
} from "../consentToggle";

function makeFakeClient(): ApiClient & { apiPatch: ReturnType<typeof vi.fn> } {
  const apiPatch = vi.fn().mockResolvedValue({ ok: true });
  // Cast through unknown because we only need apiPatch for these tests.
  return {
    apiPatch,
  } as unknown as ApiClient & { apiPatch: ReturnType<typeof vi.fn> };
}

describe("buildConsentPatchBody", () => {
  it("produces { consent_type, granted } shape", () => {
    expect(buildConsentPatchBody("health_data_ai", true)).toEqual({
      consent_type: "health_data_ai",
      granted: true,
    });
    expect(buildConsentPatchBody("analytics", false)).toEqual({
      consent_type: "analytics",
      granted: false,
    });
  });
});

describe("applyConsentToggle", () => {
  it("calls apiPatch with /api/consent + body for health_data_ai true", async () => {
    const client = makeFakeClient();
    await applyConsentToggle(client, "health_data_ai", true);
    expect(client.apiPatch).toHaveBeenCalledTimes(1);
    expect(client.apiPatch).toHaveBeenCalledWith("/api/consent", {
      consent_type: "health_data_ai",
      granted: true,
    });
  });

  it("calls apiPatch with /api/consent + body for health_data_storage false", async () => {
    const client = makeFakeClient();
    await applyConsentToggle(client, "health_data_storage", false);
    expect(client.apiPatch).toHaveBeenCalledWith("/api/consent", {
      consent_type: "health_data_storage",
      granted: false,
    });
  });

  it("calls apiPatch with /api/consent + body for analytics true", async () => {
    const client = makeFakeClient();
    await applyConsentToggle(client, "analytics", true);
    expect(client.apiPatch).toHaveBeenCalledWith("/api/consent", {
      consent_type: "analytics",
      granted: true,
    });
  });
});
