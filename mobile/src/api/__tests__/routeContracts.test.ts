/**
 * Route-contract pinning tests.
 *
 * These pin each mobile client's produced request body / parsed response to
 * the wire shapes in `src/api/routeContracts.ts`. They exist because three
 * production bugs in one session (2026-06-10) were mobile-side shape drift
 * that nothing caught until on-device:
 *   - consent WRITE: PATCH + snake_case vs route PUT + camelCase → 405/400.
 *   - consent READ: parsed `{health_data_ai}` vs route `{consent:{…}}` → false.
 *   - chat: sent `{content,history}` vs route `{messages}` → 400.
 *
 * Each test asserts BOTH the runtime shape AND (via a typed `satisfies`
 * assignment) that the builder's return type is assignable to the contract.
 * A camelCase/snake_case slip, a missing key, or a renamed field now fails
 * either typecheck or this suite.
 *
 * NOTE on scope: this catches MOBILE-side drift. If an `app/` route changes
 * its shape, routeContracts.ts must be hand-updated (the `@see` citations
 * make that findable) — mobile and app are separate TS projects.
 */

import { describe, expect, it, vi } from "vitest";

// buildChatWireBody lives in chatStream.ts, which transitively imports the
// expo/RN runtime (config/env → expo-constants, tokenStore → secure-store).
// Stub both so this node-env suite can import the pure builder — same
// pattern as src/auth/__tests__/chatStream.test.ts.
vi.mock("@/config/env", () => ({
  API_BASE_URL: "https://test.denali.health",
}));
vi.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  setItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import type {
  ChatWireRequest,
  ConsentGetResponse,
  ConsentWriteRequest,
  ParseReportRequest,
  ProfilePatchRequest,
} from "@/api/routeContracts";
import { buildChatWireBody } from "@/auth/chatStream";
import type { ApiClient, ChatTurnInput } from "@/contracts";
import { buildCohortPayload } from "@/onboarding/cohortPayload";
import { fetchHealthDataAiConsent } from "@/upload/consentClient";
import { buildParseReportBody } from "@/upload/parseClient";
import { buildConsentPatchBody } from "@/screens/settings/consentToggle";

describe("buildChatWireBody → ChatWireRequest", () => {
  it("uses history as the messages array when present", () => {
    const input: ChatTurnInput = {
      content: "what's my A1c trend?",
      history: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
        { role: "user", content: "what's my A1c trend?" },
      ],
      noPersist: true,
    };
    const body = buildChatWireBody(input);
    // Type-level pin: must be assignable to the contract.
    const pinned: ChatWireRequest = body;
    expect(pinned.messages).toHaveLength(3);
    expect(pinned.messages[2]).toEqual({
      role: "user",
      content: "what's my A1c trend?",
    });
    expect(pinned.noPersist).toBe(true);
  });

  it("falls back to a single user turn when history is absent", () => {
    const input: ChatTurnInput = { content: "hello there", noPersist: true };
    const body = buildChatWireBody(input);
    expect(body.messages).toEqual([
      { role: "user", content: "hello there" },
    ]);
  });

  it("includes modelOverride only when provided", () => {
    const withOverride = buildChatWireBody({
      content: "x",
      noPersist: true,
      modelOverride: "haiku",
    });
    expect(withOverride.modelOverride).toBe("haiku");

    const without = buildChatWireBody({ content: "x", noPersist: true });
    expect(without).not.toHaveProperty("modelOverride");
  });

  it("never emits the rejected {content,history} top-level keys", () => {
    const body = buildChatWireBody({
      content: "x",
      history: [{ role: "user", content: "x" }],
      noPersist: true,
    });
    // The route validates `messages` before the consent gate — these
    // top-level keys were the 400.
    expect(body).not.toHaveProperty("content");
    expect(body).not.toHaveProperty("history");
  });
});

describe("buildConsentPatchBody → ConsentWriteRequest", () => {
  it("emits camelCase `consentType` (NOT snake_case)", () => {
    const body = buildConsentPatchBody("health_data_ai", true);
    const pinned: ConsentWriteRequest = body;
    expect(pinned).toEqual({ consentType: "health_data_ai", granted: true });
    // The 405/400 bug: the key was `consent_type`. Pin it gone.
    expect(body).not.toHaveProperty("consent_type");
  });
});

describe("buildParseReportBody → ParseReportRequest", () => {
  it("emits snake_case keys and omits locale when absent", () => {
    const body = buildParseReportBody({
      reportType: "lab",
      extractedText: "A1c 6.1%",
    });
    const pinned: ParseReportRequest = body;
    expect(pinned).toEqual({ report_type: "lab", extracted_text: "A1c 6.1%" });
    expect(body).not.toHaveProperty("locale");
  });

  it("includes locale when provided", () => {
    const body = buildParseReportBody({
      reportType: "ehr",
      extractedText: "x",
      locale: "en-US",
    });
    expect(body.locale).toBe("en-US");
  });
});

describe("buildCohortPayload → ProfilePatchRequest (snake_case)", () => {
  it("produces a body assignable to the PATCH /api/profile contract", () => {
    const payload = buildCohortPayload({
      birthYear: 1968,
      sexAtBirth: "female",
      isOnMedicare: false,
      genderIdentity: null,
    });
    // Type-level pin: the stricter CohortPayload must remain a valid
    // ProfilePatchRequest. A camelCase slip (birthYear) breaks this line.
    const pinned: ProfilePatchRequest = payload;
    expect(pinned).toEqual({
      birth_year: 1968,
      is_on_medicare: false,
      sex_at_birth: "female",
    });
  });
});

describe("fetchHealthDataAiConsent ← ConsentGetResponse", () => {
  function stubApi(get: () => Promise<unknown>): ApiClient {
    return { apiGet: () => get() } as unknown as ApiClient;
  }

  it("reads `consent.health_data_ai === true` from the contract shape", async () => {
    const res: ConsentGetResponse = {
      consent: {
        health_data_ai: true,
        health_data_storage: false,
        analytics: false,
      },
    };
    const api = stubApi(async () => res);
    expect(await fetchHealthDataAiConsent(api)).toBe(true);
  });

  it("returns false when health_data_ai is false", async () => {
    const api = stubApi(async () => ({
      consent: {
        health_data_ai: false,
        health_data_storage: true,
        analytics: true,
      },
    }));
    expect(await fetchHealthDataAiConsent(api)).toBe(false);
  });

  it("fails closed (false) on the OLD wrong shapes that caused the bug", async () => {
    // Pre-fix the client parsed these; the route never sent them.
    const flat = stubApi(async () => ({ health_data_ai: true }));
    expect(await fetchHealthDataAiConsent(flat)).toBe(false);

    const list = stubApi(async () => ({ consents: [{ health_data_ai: true }] }));
    expect(await fetchHealthDataAiConsent(list)).toBe(false);
  });

  it("fails closed (false) when the call throws", async () => {
    const api = stubApi(async () => {
      throw new Error("network");
    });
    expect(await fetchHealthDataAiConsent(api)).toBe(false);
  });
});
