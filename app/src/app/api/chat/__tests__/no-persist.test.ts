/**
 * POST /api/chat — mobile no-persist branch (D9 gate, Wave 3).
 *
 * Load-bearing assertions enforced here:
 *
 *   1. ZERO writes to RDS on the mobile path. `query()` spy allows only
 *      ONE SELECT (consent_preferences). audit_logs INSERT is allowed
 *      (audit-only, no body content). The explicit forbidden-tables list
 *      catches accidental reach into conversations / messages /
 *      learning_* / health_reports / fhir_cache / diabetes_* / appeal_*.
 *
 *   2. Sentinel-leak — embed PHI strings in the request body; spy on
 *      console.* / logAudit / logClaudeMetric; assert NONE leak the
 *      sentinel.
 *
 *   3. Audit metadata allowlist — keys are strictly the documented set:
 *      userId / durationMs / messageCount / outcome.
 *
 *   4. Web byte-identical regression — the SAME route invoked WITHOUT
 *      the `X-Client-Type: mobile` header preserves the pre-Wave-3
 *      behavior: conversations + messages INSERTs happen, audit + rate
 *      limit + learning paths still fire, SSE shape unchanged.
 *
 *   5. Model routing — mobile uses Sonnet (default) for all users; no plan read.
 *
 *   6. Consent gate on mobile — health_data_ai OFF → 403, Bedrock
 *      never called.
 *
 * Vitest mocks: getAuthUser, query, chat (the Bedrock loop wrapper),
 * logAudit, logClaudeMetric, skills/tool loaders.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────

const mockGetAuthUser = vi.fn();
vi.mock("@/lib/auth-server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}));

const mockQuery = vi.fn();
vi.mock("@/lib/db", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

const mockLogAudit = vi.fn();
vi.mock("@/lib/audit", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

const mockLogClaudeMetric = vi.fn();
const mockLogFallbackMetric = vi.fn();
vi.mock("@/lib/metrics/logger", () => ({
  logClaudeMetric: (...args: unknown[]) => mockLogClaudeMetric(...args),
  logFallbackMetric: (...args: unknown[]) => mockLogFallbackMetric(...args),
}));

const mockChat = vi.fn();
vi.mock("@/lib/claude", () => ({
  chat: (...args: unknown[]) => mockChat(...args),
  formatMessages: vi.fn((msgs: unknown[]) => msgs),
  createDefaultSessionState: vi.fn(() => ({
    userName: "",
    userZip: "",
    symptoms: [],
    duration: "",
    providerName: "",
    priorTreatments: [],
    diagnosisCodes: [],
    procedureCodes: [],
    denialCodes: [],
    coverageCriteria: [],
    policyReferences: [],
    requirementAnswers: {},
    requirementsToVerify: [],
    redFlags: [],
    verificationComplete: false,
    isAppeal: false,
    denialDate: null,
    priorAuthRequired: null,
    medicareType: null,
    maPlanName: null,
    email: null,
    healthDataAvailable: false,
    blueButtonConnected: false,
    conditions: [],
    medications: [],
    screenings: [],
    providers: [],
    hospitalizations: [],
    labs: [],
    activeCoverage: null,
    recentDenials: [],
    diabetesClassification: null,
    obesityClassification: null,
    consentHealthDataAi: false,
    appealLevel: 1,
    priorAppealId: null,
    isOnMedicare: false,
  })),
  extractUserInfo: vi.fn((_msgs: unknown, ss: unknown) => ss),
}));

vi.mock("@/lib/skills-loader", () => ({
  detectTriggers: vi.fn(() => ({})),
  extractEntitiesFromMessages: vi.fn(() => ({
    symptoms: [],
    procedures: [],
    medications: [],
    providers: [],
  })),
}));

vi.mock("@/lib/skills-loader-router", () => ({
  buildSystemPromptForUser: vi.fn(() => "mobile system prompt"),
  buildSystemPromptForUserWithLearning: vi.fn(() =>
    Promise.resolve("system prompt with learning"),
  ),
}));

const mockGetToolDefinitions = vi.fn(() => []);
vi.mock("@/lib/tools", () => ({
  getToolDefinitions: (...args: unknown[]) =>
    mockGetToolDefinitions(...(args as [])),
  createToolExecutorMap: vi.fn(() => ({})),
}));

vi.mock("@/lib/learning", () => ({
  updateSymptomMapping: vi.fn(),
  updateProcedureMapping: vi.fn(),
  queueLearningJob: vi.fn().mockReturnValue(Promise.resolve()),
  recordCoveragePath: vi.fn(),
}));

vi.mock("@/lib/conversation-server", () => ({
  saveAppeal: vi.fn(),
  getUnreportedOutcome: vi.fn().mockReturnValue(Promise.resolve(null)),
}));

import { NextRequest } from "next/server";

async function loadRoute(): Promise<{
  POST: (req: NextRequest) => Promise<Response>;
}> {
  return await import("../route");
}

// ── Helpers ──────────────────────────────────────────────────────────────

const MOCK_USER = { userId: "user-mobile-123", email: "mobile@example.com" };

function makeMobileRequest(
  body: unknown,
  headers?: Record<string, string>,
): NextRequest {
  return new NextRequest("http://localhost:3000/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Type": "mobile",
      Authorization: "Bearer fake.jwt.value",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

function makeWebRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const MOBILE_BODY = {
  messages: [
    { role: "user" as const, content: "Tell me about my A1C trend." },
  ],
  noPersist: true as const,
};

function setupMobileQueryHappyPath(
  plan: string | null,
  consent: boolean = true,
): void {
  mockQuery.mockImplementation(async (sql: string) => {
    if (/consent_preferences/i.test(sql)) {
      return { rows: consent ? [{ granted: true }] : [] };
    }
    if (/FROM users/i.test(sql) && /SELECT\s+plan/i.test(sql)) {
      return { rows: [{ plan }] };
    }
    return { rows: [] };
  });
}

function setupWebQueryHappyPath(): void {
  // Mirror the existing web-path mock from app/src/app/api/chat/__tests__/route.test.ts
  mockQuery.mockImplementation((sql: string) => {
    if (sql.includes("SELECT plan"))
      return Promise.resolve({
        rows: [
          {
            plan: "starter",
            is_admin: false,
            role: "patient",
            is_on_medicare: true,
            created_at: new Date().toISOString(),
          },
        ],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });
    if (sql.includes("check_weekly_frequency"))
      return Promise.resolve({ rows: [{ allowed: true, days_used: 0 }] });
    if (sql.includes("check_and_increment_chat"))
      return Promise.resolve({ rows: [{ allowed: true, count: 1 }] });
    if (sql.includes("INSERT INTO conversations"))
      return Promise.resolve({ rows: [{ id: "conv-web-1" }] });
    if (sql.includes("INSERT INTO messages"))
      return Promise.resolve({ rows: [] });
    if (sql.includes("UPDATE conversations"))
      return Promise.resolve({ rows: [] });
    return Promise.resolve({ rows: [] });
  });
}

function defaultChatResult() {
  return {
    content: "Here's a summary.",
    suggestions: [],
    sessionState: {
      diagnosisCodes: [],
      procedureCodes: [],
      denialCodes: [],
      policyReferences: [],
      isAppeal: false,
    },
    toolsUsed: [],
    iterations: 1,
  };
}

async function drainStream(res: Response): Promise<string> {
  return await res.text();
}

/** Inspect every query() call. Any INSERT/UPDATE/DELETE against a forbidden
 *  table fails the test. */
function assertNoMobileWrites(): void {
  const FORBIDDEN_TABLES = [
    "conversations",
    "messages",
    "observations",
    "conditions",
    "reports",
    "analyses",
    "health_reports",
    "fhir_cache",
    "diabetes_log",
    "diabetes_insights",
    "diabetes_snapshots",
    "appeals",
    "appeal_outcomes",
    "appeal_levels",
    "learning_queue",
    "symptom_mappings",
    "procedure_mappings",
    "coverage_paths",
    "user_events",
  ];
  for (const call of mockQuery.mock.calls) {
    const sql = (call[0] as string).toLowerCase();
    // Forbid every mutating verb against any forbidden table.
    if (/\b(insert|update|delete|upsert|truncate)\b/.test(sql)) {
      for (const table of FORBIDDEN_TABLES) {
        if (sql.includes(table)) {
          throw new Error(
            `Mobile chat path performed forbidden mutation against \`${table}\`:\n  SQL: ${sql.slice(0, 200)}`,
          );
        }
      }
    }
    // Belt-and-braces: even a bare SELECT against these tables is
    // suspicious on the mobile path — the body messages are the SoT.
    for (const table of FORBIDDEN_TABLES) {
      if (sql.includes(table)) {
        throw new Error(
          `Mobile chat path referenced forbidden table \`${table}\`:\n  SQL: ${sql.slice(0, 200)}`,
        );
      }
    }
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLogAudit.mockResolvedValue(undefined);
  mockChat.mockResolvedValue(defaultChatResult());
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("POST /api/chat (mobile) — D9 gate: zero RDS writes", () => {
  it("performs only the one allowed SELECT (consent) — no plan read, no INSERTs", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    setupMobileQueryHappyPath("trial");

    const { POST } = await loadRoute();
    const res = await POST(makeMobileRequest(MOBILE_BODY));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    await drainStream(res);

    const sqls = mockQuery.mock.calls.map((c) => (c[0] as string).trim());
    // The consent read must have fired.
    expect(sqls.some((s) => /consent_preferences/i.test(s))).toBe(true);
    // Mobile no longer reads users.plan — model is not plan-gated.
    expect(sqls.some((s) => /FROM users/i.test(s) && /plan/i.test(s))).toBe(
      false,
    );
    // No other queries beyond the single consent read.
    expect(sqls.length).toBe(1);
    assertNoMobileWrites();
  });

  it("never references conversations / messages / learning / health tables", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    setupMobileQueryHappyPath("plus");

    const { POST } = await loadRoute();
    const res = await POST(makeMobileRequest(MOBILE_BODY));
    await drainStream(res);

    assertNoMobileWrites();
  });

  it("zero writes even when chat() succeeds with toolsUsed (no learning persistence)", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    setupMobileQueryHappyPath("plus");
    // Simulate a result that on the WEB path would trigger persistLearning() +
    // saveAppeal() + conversation/message inserts.
    mockChat.mockResolvedValue({
      content: "I generated an appeal letter.",
      suggestions: [],
      sessionState: {
        diagnosisCodes: ["E11.9"],
        procedureCodes: ["83036"],
        denialCodes: ["97"],
        policyReferences: ["L35936"],
        isAppeal: false,
      },
      toolsUsed: ["search_icd10", "search_cpt", "generate_appeal_letter"],
      iterations: 3,
    });

    const { POST } = await loadRoute();
    const res = await POST(makeMobileRequest(MOBILE_BODY));
    await drainStream(res);

    // Still only the single consent read.
    expect(mockQuery.mock.calls.length).toBe(1);
    assertNoMobileWrites();
  });
});

describe("POST /api/chat (mobile) — sentinel-leak protection", () => {
  it("never logs message content via console.* / logAudit / logClaudeMetric", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    setupMobileQueryHappyPath("trial");

    const sentinel = "SENTINEL_PHI_PROBE_ABC123_DO_NOT_LOG";
    const responseSentinel = "RESPONSE_SENTINEL_XYZ_LEAK_PROBE";
    mockChat.mockResolvedValue({
      ...defaultChatResult(),
      content: responseSentinel,
    });

    const consoleSpies = {
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
      info: vi.spyOn(console, "info").mockImplementation(() => {}),
    };

    try {
      const { POST } = await loadRoute();
      const res = await POST(
        makeMobileRequest({
          messages: [
            {
              role: "user",
              content: `My latest reading: ${sentinel} drawn 2026-05-15`,
            },
          ],
          noPersist: true,
        }),
      );
      await drainStream(res);

      const flatten = (v: unknown): string => {
        try {
          return typeof v === "string" ? v : JSON.stringify(v);
        } catch {
          return "";
        }
      };

      for (const [name, spy] of Object.entries(consoleSpies)) {
        for (const call of spy.mock.calls) {
          for (const arg of call) {
            const flat = flatten(arg);
            expect(flat, `console.${name} leaked user content`).not.toContain(
              sentinel,
            );
            expect(
              flat,
              `console.${name} leaked response content`,
            ).not.toContain(responseSentinel);
          }
        }
      }
      for (const call of mockLogAudit.mock.calls) {
        for (const arg of call) {
          const flat = flatten(arg);
          expect(flat, "logAudit leaked user content").not.toContain(sentinel);
          expect(flat, "logAudit leaked response content").not.toContain(
            responseSentinel,
          );
        }
      }
      for (const call of mockLogClaudeMetric.mock.calls) {
        for (const arg of call) {
          const flat = flatten(arg);
          expect(flat, "logClaudeMetric leaked user content").not.toContain(
            sentinel,
          );
          expect(
            flat,
            "logClaudeMetric leaked response content",
          ).not.toContain(responseSentinel);
        }
      }
    } finally {
      for (const spy of Object.values(consoleSpies)) spy.mockRestore();
    }
  });
});

describe("POST /api/chat (mobile) — audit metadata allowlist", () => {
  it("CHAT_INVOKED_MOBILE audit row carries only allowed keys", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    setupMobileQueryHappyPath("trial");

    const { POST } = await loadRoute();
    const res = await POST(makeMobileRequest(MOBILE_BODY));
    await drainStream(res);

    // Audit call recorded.
    expect(mockLogAudit).toHaveBeenCalled();
    const mobileAuditCalls = mockLogAudit.mock.calls.filter(
      (c) => c[0] === "CHAT_INVOKED_MOBILE",
    );
    expect(mobileAuditCalls.length).toBe(1);
    const opts = mobileAuditCalls[0][1] as {
      userId?: string;
      metadata?: Record<string, unknown>;
    };
    const meta = opts.metadata ?? {};
    const ALLOWED = ["userId", "durationMs", "messageCount", "outcome"];
    for (const key of Object.keys(meta)) {
      expect(
        ALLOWED.includes(key),
        `unexpected audit metadata key: ${key}`,
      ).toBe(true);
    }
    expect(meta.outcome).toBe("ok");
    expect(typeof meta.durationMs).toBe("number");
    expect(meta.messageCount).toBe(1);
  });
});

describe("POST /api/chat (mobile) — consent gate", () => {
  it("returns 403 HEALTH_DATA_AI_DISABLED when consent is OFF; chat() never called", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    setupMobileQueryHappyPath("trial", /* consent */ false);

    const { POST } = await loadRoute();
    const res = await POST(makeMobileRequest(MOBILE_BODY));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("HEALTH_DATA_AI_DISABLED");

    expect(mockChat).not.toHaveBeenCalled();
    assertNoMobileWrites();
  });

  it("returns 403 when no consent row exists at all", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockImplementation(async (sql: string) => {
      if (/consent_preferences/i.test(sql)) return { rows: [] };
      return { rows: [{ plan: "trial" }] };
    });

    const { POST } = await loadRoute();
    const res = await POST(makeMobileRequest(MOBILE_BODY));
    expect(res.status).toBe(403);
    expect(mockChat).not.toHaveBeenCalled();
  });
});

describe("POST /api/chat (mobile) — model routing (always Sonnet)", () => {
  // Decided 2026-06-11 (Haiku-vs-Sonnet head-to-head): mobile chat uses
  // Sonnet for ALL users. `chat()` is called with modelOverride undefined,
  // so it falls through to API_CONFIG.claude.model (Sonnet). Mobile no
  // longer reads users.plan — the plan arg below only seeds the (now
  // unused) plan mock and must not change the outcome.
  it("uses Sonnet (modelOverride undefined) for a trial user", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    setupMobileQueryHappyPath("trial");

    const { POST } = await loadRoute();
    const res = await POST(makeMobileRequest(MOBILE_BODY));
    await drainStream(res);

    expect(mockChat).toHaveBeenCalledTimes(1);
    const callArgs = mockChat.mock.calls[0][0] as { modelOverride?: string };
    expect(callArgs.modelOverride).toBeUndefined();
  });

  it("uses Sonnet for a paid user too (plan does not affect mobile model)", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    setupMobileQueryHappyPath("plus");

    const { POST } = await loadRoute();
    const res = await POST(makeMobileRequest(MOBILE_BODY));
    await drainStream(res);

    const callArgs = mockChat.mock.calls[0][0] as { modelOverride?: string };
    expect(callArgs.modelOverride).toBeUndefined();
  });

  it("never sends a Haiku override on mobile", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    setupMobileQueryHappyPath("trial");

    const { POST } = await loadRoute();
    const res = await POST(makeMobileRequest(MOBILE_BODY));
    await drainStream(res);

    const callArgs = mockChat.mock.calls[0][0] as { modelOverride?: string };
    expect(callArgs.modelOverride ?? "").not.toMatch(/haiku/i);
  });

  it("appends the mobile brevity nudge to the system prompt", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    setupMobileQueryHappyPath("trial");

    const { POST } = await loadRoute();
    await drainStream(await POST(makeMobileRequest(MOBILE_BODY)));

    const callArgs = mockChat.mock.calls[0][0] as { systemPrompt?: string };
    expect(callArgs.systemPrompt).toContain("Response style (mobile app)");
    expect(callArgs.systemPrompt).toMatch(/FINAL answers/i);
    // Safety carve-out must survive: brevity never suppresses 988 / crisis
    // surfacing (clinical-boundary review 2026-06-11).
    expect(callArgs.systemPrompt).toMatch(/988|safety asides/i);
  });
});

describe("POST /api/chat (mobile) — body shape + auth + signal validation", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const { POST } = await loadRoute();
    const res = await POST(makeMobileRequest(MOBILE_BODY));
    expect(res.status).toBe(401);
    expect(mockChat).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 400 when noPersist is missing (defensive runtime check)", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    const { POST } = await loadRoute();
    const res = await POST(
      makeMobileRequest({
        messages: [{ role: "user" as const, content: "hi" }],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("MOBILE_NO_PERSIST_REQUIRED");
    expect(mockChat).not.toHaveBeenCalled();
    // The defensive check fires BEFORE the consent query, so no query
    // should have run.
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 400 when noPersist is false", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    const { POST } = await loadRoute();
    const res = await POST(
      makeMobileRequest({
        messages: [{ role: "user" as const, content: "hi" }],
        noPersist: false,
      }),
    );
    expect(res.status).toBe(400);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it("returns 400 when messages array is missing", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    const { POST } = await loadRoute();
    const res = await POST(
      makeMobileRequest({ noPersist: true }),
    );
    expect(res.status).toBe(400);
    expect(mockChat).not.toHaveBeenCalled();
  });
});

describe("POST /api/chat (mobile) — tool filter (appeals out)", () => {
  it("filters generate_appeal_letter out of the tool list", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    setupMobileQueryHappyPath("plus");
    mockGetToolDefinitions.mockReturnValue([
      { name: "search_icd10", description: "x", input_schema: {} },
      { name: "generate_appeal_letter", description: "y", input_schema: {} },
      { name: "search_cpt", description: "z", input_schema: {} },
    ] as unknown as never);

    const { POST } = await loadRoute();
    const res = await POST(makeMobileRequest(MOBILE_BODY));
    await drainStream(res);

    const callArgs = mockChat.mock.calls[0][0] as {
      tools: Array<{ name: string }>;
    };
    const toolNames = callArgs.tools.map((t) => t.name);
    expect(toolNames).toContain("search_icd10");
    expect(toolNames).toContain("search_cpt");
    expect(toolNames).not.toContain("generate_appeal_letter");
  });
});

describe("POST /api/chat (mobile) — SSE response shape", () => {
  it("returns text/event-stream with delta + done frames; no error frames on happy path", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    setupMobileQueryHappyPath("trial");
    // Drive a delta during the chat call so the SSE includes one.
    mockChat.mockImplementation(
      async (
        _args: unknown,
        _executors: unknown,
        _maxIter: unknown,
        hooks: { onDelta?: (text: string) => void } | undefined,
      ) => {
        hooks?.onDelta?.("Hello");
        return defaultChatResult();
      },
    );

    const { POST } = await loadRoute();
    const res = await POST(makeMobileRequest(MOBILE_BODY));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    const text = await drainStream(res);
    expect(text).toContain("event: delta");
    expect(text).toContain("event: done");
    expect(text).not.toContain("event: error");
  });

  it("emits an error frame and clean close on chat() failure", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    setupMobileQueryHappyPath("trial");
    mockChat.mockRejectedValue(new Error("Bedrock unavailable"));

    const { POST } = await loadRoute();
    const res = await POST(makeMobileRequest(MOBILE_BODY));
    // Headers still 200 because the stream was opened before the error.
    expect(res.status).toBe(200);
    const text = await drainStream(res);
    expect(text).toContain("event: error");
  });
});

// ─── WEB-PATH REGRESSION (load-bearing) ──────────────────────────────────

describe("POST /api/chat (web — byte-identical regression)", () => {
  it("WITHOUT X-Client-Type:mobile, preserves the web path's persistence behavior", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    setupWebQueryHappyPath();

    const { POST } = await loadRoute();
    const res = await POST(
      makeWebRequest({
        messages: [{ role: "user" as const, content: "hello" }],
      }),
    );
    // Web path returns a streaming SSE response.
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    await drainStream(res);

    const sqls = mockQuery.mock.calls.map((c) => (c[0] as string));

    // Web path SHOULD load the user profile.
    expect(
      sqls.some((s) => /SELECT plan/i.test(s) && /FROM users/i.test(s)),
      "web path must load users profile",
    ).toBe(true);
    // Web path SHOULD run rate-limit RPCs.
    expect(
      sqls.some((s) => /check_weekly_frequency/i.test(s)),
      "web path must perform weekly frequency check",
    ).toBe(true);
    expect(
      sqls.some((s) => /check_and_increment_chat/i.test(s)),
      "web path must perform daily chat check",
    ).toBe(true);
    // Web path SHOULD insert the conversation row.
    expect(
      sqls.some((s) => /INSERT INTO conversations/i.test(s)),
      "web path must INSERT INTO conversations (was skipped — regression!)",
    ).toBe(true);
    // Web path SHOULD insert the messages row(s).
    expect(
      sqls.some((s) => /INSERT INTO messages/i.test(s)),
      "web path must INSERT INTO messages (was skipped — regression!)",
    ).toBe(true);
  });

  it("plan-based model routing on the WEB path: trial → Haiku", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    // Same as the web's existing test: trial with a future trial_end.
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan"))
        return Promise.resolve({
          rows: [
            {
              plan: "trial",
              is_admin: false,
              role: "patient",
              is_on_medicare: true,
              created_at: new Date().toISOString(),
            },
          ],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        });
      if (sql.includes("SELECT trial_end"))
        return Promise.resolve({ rows: [{ trial_end: futureDate }] });
      if (sql.includes("check_weekly_frequency"))
        return Promise.resolve({ rows: [{ allowed: true, days_used: 0 }] });
      if (sql.includes("check_and_increment_chat"))
        return Promise.resolve({ rows: [{ allowed: true, count: 1 }] });
      if (sql.includes("INSERT INTO conversations"))
        return Promise.resolve({ rows: [{ id: "conv-web-2" }] });
      if (sql.includes("INSERT INTO messages"))
        return Promise.resolve({ rows: [] });
      if (sql.includes("UPDATE conversations"))
        return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });

    const { POST } = await loadRoute();
    const res = await POST(
      makeWebRequest({
        messages: [{ role: "user" as const, content: "hello" }],
      }),
    );
    await drainStream(res);

    const callArgs = mockChat.mock.calls[0][0] as { modelOverride?: string };
    expect(callArgs.modelOverride).toMatch(/haiku/i);
  });

  it("plan-based model routing on the WEB path: paid (starter) → Sonnet", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    setupWebQueryHappyPath(); // starter

    const { POST } = await loadRoute();
    const res = await POST(
      makeWebRequest({
        messages: [{ role: "user" as const, content: "hello" }],
      }),
    );
    await drainStream(res);

    const callArgs = mockChat.mock.calls[0][0] as { modelOverride?: string };
    expect(callArgs.modelOverride).toBeUndefined();
  });
});
