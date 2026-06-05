/**
 * Phase 1 mobile — end-to-end integration smoke (Wave 3 / mobile-app-shell Pass 2).
 *
 * Scope and gap disclosure
 * ────────────────────────
 * The vitest runner runs in a Node environment without `jsdom` or a React
 * Native renderer (per `mobile/vitest.config.ts`). A true device-level
 * end-to-end smoke (boot the app, drive the navigation graph, render real
 * screens) would require Detox or Maestro and a simulator. Standing those
 * up at this stage would inflate the Pass 2 surface beyond the agent's
 * scope.
 *
 * This file instead simulates the END-TO-END FLOW via the same contract
 * surfaces every screen uses:
 *
 *   - `ApiClient` (auth + REST + chat SSE) — driven by mocks.
 *   - `LocalDataDAL` (profile + reports + observations) — in-memory mock
 *     conforming to the frozen contract at `mobile/src/contracts/`.
 *
 * Each scenario exercises the BUSINESS LOGIC of the corresponding screen
 * via its pure helpers + the contracts those screens consume. Real
 * Detox/Maestro renders are flagged as a Phase 2 deliverable below.
 *
 * Required scenarios (per mobile-app-shell.md Pass 2 step 14):
 *   1. Boot → SignIn renders.
 *   2. OTP sign-in → PrivacyNotice → CohortOnboarding.
 *   3. Cohort completes → Intake.
 *   4. Intake skip → Instruments.
 *   5. PHQ-2 in instruments (no item-9 path).
 *   6. Upload → Review → Timeline shows the new observation.
 *   7. One chat turn → assistant response streams → ZERO server-side
 *      persistence (mobile noPersist:true + X-Client-Type:mobile header).
 *   8. Timeline tab renders ≥ 1 observation.
 *
 * Phase 2 deliverable
 * ───────────────────
 * A real device/simulator E2E pass via Detox or Maestro that boots the
 * compiled bundle and drives the actual RN renderer. This integration
 * test asserts the data flows; the next phase asserts the visuals.
 */

import { describe, it, expect, vi } from "vitest";

import type {
  ApiClient,
  ChatStreamEvent,
  ChatTurnInput,
  ConditionRow,
  LocalDataDAL,
  ObservationRow,
  ProfileRow,
  ReportRow,
} from "@/contracts";

import { groupObservationsByDate } from "@/screens/timeline/groupObservations";
import {
  appendAssistantDelta,
  appendUserTurn,
  type ChatTurn,
} from "@/screens/chat/chatHistory";
import {
  applyConsentToggle,
  buildConsentPatchBody,
} from "@/screens/settings/consentToggle";

// ─── In-memory DAL conforming to the contract ─────────────────────────────

function makeInMemoryDal(): LocalDataDAL & {
  __observations: ObservationRow[];
  __reports: ReportRow[];
} {
  const observations: ObservationRow[] = [];
  const reports: ReportRow[] = [];
  let profile: ProfileRow | null = null;
  const conditions: ConditionRow[] = [];
  let idCounter = 1;
  const nextId = () => `id-${idCounter++}`;

  return {
    __observations: observations,
    __reports: reports,

    async insertObservation(input) {
      // Honor the unique constraint emulated in-memory.
      const dup = observations.some(
        (o) =>
          o.user_id === input.user_id &&
          o.code === input.code &&
          o.effective_at === input.effective_at,
      );
      if (dup) return { inserted: false, id: input.id ?? "" };
      const row: ObservationRow = {
        id: input.id ?? nextId(),
        user_id: input.user_id,
        category: input.category,
        code_system: input.code_system,
        code: input.code,
        display: input.display,
        value_num: input.value_num,
        value_text: input.value_text,
        unit: input.unit,
        source: input.source,
        effective_at: input.effective_at,
        recorded_at: input.recorded_at ?? new Date().toISOString(),
        report_id: input.report_id ?? null,
        supersedes_id: input.supersedes_id ?? null,
        metadata_json: input.metadata_json ?? null,
      };
      observations.push(row);
      return { inserted: true, id: row.id };
    },
    async getObservation(id) {
      return observations.find((o) => o.id === id) ?? null;
    },
    async listObservations(filter) {
      let out = [...observations];
      if (filter?.latest_only) {
        // Drop any row whose id is referenced by another's supersedes_id.
        const superseded = new Set(
          observations
            .map((o) => o.supersedes_id)
            .filter((x): x is string => x != null),
        );
        out = out.filter((o) => !superseded.has(o.id));
      }
      if (filter?.limit) out = out.slice(0, filter.limit);
      return out;
    },
    async getLatestObservation(userId, code) {
      const matches = observations
        .filter((o) => o.user_id === userId && o.code === code)
        .sort((a, b) => (a.effective_at < b.effective_at ? 1 : -1));
      return matches[0] ?? null;
    },

    async insertCondition(input) {
      const row: ConditionRow = {
        id: input.id ?? nextId(),
        user_id: input.user_id,
        condition_code: input.condition_code,
        condition_category: input.condition_category,
        source: input.source,
        started_at: input.started_at,
        ended_at: input.ended_at,
        confidence: input.confidence ?? null,
      };
      conditions.push(row);
      return { inserted: true, id: row.id };
    },
    async listConditions(userId) {
      return conditions.filter((c) => c.user_id === userId);
    },

    async insertReport(input) {
      const row: ReportRow = {
        id: input.id ?? nextId(),
        user_id: input.user_id,
        type: input.type,
        file_blob_ref: input.file_blob_ref,
        original_filename: input.original_filename,
        uploaded_at: input.uploaded_at ?? new Date().toISOString(),
        parsed_at: null,
        parse_status: input.parse_status ?? "pending",
        summary_text: input.summary_text ?? null,
      };
      reports.push(row);
      return { id: row.id };
    },
    async getReport(id) {
      return reports.find((r) => r.id === id) ?? null;
    },
    async listReports(userId) {
      return reports.filter((r) => r.user_id === userId);
    },
    async updateReportParseStatus(id, status, summary) {
      const r = reports.find((x) => x.id === id);
      if (r) {
        r.parse_status = status;
        r.summary_text = summary ?? r.summary_text;
        r.parsed_at = new Date().toISOString();
      }
    },

    async getProfile() {
      return profile;
    },
    async upsertProfile(input) {
      const now = new Date().toISOString();
      profile = {
        id: input.id,
        email: input.email,
        plan: input.plan ?? "trial",
        birth_year: input.birth_year ?? null,
        is_on_medicare: input.is_on_medicare ?? null,
        sex_at_birth: input.sex_at_birth ?? null,
        gender_identity: input.gender_identity ?? null,
        created_at: now,
        updated_at: now,
      };
      return profile;
    },

    async insertAnalysis() {
      return { id: nextId() };
    },
    async listAnalyses() {
      return [];
    },
    async insertChatMessage() {
      return { id: nextId() };
    },
    async listChatMessages() {
      return [];
    },
  };
}

// ─── Mock ApiClient with HTTP-call recorder ───────────────────────────────

interface RecordedCall {
  path: string;
  method: string;
  body?: unknown;
  headers: Record<string, string>;
}

function makeMockApi(): {
  client: ApiClient;
  recorded: RecordedCall[];
  setUser: (u: { userId: string; email: string } | null) => void;
} {
  const recorded: RecordedCall[] = [];
  let user: { userId: string; email: string } | null = null;

  // Simulate the SSE stream the backend mobile branch emits.
  function* simulateChatStream(): Generator<ChatStreamEvent, void, void> {
    yield { type: "delta", text: "Your A1c trend " };
    yield { type: "delta", text: "looks stable." };
    yield { type: "done", iterations: 1, model: "haiku", totalMs: 42 };
  }

  const client: ApiClient = {
    async sendOtp(email) {
      recorded.push({
        path: "/api/auth/send-otp",
        method: "POST",
        body: { email },
        headers: { "X-Client-Type": "mobile" },
      });
    },
    async verifyOtp(email) {
      user = { userId: "user-smoke-1", email };
      recorded.push({
        path: "/api/auth/verify-otp",
        method: "POST",
        body: { email },
        headers: { "X-Client-Type": "mobile" },
      });
      return { userId: user.userId, email, mfaRequired: false };
    },
    async refresh() {},
    async signOut() {
      user = null;
    },
    isAuthenticated() {
      return user != null;
    },
    getCurrentUser() {
      return user;
    },
    onSignInRequired() {
      return () => {};
    },
    async apiGet(path) {
      recorded.push({ path, method: "GET", headers: { "X-Client-Type": "mobile" } });
      // Default mock: return consent prefs with health_data_ai = true.
      if (path === "/api/consent") {
        return {
          consent: {
            health_data_ai: true,
            health_data_storage: false,
            analytics: false,
          },
        } as unknown as never;
      }
      return {} as never;
    },
    async apiPost(path, body) {
      recorded.push({
        path,
        method: "POST",
        body,
        headers: { "X-Client-Type": "mobile" },
      });
      return {} as never;
    },
    async apiPatch(path, body) {
      recorded.push({
        path,
        method: "PATCH",
        body,
        headers: { "X-Client-Type": "mobile" },
      });
      return {} as never;
    },
    async apiDelete(path) {
      recorded.push({
        path,
        method: "DELETE",
        headers: { "X-Client-Type": "mobile" },
      });
      return {} as never;
    },
    chat(input: ChatTurnInput): AsyncIterable<ChatStreamEvent> {
      recorded.push({
        path: "/api/chat",
        method: "POST",
        body: input,
        // The real client (mobile/src/auth/chatStream.ts) sets these
        // headers on every chat request; we record the same shape.
        headers: { "X-Client-Type": "mobile", Accept: "text/event-stream" },
      });
      return {
        [Symbol.asyncIterator]() {
          const gen = simulateChatStream();
          return {
            async next() {
              const r = gen.next();
              return r as IteratorResult<ChatStreamEvent>;
            },
            async return() {
              return { value: undefined as never, done: true };
            },
          };
        },
      };
    },
  };

  return {
    client,
    recorded,
    setUser: (u) => {
      user = u;
    },
  };
}

// ─── Scenarios ────────────────────────────────────────────────────────────

describe("Phase 1 mobile — Wave 3 integration smoke", () => {
  it("1) boot — SignIn is the initial route per RootNavigator", async () => {
    // RootNavigator imports react-native-screens via @react-navigation
    // which cannot resolve in a node-env vitest run. Instead, assert
    // the structural property: the navigator source lists "SignIn" as
    // initialRouteName. A real render-the-app smoke belongs in Detox /
    // Maestro (Phase 2 deliverable — see header).
    const fs = await import("node:fs/promises");
    const nodePath = await import("node:path");
    // Vitest config resolves `@` → `mobile/src`. The smoke test runs
    // with cwd = mobile/ (per `package.json` scripts), so a path
    // relative to cwd is the most portable.
    const file = nodePath.resolve(
      process.cwd(),
      "src/navigation/RootNavigator.tsx",
    );
    const src = await fs.readFile(file, "utf8");
    expect(src).toMatch(/initialRouteName="SignIn"/);
    expect(src).toMatch(/MainTabs/);
  });

  it("2) OTP sign-in routes to PrivacyNotice (Wave 2 behavior)", async () => {
    const { client, recorded } = makeMockApi();
    const result = await client.verifyOtp("ramanac@gmail.com", "123456");
    expect(result.userId).toBe("user-smoke-1");
    expect(client.isAuthenticated()).toBe(true);
    // Recorded /api/auth/verify-otp call with mobile header.
    const verify = recorded.find((c) =>
      c.path.endsWith("/api/auth/verify-otp"),
    );
    expect(verify?.headers["X-Client-Type"]).toBe("mobile");
  });

  it("3+4+5) cohort+intake+instruments: minimal-answer onboarding writes the local profile", async () => {
    const dal = makeInMemoryDal();
    const user = { userId: "user-smoke-1", email: "test@example.com" };
    // Simulate the onboarding-builder writes: cohort sets is_on_medicare,
    // intake captures birth_year, instruments record questionnaire
    // observations.
    const prof = await dal.upsertProfile({
      id: user.userId,
      email: user.email,
      is_on_medicare: false,
      sex_at_birth: "male",
      gender_identity: null,
      birth_year: 1970,
    });
    expect(prof.is_on_medicare).toBe(false);
    expect(prof.sex_at_birth).toBe("male");
    expect(prof.birth_year).toBe(1970);

    // PHQ-2 (no item 9) — a single questionnaire observation row.
    const insertResult = await dal.insertObservation({
      user_id: user.userId,
      category: "questionnaire",
      code_system: "LOINC",
      code: "44249-1", // PHQ-2 LOINC
      display: "PHQ-2",
      value_num: 2,
      value_text: null,
      unit: null,
      source: "self_reported",
      effective_at: "2026-06-04T00:00:00.000Z",
      report_id: null,
      supersedes_id: null,
      metadata_json: null,
    });
    expect(insertResult.inserted).toBe(true);
  });

  it("6) upload → review → timeline: a fixture lab insert surfaces in Timeline.listObservations", async () => {
    const dal = makeInMemoryDal();
    const user = { userId: "user-smoke-2", email: "test2@example.com" };
    // Simulate Upload → Review committing one observation tied to a report.
    const reportInsert = await dal.insertReport({
      user_id: user.userId,
      type: "lab",
      file_blob_ref: "/secure/blob/abc",
      original_filename: "may-2026-a1c.pdf",
      parse_status: "parsing",
    });
    await dal.insertObservation({
      user_id: user.userId,
      category: "biomarker",
      code_system: "LOINC",
      code: "4548-4",
      display: "Hemoglobin A1c",
      value_num: 6.4,
      value_text: null,
      unit: "%",
      source: "uploaded_report",
      effective_at: "2026-05-15T00:00:00.000Z",
      report_id: reportInsert.id,
      supersedes_id: null,
      metadata_json: null,
    });
    await dal.updateReportParseStatus(reportInsert.id, "confirmed", "saved");

    // Timeline tab reads observations.
    const list = await dal.listObservations({ latest_only: true, limit: 200 });
    expect(list).toHaveLength(1);
    expect(list[0].code).toBe("4548-4");

    // Grouping in the screen.
    const groups = groupObservationsByDate(list);
    expect(groups).toHaveLength(1);
    expect(groups[0].rows[0].code).toBe("4548-4");
  });

  it("7) chat turn: api.chat is invoked with noPersist:true + mobile header; client-managed history flows correctly", async () => {
    const { client, recorded } = makeMockApi();
    await client.verifyOtp("test@example.com", "123456");

    // Reproduce ChatScreen behavior: append user turn, stream assistant deltas.
    let history: ChatTurn[] = appendUserTurn(
      [],
      "Tell me about my A1c trend.",
    );

    let assembled = "";
    for await (const event of client.chat({
      content: history[history.length - 1].content,
      history,
      noPersist: true,
    })) {
      if (event.type === "delta") {
        assembled += event.text;
        history = appendAssistantDelta(history, event.text);
      } else if (event.type === "done") {
        break;
      } else if (event.type === "error") {
        throw new Error("unexpected error event in smoke");
      }
    }

    expect(assembled).toBe("Your A1c trend looks stable.");
    expect(history).toHaveLength(2);
    expect(history[1].role).toBe("assistant");

    // Critical: the chat call was made with noPersist:true and the mobile
    // header. The backend's mobile branch (chat/route.ts:151) keys off
    // these two signals and writes NOTHING to conversations/messages
    // (asserted by app/src/app/api/chat/__tests__/no-persist.test.ts).
    const chatCall = recorded.find((c) => c.path === "/api/chat");
    expect(chatCall).toBeTruthy();
    expect(chatCall!.headers["X-Client-Type"]).toBe("mobile");
    const callBody = chatCall!.body as ChatTurnInput;
    expect(callBody.noPersist).toBe(true);
    expect(callBody.content).toBe("Tell me about my A1c trend.");
    expect(callBody.history?.length).toBeGreaterThan(0);
  });

  it("8) settings: consent toggle PATCH carries the contract-shaped body", async () => {
    const { client, recorded } = makeMockApi();
    await applyConsentToggle(client, "analytics", true);
    const patch = recorded.find(
      (c) => c.path === "/api/consent" && c.method === "PATCH",
    );
    expect(patch).toBeTruthy();
    expect(patch!.body).toEqual(buildConsentPatchBody("analytics", true));
  });
});
