/**
 * POST /api/parse-report — backend tests (Phase 1 mobile, Wave 2).
 *
 * Load-bearing assertions:
 *   - Zero RDS inserts on the happy path. `query()` is allowed only for:
 *       (a) consent_preferences read,
 *       (b) users.plan read.
 *     Spy-asserted across every relevant test.
 *   - Plan-based model routing matches `chat/route.ts:594-600`:
 *       trial → Haiku, paid → Sonnet.
 *   - 401 when unauthenticated, 400 on bad body, 403 when health_data_ai is off.
 *   - No body logging anywhere: console.* and logAudit/logClaudeMetric never
 *     receive `extracted_text` or `observations` content.
 *
 * Vitest mocks: getAuthUser, query, getClaudeClient, logAudit, logClaudeMetric.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────

const mockGetAuthUser = vi.fn();
vi.mock("@/lib/auth-server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}));

const mockQuery = vi.fn();
vi.mock("@/lib/db", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

const mockMessagesCreate = vi.fn();
vi.mock("@/lib/claude", () => ({
  getClaudeClient: () => ({
    messages: {
      create: (...args: unknown[]) => mockMessagesCreate(...args),
    },
  }),
}));

const mockLogAudit = vi.fn();
vi.mock("@/lib/audit", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

const mockLogClaudeMetric = vi.fn();
vi.mock("@/lib/metrics/logger", () => ({
  logClaudeMetric: (...args: unknown[]) => mockLogClaudeMetric(...args),
}));

// Pull in the route AFTER mocks. Dynamic import keeps it deterministic.
async function loadRoute(): Promise<{
  POST: (req: NextRequest) => Promise<Response>;
}> {
  return await import("../route");
}

// ── Helpers ──────────────────────────────────────────────────────────────

function makeRequest(body?: unknown, headers?: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost:3000/api/parse-report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Type": "mobile",
      Authorization: "Bearer fake.jwt.value",
      ...(headers ?? {}),
    },
    body: body === undefined ? "" : JSON.stringify(body),
  });
}

const VALID_USER = { userId: "user-123", email: "test@example.com" };
const VALID_BODY = {
  report_type: "lab" as const,
  extracted_text: "HbA1c 7.2% (4548-4) drawn 2026-05-15",
};

function envelopeText(envelope: {
  observations: unknown[];
  summary: string;
}): string {
  return JSON.stringify(envelope);
}

function defaultClaudeResponse() {
  return {
    content: [
      {
        type: "text",
        text: envelopeText({
          observations: [
            {
              category: "biomarker",
              code_system: "LOINC",
              code: "4548-4",
              display: "Hemoglobin A1c",
              value_num: 7.2,
              value_text: null,
              unit: "%",
              effective_at: "2026-05-15",
              confidence: 0.95,
              source_text: "HbA1c 7.2%",
            },
          ],
          summary: "One A1c reading at 7.2%.",
        }),
      },
    ],
  };
}

/**
 * Set up `query()` to return:
 *   - consent_preferences read → 1 row, granted = true (unless overridden)
 *   - users.plan read → 1 row with the given plan
 * Returns a function that asserts no other queries (e.g., inserts) ran.
 */
function setupQueryHappyPath(plan: string | null, consent: boolean = true) {
  mockQuery.mockImplementation(async (sql: string) => {
    if (/consent_preferences/i.test(sql)) {
      return { rows: consent ? [{ granted: true }] : [] };
    }
    if (/FROM users/i.test(sql)) {
      return { rows: [{ plan }] };
    }
    // Any other query is a bug — return empty to keep the test running but
    // the load-bearing assertion below will catch the extra call.
    return { rows: [] };
  });
}

function assertNoRdsWrites() {
  for (const call of mockQuery.mock.calls) {
    const sql = call[0] as string;
    // Allow only the two reads.
    const isAllowed =
      /SELECT\s+granted\s+FROM\s+consent_preferences/i.test(sql) ||
      /SELECT\s+plan\s+FROM\s+users/i.test(sql);
    if (!isAllowed) {
      throw new Error(
        `Unexpected DB call in parse-report happy path:\n  SQL: ${sql.slice(0, 200)}`,
      );
    }
    // Belt-and-braces: forbid mutating verbs anywhere.
    if (/\b(INSERT|UPDATE|DELETE|UPSERT|TRUNCATE)\b/i.test(sql)) {
      throw new Error(`Mutating SQL leaked into parse-report path: ${sql}`);
    }
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  // logAudit is fire-and-forget — must return a Promise so .catch() works.
  mockLogAudit.mockResolvedValue(undefined);
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("POST /api/parse-report — auth + body validation", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const { POST } = await loadRoute();
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when extracted_text is missing", async () => {
    mockGetAuthUser.mockResolvedValue(VALID_USER);
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ report_type: "lab" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/extracted_text/);
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when report_type is invalid", async () => {
    mockGetAuthUser.mockResolvedValue(VALID_USER);
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ report_type: "xray", extracted_text: "abc" }),
    );
    expect(res.status).toBe(400);
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid JSON body", async () => {
    mockGetAuthUser.mockResolvedValue(VALID_USER);
    const { POST } = await loadRoute();
    const req = new NextRequest("http://localhost:3000/api/parse-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when extracted_text exceeds the size cap", async () => {
    mockGetAuthUser.mockResolvedValue(VALID_USER);
    const { POST } = await loadRoute();
    const tooLong = "x".repeat(200_001);
    const res = await POST(
      makeRequest({ report_type: "lab", extracted_text: tooLong }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/parse-report — consent gate", () => {
  it("returns 403 when health_data_ai consent is OFF", async () => {
    mockGetAuthUser.mockResolvedValue(VALID_USER);
    setupQueryHappyPath("trial", /* consent */ false);

    const { POST } = await loadRoute();
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("HEALTH_DATA_AI_DISABLED");

    expect(mockMessagesCreate).not.toHaveBeenCalled();
    assertNoRdsWrites();
  });

  it("returns 403 when no consent_preferences row exists at all", async () => {
    mockGetAuthUser.mockResolvedValue(VALID_USER);
    mockQuery.mockImplementation(async (sql: string) => {
      if (/consent_preferences/i.test(sql)) {
        return { rows: [] };
      }
      return { rows: [{ plan: "trial" }] };
    });

    const { POST } = await loadRoute();
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/parse-report — plan-based model routing", () => {
  it("routes trial users to the Haiku trial model", async () => {
    mockGetAuthUser.mockResolvedValue(VALID_USER);
    setupQueryHappyPath("trial");
    mockMessagesCreate.mockResolvedValue(defaultClaudeResponse());

    const { POST } = await loadRoute();
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);

    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockMessagesCreate.mock.calls[0][0] as { model: string };
    expect(callArgs.model).toMatch(/haiku/i);
  });

  it("routes paid users (plus) to the Sonnet default model", async () => {
    mockGetAuthUser.mockResolvedValue(VALID_USER);
    setupQueryHappyPath("plus");
    mockMessagesCreate.mockResolvedValue(defaultClaudeResponse());

    const { POST } = await loadRoute();
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);

    const callArgs = mockMessagesCreate.mock.calls[0][0] as { model: string };
    expect(callArgs.model).toMatch(/sonnet/i);
    expect(callArgs.model).not.toMatch(/haiku/i);
  });

  it("routes unlimited users to Sonnet", async () => {
    mockGetAuthUser.mockResolvedValue(VALID_USER);
    setupQueryHappyPath("unlimited");
    mockMessagesCreate.mockResolvedValue(defaultClaudeResponse());

    const { POST } = await loadRoute();
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);

    const callArgs = mockMessagesCreate.mock.calls[0][0] as { model: string };
    expect(callArgs.model).toMatch(/sonnet/i);
  });

  it("treats null plan (RDS timeout) as paid → Sonnet (no silent Haiku downgrade)", async () => {
    mockGetAuthUser.mockResolvedValue(VALID_USER);
    setupQueryHappyPath(null);
    mockMessagesCreate.mockResolvedValue(defaultClaudeResponse());

    const { POST } = await loadRoute();
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);

    const callArgs = mockMessagesCreate.mock.calls[0][0] as { model: string };
    expect(callArgs.model).toMatch(/sonnet/i);
    expect(callArgs.model).not.toMatch(/haiku/i);
  });
});

describe("POST /api/parse-report — happy path + envelope passthrough", () => {
  it("returns the parsed envelope on a well-formed Claude response", async () => {
    mockGetAuthUser.mockResolvedValue(VALID_USER);
    setupQueryHappyPath("trial");
    mockMessagesCreate.mockResolvedValue(defaultClaudeResponse());

    const { POST } = await loadRoute();
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      observations: Array<{ code: string }>;
      summary: string;
    };
    expect(body.observations).toHaveLength(1);
    expect(body.observations[0].code).toBe("4548-4");
    expect(body.summary).toMatch(/A1c/i);
  });

  it("tolerates ```json fenced output", async () => {
    mockGetAuthUser.mockResolvedValue(VALID_USER);
    setupQueryHappyPath("trial");
    const fenced = "```json\n" + envelopeText({
      observations: [
        {
          category: "biomarker",
          code_system: "LOINC",
          code: "4548-4",
          display: "Hemoglobin A1c",
          value_num: 6.5,
          value_text: null,
          unit: "%",
          effective_at: "2026-05-15",
          confidence: 0.9,
          source_text: "A1c 6.5",
        },
      ],
      summary: "A1c 6.5%.",
    }) + "\n```";
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: fenced }],
    });

    const { POST } = await loadRoute();
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { observations: unknown[] };
    expect(body.observations).toHaveLength(1);
  });

  it("returns 502 when the model returns non-JSON garbage", async () => {
    mockGetAuthUser.mockResolvedValue(VALID_USER);
    setupQueryHappyPath("trial");
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "I cannot do that, Dave." }],
    });

    const { POST } = await loadRoute();
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(502);
  });

  it("returns 502 when the Bedrock call throws", async () => {
    mockGetAuthUser.mockResolvedValue(VALID_USER);
    setupQueryHappyPath("trial");
    mockMessagesCreate.mockRejectedValue(new Error("bedrock unavailable"));

    const { POST } = await loadRoute();
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(502);
  });
});

describe("POST /api/parse-report — load-bearing: zero RDS writes", () => {
  it("issues only the two allowed SELECTs on the happy path", async () => {
    mockGetAuthUser.mockResolvedValue(VALID_USER);
    setupQueryHappyPath("trial");
    mockMessagesCreate.mockResolvedValue(defaultClaudeResponse());

    const { POST } = await loadRoute();
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);

    // Both reads must have happened — and ONLY those reads.
    const sqls = mockQuery.mock.calls.map((c) => (c[0] as string).trim());
    expect(sqls.length).toBe(2);
    expect(sqls.some((s) => /consent_preferences/.test(s))).toBe(true);
    expect(sqls.some((s) => /FROM users/.test(s))).toBe(true);
    assertNoRdsWrites();
  });

  it("never inserts into observations / conditions / reports / analyses / health_reports / conversations / messages / fhir_cache / diabetes_*", async () => {
    mockGetAuthUser.mockResolvedValue(VALID_USER);
    setupQueryHappyPath("plus");
    mockMessagesCreate.mockResolvedValue(defaultClaudeResponse());

    const { POST } = await loadRoute();
    await POST(makeRequest(VALID_BODY));

    const FORBIDDEN_TABLES = [
      "observations",
      "conditions",
      "reports",
      "analyses",
      "health_reports",
      "conversations",
      "messages",
      "fhir_cache",
      "diabetes_log",
      "diabetes_insights",
      "diabetes_snapshots",
    ];
    for (const call of mockQuery.mock.calls) {
      const sql = (call[0] as string).toLowerCase();
      for (const table of FORBIDDEN_TABLES) {
        // The route SHOULD never reference these tables. Even a bare SELECT
        // would be suspicious — we expect zero mentions.
        expect(sql).not.toContain(table);
      }
    }
  });
});

describe("POST /api/parse-report — no body logging (PHI safety)", () => {
  it("never logs extracted_text via console.* / logAudit / logClaudeMetric", async () => {
    mockGetAuthUser.mockResolvedValue(VALID_USER);
    setupQueryHappyPath("trial");
    mockMessagesCreate.mockResolvedValue(defaultClaudeResponse());

    const sentinel = "SUPER_SECRET_PATIENT_DATA_HBA1C_999";
    const consoleSpies = {
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
      info: vi.spyOn(console, "info").mockImplementation(() => {}),
    };

    try {
      const { POST } = await loadRoute();
      await POST(
        makeRequest({
          report_type: "lab",
          extracted_text: `${sentinel} drawn 2026-05-15`,
        }),
      );

      // Check every spy. NONE of them should have received the sentinel as
      // any argument value (recursively).
      function flatten(value: unknown): string {
        try {
          return typeof value === "string" ? value : JSON.stringify(value);
        } catch {
          return "";
        }
      }

      for (const [name, spy] of Object.entries(consoleSpies)) {
        for (const call of spy.mock.calls) {
          for (const arg of call) {
            expect(flatten(arg), `console.${name} leaked`).not.toContain(sentinel);
          }
        }
      }
      for (const call of mockLogAudit.mock.calls) {
        for (const arg of call) {
          expect(flatten(arg), "logAudit leaked").not.toContain(sentinel);
        }
      }
      for (const call of mockLogClaudeMetric.mock.calls) {
        for (const arg of call) {
          expect(flatten(arg), "logClaudeMetric leaked").not.toContain(sentinel);
        }
      }
    } finally {
      for (const spy of Object.values(consoleSpies)) spy.mockRestore();
    }
  });

  it("never logs observation values via console / logAudit / logClaudeMetric", async () => {
    mockGetAuthUser.mockResolvedValue(VALID_USER);
    setupQueryHappyPath("plus");

    const sentinelDisplay = "UNIQUE_OBS_DISPLAY_LEAK_PROBE";
    const sentinelSource = "UNIQUE_SOURCE_TEXT_LEAK_PROBE";
    mockMessagesCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: envelopeText({
            observations: [
              {
                category: "biomarker",
                code_system: "LOINC",
                code: "4548-4",
                display: sentinelDisplay,
                value_num: 7.2,
                value_text: null,
                unit: "%",
                effective_at: "2026-05-15",
                confidence: 0.95,
                source_text: sentinelSource,
              },
            ],
            summary: "summary",
          }),
        },
      ],
    });

    const consoleSpies = {
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
      info: vi.spyOn(console, "info").mockImplementation(() => {}),
    };

    try {
      const { POST } = await loadRoute();
      await POST(makeRequest(VALID_BODY));

      function flatten(value: unknown): string {
        try {
          return typeof value === "string" ? value : JSON.stringify(value);
        } catch {
          return "";
        }
      }

      for (const [name, spy] of Object.entries(consoleSpies)) {
        for (const call of spy.mock.calls) {
          for (const arg of call) {
            const flat = flatten(arg);
            expect(flat, `console.${name} leaked display`).not.toContain(sentinelDisplay);
            expect(flat, `console.${name} leaked source_text`).not.toContain(sentinelSource);
          }
        }
      }
      for (const call of mockLogAudit.mock.calls) {
        for (const arg of call) {
          const flat = flatten(arg);
          expect(flat, "logAudit leaked display").not.toContain(sentinelDisplay);
          expect(flat, "logAudit leaked source_text").not.toContain(sentinelSource);
        }
      }
      for (const call of mockLogClaudeMetric.mock.calls) {
        for (const arg of call) {
          const flat = flatten(arg);
          expect(flat, "logClaudeMetric leaked").not.toContain(sentinelDisplay);
          expect(flat, "logClaudeMetric leaked").not.toContain(sentinelSource);
        }
      }
    } finally {
      for (const spy of Object.values(consoleSpies)) spy.mockRestore();
    }
  });
});

describe("POST /api/parse-report — audit + metric record only metadata, not bodies", () => {
  it("logAudit metadata contains only report_type + duration + outcome (no content)", async () => {
    mockGetAuthUser.mockResolvedValue(VALID_USER);
    setupQueryHappyPath("trial");
    mockMessagesCreate.mockResolvedValue(defaultClaudeResponse());

    const { POST } = await loadRoute();
    await POST(makeRequest(VALID_BODY));

    expect(mockLogAudit).toHaveBeenCalled();
    const [action, opts] = mockLogAudit.mock.calls[0];
    expect(action).toBe("PARSE_REPORT_INVOKED");
    const meta = (opts as { metadata: Record<string, unknown> }).metadata;
    // Allowed keys only:
    for (const key of Object.keys(meta)) {
      expect(
        ["report_type", "durationMs", "outcome", "observation_count"].includes(key),
        `unexpected audit metadata key: ${key}`,
      ).toBe(true);
    }
    expect(meta.report_type).toBe("lab");
  });

  it("logClaudeMetric records iterations=1, no toolsUsed, no bodies", async () => {
    mockGetAuthUser.mockResolvedValue(VALID_USER);
    setupQueryHappyPath("plus");
    mockMessagesCreate.mockResolvedValue(defaultClaudeResponse());

    const { POST } = await loadRoute();
    await POST(makeRequest(VALID_BODY));

    expect(mockLogClaudeMetric).toHaveBeenCalledTimes(1);
    const [data] = mockLogClaudeMetric.mock.calls[0];
    const d = data as {
      model: string;
      iterations: number;
      totalMs: number;
      timedOut: boolean;
      toolsUsed: string[];
    };
    expect(d.iterations).toBe(1);
    expect(d.toolsUsed).toEqual([]);
    expect(typeof d.totalMs).toBe("number");
    expect(typeof d.model).toBe("string");
  });
});
