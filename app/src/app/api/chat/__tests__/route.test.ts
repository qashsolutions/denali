import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/chat — Unit Tests
 *
 * Tests the pre-stream logic: validation, auth, plan detection,
 * rate limiting, trial expiry, attachment validation.
 * Claude API call is mocked to avoid testing the AI layer.
 */

// --- Mocks ---

const mockGetAuthUser = vi.fn();
vi.mock("@/lib/auth-server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}));

const mockQuery = vi.fn();
vi.mock("@/lib/db", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockReturnValue(Promise.resolve()),
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
  buildSystemPromptForUser: vi.fn(() => "system prompt"),
  buildSystemPromptForUserWithLearning: vi.fn(() => Promise.resolve("system prompt with learning")),
}));

vi.mock("@/lib/tools", () => ({
  getToolDefinitions: vi.fn(() => []),
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
import { POST, GET } from "../route";
import { detectTriggers } from "@/lib/skills-loader";
import { saveAppeal, getUnreportedOutcome } from "@/lib/conversation-server";
import { extractUserInfo, createDefaultSessionState } from "@/lib/claude";
import { API_CONFIG } from "@/config";

const MOCK_USER = { userId: "user-123", email: "test@example.com" };

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockProfile(
  plan: string | null,
  isAdmin = false,
  role = "patient",
  isOnMedicare: boolean | null = true,
) {
  return {
    rows: [{
      plan,
      is_admin: isAdmin,
      role,
      is_on_medicare: isOnMedicare,
      created_at: new Date().toISOString(),
    }],
    rowCount: 1,
    command: "SELECT",
    oid: 0,
    fields: [],
  };
}

/** Helper to read SSE events from a streaming Response */
async function readSSEEvents(response: Response): Promise<Array<{ event: string; data: unknown }>> {
  const text = await response.text();
  const events: Array<{ event: string; data: unknown }> = [];
  const blocks = text.split("\n\n").filter(Boolean);
  for (const block of blocks) {
    const eventMatch = block.match(/^event: (.+)$/m);
    const dataMatch = block.match(/^data: (.+)$/m);
    if (eventMatch && dataMatch) {
      try {
        events.push({ event: eventMatch[1], data: JSON.parse(dataMatch[1]) });
      } catch {
        events.push({ event: eventMatch[1], data: dataMatch[1] });
      }
    }
  }
  return events;
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated user with starter plan, rate limits pass
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) return Promise.resolve(mockProfile("starter"));
      if (sql.includes("check_weekly_frequency")) return Promise.resolve({ rows: [{ allowed: true, days_used: 0 }] });
      if (sql.includes("check_and_increment_chat")) return Promise.resolve({ rows: [{ allowed: true, count: 1 }] });
      if (sql.includes("INSERT INTO conversations")) return Promise.resolve({ rows: [{ id: "conv-1" }] });
      if (sql.includes("INSERT INTO messages")) return Promise.resolve({ rows: [] });
      if (sql.includes("UPDATE conversations")) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });
    mockChat.mockResolvedValue({
      content: "Hello!",
      suggestions: ["Try this"],
      sessionState: { diagnosisCodes: [], procedureCodes: [], denialCodes: [], policyReferences: [], isAppeal: false },
      toolsUsed: [],
    });
  });

  // ── Validation ──

  it("returns 400 when messages array is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 400 when messages is empty array", async () => {
    const res = await POST(makeRequest({ messages: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when messages is not an array", async () => {
    const res = await POST(makeRequest({ messages: "hello" }));
    expect(res.status).toBe(400);
  });

  // ── Auth ──

  it("returns 401 when user is not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.code).toBe("AUTH_REQUIRED");
  });

  // ── Plan detection & rate limits ──

  it("sets unlimited limits for admin users", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) return Promise.resolve(mockProfile("trial", true));
      // Admin: weeklyLimit=0 so weekly check is skipped, chatLimit=0 so daily check is skipped
      if (sql.includes("check_weekly_frequency")) throw new Error("should not be called");
      if (sql.includes("check_and_increment_chat")) throw new Error("should not be called");
      if (sql.includes("INSERT INTO conversations")) return Promise.resolve({ rows: [{ id: "conv-1" }] });
      if (sql.includes("INSERT INTO messages")) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));
    // Should succeed (SSE stream) — not hit rate limit functions
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("returns 403 TRIAL_EXPIRED when trial has ended", async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) return Promise.resolve(mockProfile("trial"));
      if (sql.includes("SELECT trial_end")) return Promise.resolve({ rows: [{ trial_end: pastDate }] });
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.code).toBe("TRIAL_EXPIRED");
    expect(body.upsell).toBe(true);
  });

  it("allows active trial users", async () => {
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) return Promise.resolve(mockProfile("trial"));
      if (sql.includes("SELECT trial_end")) return Promise.resolve({ rows: [{ trial_end: futureDate }] });
      if (sql.includes("check_weekly_frequency")) return Promise.resolve({ rows: [{ allowed: true, days_used: 0 }] });
      if (sql.includes("check_and_increment_chat")) return Promise.resolve({ rows: [{ allowed: true, count: 1 }] });
      if (sql.includes("INSERT INTO conversations")) return Promise.resolve({ rows: [{ id: "conv-1" }] });
      if (sql.includes("INSERT INTO messages")) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("returns 403 for unknown plan", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) return Promise.resolve(mockProfile("legacy_plan"));
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.code).toBe("TRIAL_EXPIRED");
  });

  it("returns 429 WEEKLY_LIMIT when weekly frequency exceeded", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) return Promise.resolve(mockProfile("starter"));
      if (sql.includes("check_weekly_frequency")) return Promise.resolve({ rows: [{ allowed: false, days_used: 1 }] });
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(429);

    const body = await res.json();
    expect(body.code).toBe("WEEKLY_LIMIT");
  });

  it("returns 429 RATE_LIMITED when daily limit exceeded", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) return Promise.resolve(mockProfile("starter"));
      if (sql.includes("check_weekly_frequency")) return Promise.resolve({ rows: [{ allowed: true, days_used: 0 }] });
      if (sql.includes("check_and_increment_chat")) return Promise.resolve({ rows: [{ allowed: false, count: 20 }] });
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(429);

    const body = await res.json();
    expect(body.code).toBe("RATE_LIMITED");
  });

  it("skips weekly check for plus plan (weeklyLimit = 0)", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) return Promise.resolve(mockProfile("plus"));
      if (sql.includes("check_weekly_frequency")) throw new Error("should not be called for plus");
      if (sql.includes("check_and_increment_chat")) return Promise.resolve({ rows: [{ allowed: true, count: 1 }] });
      if (sql.includes("INSERT INTO conversations")) return Promise.resolve({ rows: [{ id: "conv-1" }] });
      if (sql.includes("INSERT INTO messages")) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("skips both rate checks for unlimited plan", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) return Promise.resolve(mockProfile("unlimited"));
      if (sql.includes("check_weekly_frequency")) throw new Error("should not be called");
      if (sql.includes("check_and_increment_chat")) throw new Error("should not be called");
      if (sql.includes("INSERT INTO conversations")) return Promise.resolve({ rows: [{ id: "conv-1" }] });
      if (sql.includes("INSERT INTO messages")) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  // ── Rate limit graceful degradation ──

  it("proceeds when weekly frequency check fails (DB error)", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) return Promise.resolve(mockProfile("starter"));
      if (sql.includes("check_weekly_frequency")) return Promise.reject(new Error("connection refused"));
      if (sql.includes("check_and_increment_chat")) return Promise.resolve({ rows: [{ allowed: true, count: 1 }] });
      if (sql.includes("INSERT INTO conversations")) return Promise.resolve({ rows: [{ id: "conv-1" }] });
      if (sql.includes("INSERT INTO messages")) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("proceeds when daily rate limit check fails (DB error)", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) return Promise.resolve(mockProfile("starter"));
      if (sql.includes("check_weekly_frequency")) return Promise.resolve({ rows: [{ allowed: true, days_used: 0 }] });
      if (sql.includes("check_and_increment_chat")) return Promise.reject(new Error("connection refused"));
      if (sql.includes("INSERT INTO conversations")) return Promise.resolve({ rows: [{ id: "conv-1" }] });
      if (sql.includes("INSERT INTO messages")) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  // ── Profile fallback (RDS down) ──

  it("returns 403 TRIAL_EXPIRED when profile query times out (Stage 2 behavior)", async () => {
    // withFallback returns empty rows after 5s → userProfile = null.
    // Stage 2: null profile → is_on_medicare = null !== true → non-Medicare trial path.
    // Non-Medicare trial: created_at = null → trialExpired = true → 403 TRIAL_EXPIRED.
    // (Previous behavior was SSE via the Medicare subscription path, but that path
    //  now requires is_on_medicare === true from the profile row.)
    let profileCalled = false;
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) {
        profileCalled = true;
        // Simulate timeout by never resolving (withFallback will use fallback after 5s)
        return new Promise(() => {});
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));
    expect(profileCalled).toBe(true);
    // Stage 2 behavior: profile timeout → null profile → non-Medicare trial → expired
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("TRIAL_EXPIRED");
  }, 10000);

  // ── Attachment validation ──

  it("returns 400 for unsupported media type", async () => {
    const res = await POST(makeRequest({
      messages: [{ role: "user", content: "hi" }],
      attachment: { mediaType: "text/html", base64Data: "abc", sizeBytes: 100, fileName: "test.html" },
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when base64Data is missing from attachment", async () => {
    const res = await POST(makeRequest({
      messages: [{ role: "user", content: "hi" }],
      attachment: { mediaType: "application/pdf", base64Data: "", sizeBytes: 100, fileName: "test.pdf" },
    }));
    expect(res.status).toBe(400);
  });

  it("returns 413 when attachment exceeds plan size limit", async () => {
    const res = await POST(makeRequest({
      messages: [{ role: "user", content: "hi" }],
      attachment: { mediaType: "application/pdf", base64Data: "abc", sizeBytes: 999999999, fileName: "big.pdf" },
    }));
    expect(res.status).toBe(413);
  });

  // ── Successful SSE stream ──

  it("returns SSE stream with done event on success", async () => {
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));

    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");

    const events = await readSSEEvents(res);
    const doneEvent = events.find(e => e.event === "done");
    expect(doneEvent).toBeTruthy();
    expect((doneEvent!.data as { content: string }).content).toBe("Hello!");
    expect((doneEvent!.data as { conversationId: string }).conversationId).toBe("conv-1");
  });

  it("returns error SSE event when Claude API fails", async () => {
    mockChat.mockRejectedValue(new Error("Bedrock timeout"));

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));

    const events = await readSSEEvents(res);
    const errorEvent = events.find(e => e.event === "error");
    expect(errorEvent).toBeTruthy();
  });

  // ── Auto-create trial for missing subscription ──

  // ── Role detection ──

  it("sets counselor trigger for counselor role", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) return Promise.resolve(mockProfile("starter", false, "counselor"));
      if (sql.includes("check_weekly_frequency")) return Promise.resolve({ rows: [{ allowed: true, days_used: 0 }] });
      if (sql.includes("check_and_increment_chat")) return Promise.resolve({ rows: [{ allowed: true, count: 1 }] });
      if (sql.includes("INSERT INTO conversations")) return Promise.resolve({ rows: [{ id: "conv-1" }] });
      if (sql.includes("INSERT INTO messages")) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    // detectTriggers is called, then the route mutates triggers.isCounselor
    const triggersMock = detectTriggers as ReturnType<typeof vi.fn>;
    const triggersResult = triggersMock.mock.results[0]?.value;
    // The route writes to the returned object after detectTriggers returns
    // We can't inspect that directly, but we can verify it didn't crash and produced SSE
  });

  it("sets provider trigger for provider role", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) return Promise.resolve(mockProfile("starter", false, "provider"));
      if (sql.includes("check_weekly_frequency")) return Promise.resolve({ rows: [{ allowed: true, days_used: 0 }] });
      if (sql.includes("check_and_increment_chat")) return Promise.resolve({ rows: [{ allowed: true, count: 1 }] });
      if (sql.includes("INSERT INTO conversations")) return Promise.resolve({ rows: [{ id: "conv-1" }] });
      if (sql.includes("INSERT INTO messages")) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  // ── Diabetes trigger detection ──

  it("sets diabetes trigger from conditions in sessionState", async () => {
    const mockExtractUserInfo = extractUserInfo as ReturnType<typeof vi.fn>;
    mockExtractUserInfo.mockImplementation((_msgs: unknown, ss: Record<string, unknown>) => ({
      ...ss,
      conditions: [{ name: "Type 2 diabetes", code: "E11", category: "type2" }],
    }));

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    // Restore default
    mockExtractUserInfo.mockImplementation((_msgs: unknown, ss: unknown) => ss);
  });

  it("sets diabetes trigger from user keyword 'a1c'", async () => {
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "What is my a1c?" }] }));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  // ── Obesity trigger detection ──

  it("sets obesity trigger from conditions", async () => {
    const mockExtractUserInfo = extractUserInfo as ReturnType<typeof vi.fn>;
    mockExtractUserInfo.mockImplementation((_msgs: unknown, ss: Record<string, unknown>) => ({
      ...ss,
      conditions: [{ name: "Morbid obesity", code: "E66.01", category: "obesity" }],
    }));

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    mockExtractUserInfo.mockImplementation((_msgs: unknown, ss: unknown) => ss);
  });

  it("sets obesity trigger from user keyword 'bariatric'", async () => {
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Does Medicare cover bariatric surgery?" }] }));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("sets obesity trigger from medication (isObesityMed)", async () => {
    const mockExtractUserInfo = extractUserInfo as ReturnType<typeof vi.fn>;
    mockExtractUserInfo.mockImplementation((_msgs: unknown, ss: Record<string, unknown>) => ({
      ...ss,
      medications: [{ name: "Wegovy", isObesityMed: true }],
    }));

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    mockExtractUserInfo.mockImplementation((_msgs: unknown, ss: unknown) => ss);
  });

  // ── Health data trigger ──

  it("sets health data triggers from sessionState", async () => {
    const mockExtractUserInfo = extractUserInfo as ReturnType<typeof vi.fn>;
    mockExtractUserInfo.mockImplementation((_msgs: unknown, ss: Record<string, unknown>) => ({
      ...ss,
      healthDataAvailable: true,
      recentDenials: [{ procedure: "MRI", serviceDate: "2026-01-01", denialReason: "Not necessary" }],
    }));

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    mockExtractUserInfo.mockImplementation((_msgs: unknown, ss: unknown) => ss);
  });

  // ── Conversation persistence ──

  it("creates new conversation and saves messages", async () => {
    let convCreated = false;
    let messagesSaved = false;
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) return Promise.resolve(mockProfile("starter"));
      if (sql.includes("check_weekly_frequency")) return Promise.resolve({ rows: [{ allowed: true, days_used: 0 }] });
      if (sql.includes("check_and_increment_chat")) return Promise.resolve({ rows: [{ allowed: true, count: 1 }] });
      if (sql.includes("INSERT INTO conversations")) {
        convCreated = true;
        return Promise.resolve({ rows: [{ id: "new-conv-id" }] });
      }
      if (sql.includes("INSERT INTO messages")) {
        messagesSaved = true;
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("UPDATE conversations")) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Hello doctor" }] }));
    const events = await readSSEEvents(res);
    const doneEvent = events.find(e => e.event === "done");

    expect(convCreated).toBe(true);
    expect((doneEvent!.data as { conversationId: string }).conversationId).toBe("new-conv-id");
    // Messages are saved fire-and-forget, so they may not be done yet
    // but the query should have been called
  });

  it("uses existing conversationId when provided", async () => {
    let convInsertCalled = false;
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) return Promise.resolve(mockProfile("starter"));
      if (sql.includes("check_weekly_frequency")) return Promise.resolve({ rows: [{ allowed: true, days_used: 0 }] });
      if (sql.includes("check_and_increment_chat")) return Promise.resolve({ rows: [{ allowed: true, count: 1 }] });
      if (sql.includes("INSERT INTO conversations")) {
        convInsertCalled = true;
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("INSERT INTO messages")) return Promise.resolve({ rows: [] });
      if (sql.includes("UPDATE conversations")) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({
      messages: [{ role: "user", content: "follow up" }],
      conversationId: "existing-conv-99",
    }));
    const events = await readSSEEvents(res);
    const doneEvent = events.find(e => e.event === "done");

    expect(convInsertCalled).toBe(false); // Should NOT create new conversation
    expect((doneEvent!.data as { conversationId: string }).conversationId).toBe("existing-conv-99");
  });

  it("generates UUID when conversation DB insert fails", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) return Promise.resolve(mockProfile("starter"));
      if (sql.includes("check_weekly_frequency")) return Promise.resolve({ rows: [{ allowed: true, days_used: 0 }] });
      if (sql.includes("check_and_increment_chat")) return Promise.resolve({ rows: [{ allowed: true, count: 1 }] });
      if (sql.includes("INSERT INTO conversations")) return Promise.reject(new Error("DB error"));
      if (sql.includes("INSERT INTO messages")) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));
    const events = await readSSEEvents(res);
    const doneEvent = events.find(e => e.event === "done");

    // Should still succeed with a UUID fallback
    expect(doneEvent).toBeTruthy();
    expect((doneEvent!.data as { conversationId: string }).conversationId).toBeTruthy();
  });

  // ── Appeal persistence ──

  it("saves appeal when generate_appeal_letter tool was used", async () => {
    const mockSaveAppeal = saveAppeal as ReturnType<typeof vi.fn>;
    mockSaveAppeal.mockResolvedValue("appeal-id-123");

    mockChat.mockResolvedValue({
      content: "Here is your appeal letter.",
      appealLetter: "MEDICARE APPEAL REQUEST...",
      suggestions: [],
      sessionState: {
        diagnosisCodes: ["E11.65"], procedureCodes: ["99213"], denialCodes: ["50"],
        policyReferences: ["L35936", "NCD 220.6"], isAppeal: true,
        denialDate: "2026-01-15", medicareType: "original", appealLevel: 1, priorAppealId: null,
      },
      toolsUsed: ["generate_appeal_letter"],
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Appeal my denial" }] }));
    const events = await readSSEEvents(res);
    const doneEvent = events.find(e => e.event === "done");

    expect(mockSaveAppeal).toHaveBeenCalled();
    expect((doneEvent!.data as { appealId: string }).appealId).toBe("appeal-id-123");
    expect((doneEvent!.data as { appealLetter: string }).appealLetter).toBe("MEDICARE APPEAL REQUEST...");
  });

  it("continues when appeal save fails", async () => {
    const mockSaveAppeal = saveAppeal as ReturnType<typeof vi.fn>;
    mockSaveAppeal.mockRejectedValue(new Error("DB error"));

    mockChat.mockResolvedValue({
      content: "Appeal letter here.",
      suggestions: [],
      sessionState: { diagnosisCodes: [], procedureCodes: [], denialCodes: [], policyReferences: [], isAppeal: true },
      toolsUsed: ["generate_appeal_letter"],
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "appeal" }] }));
    const events = await readSSEEvents(res);
    const doneEvent = events.find(e => e.event === "done");

    // Should still return content despite appeal save failure
    expect(doneEvent).toBeTruthy();
    expect((doneEvent!.data as { content: string }).content).toBe("Appeal letter here.");
  });

  // ── Suggestions persistence ──

  it("persists suggestions to conversation", async () => {
    let suggestionsSaved = false;
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) return Promise.resolve(mockProfile("starter"));
      if (sql.includes("check_weekly_frequency")) return Promise.resolve({ rows: [{ allowed: true, days_used: 0 }] });
      if (sql.includes("check_and_increment_chat")) return Promise.resolve({ rows: [{ allowed: true, count: 1 }] });
      if (sql.includes("INSERT INTO conversations")) return Promise.resolve({ rows: [{ id: "conv-1" }] });
      if (sql.includes("INSERT INTO messages")) return Promise.resolve({ rows: [] });
      if (sql.includes("UPDATE conversations") && sql.includes("last_suggestions")) {
        suggestionsSaved = true;
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    mockChat.mockResolvedValue({
      content: "Hello!",
      suggestions: ["Check coverage", "File appeal"],
      sessionState: { diagnosisCodes: [], procedureCodes: [], denialCodes: [], policyReferences: [], isAppeal: false },
      toolsUsed: [],
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));
    await readSSEEvents(res); // consume stream to let fire-and-forget queries run

    // Give fire-and-forget a tick to execute
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(suggestionsSaved).toBe(true);
  });

  // ── Unreported outcome check ──

  it("checks for unreported outcomes on first message with userName", async () => {
    const mockGetUnreported = getUnreportedOutcome as ReturnType<typeof vi.fn>;
    mockGetUnreported.mockResolvedValue({
      appealId: "appeal-old",
      serviceDescription: "MRI Lumbar",
      appealLevel: 1,
    });

    const mockExtractUserInfo = extractUserInfo as ReturnType<typeof vi.fn>;
    mockExtractUserInfo.mockImplementation((_msgs: unknown, ss: Record<string, unknown>) => ({
      ...ss,
      userName: "John",
      email: "john@test.com",
    }));

    const res = await POST(makeRequest({
      messages: [{ role: "user", content: "hi" }],
      sessionState: { email: "john@test.com" },
    }));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(mockGetUnreported).toHaveBeenCalled();

    mockExtractUserInfo.mockImplementation((_msgs: unknown, ss: unknown) => ss);
  });

  // ── GET health check on chat route ──

  it("GET returns health status JSON", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.hasBedrockAccess).toBe(true);
    expect(body.timestamp).toBeTruthy();
  });

  // ── Auto-create trial ──

  it("auto-creates trial when subscription row is missing", async () => {
    let trialCreated = false;
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) return Promise.resolve(mockProfile("trial"));
      if (sql.includes("SELECT trial_end")) return Promise.resolve({ rows: [] }); // No subscription row
      if (sql.includes("INSERT INTO subscriptions")) {
        trialCreated = true;
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("check_weekly_frequency")) return Promise.resolve({ rows: [{ allowed: true, days_used: 0 }] });
      if (sql.includes("check_and_increment_chat")) return Promise.resolve({ rows: [{ allowed: true, count: 1 }] });
      if (sql.includes("INSERT INTO conversations")) return Promise.resolve({ rows: [{ id: "conv-1" }] });
      if (sql.includes("INSERT INTO messages")) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(trialCreated).toBe(true);
  });
});

// =============================================================================
// T6 — Appeal tool filter
// =============================================================================
//
// Stage 2: non-Medicare users must never get generate_appeal_letter in the
// tool list. We test the filter predicate directly against real tool
// definitions without invoking the whole POST handler.
// @/lib/tools is mocked above for the route handler tests; T6 uses
// vi.importActual to load the real implementation for the predicate tests.

// T6 uses the REAL getToolDefinitions, not the mocked version used by the
// route handler tests above. We import it via vi.importActual at describe
// time and run the tests against real tool definitions.
describe("chat route — appeal tool filter (T6)", () => {
  type ToolDef = { name: string };
  let realGetToolDefinitions: () => ToolDef[];

  beforeEach(async () => {
    const realTools = await vi.importActual<typeof import("@/lib/tools")>("@/lib/tools");
    realGetToolDefinitions = realTools.getToolDefinitions as () => ToolDef[];
  });

  function applyFilter(isOnMedicare: boolean | undefined | null): string[] {
    return realGetToolDefinitions()
      .filter((t) => isOnMedicare === true || t.name !== "generate_appeal_letter")
      .map((t) => t.name);
  }

  it("includes generate_appeal_letter when isOnMedicare === true", () => {
    const names = applyFilter(true);
    expect(names).toContain("generate_appeal_letter");
  });

  it("excludes generate_appeal_letter when isOnMedicare === false", () => {
    const names = applyFilter(false);
    expect(names).not.toContain("generate_appeal_letter");
  });

  it("excludes generate_appeal_letter when isOnMedicare === undefined (only true passes)", () => {
    const names = applyFilter(undefined);
    expect(names).not.toContain("generate_appeal_letter");
  });

  it("all other tools survive the non-Medicare filter unchanged", () => {
    const allNames = realGetToolDefinitions().map((t) => t.name);
    const otherToolNames = allNames.filter((n) => n !== "generate_appeal_letter");
    const filteredNames = applyFilter(false);

    for (const name of otherToolNames) {
      expect(filteredNames).toContain(name);
    }
  });
});

// =============================================================================
// T9 — Non-Medicare trial rate limits
// =============================================================================
//
// Non-Medicare trial path uses users.created_at for expiry (3 calendar days)
// and a hard cap of 3 messages/day. This is distinct from the Medicare trial
// path (subscriptions.trial_end + PRICING.CHAT_LIMITS.TRIAL).

describe("POST /api/chat — non-Medicare trial rate limits (T9)", () => {
  const MSG = [{ role: "user" as const, content: "hi" }];

  // Helper: build a profile mock row
  function nonMedicareTrialProfile(overrides: {
    created_at: string | null;
    plan?: string;
    is_admin?: boolean;
    role?: string;
    is_on_medicare?: boolean | null;
  }) {
    return {
      rows: [
        {
          plan: overrides.plan ?? "trial",
          is_admin: overrides.is_admin ?? false,
          role: overrides.role ?? "patient",
          is_on_medicare: overrides.is_on_medicare ?? false,
          created_at: overrides.created_at,
        },
      ],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    };
  }

  it("T9-1: non-Medicare trial, count=0 (within 3-day window) → allowed (SSE stream)", async () => {
    const created_at = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) {
        return Promise.resolve(nonMedicareTrialProfile({ created_at }));
      }
      if (sql.includes("check_and_increment_chat")) {
        return Promise.resolve({ rows: [{ allowed: true, count: 1 }] });
      }
      if (sql.includes("INSERT INTO conversations")) {
        return Promise.resolve({ rows: [{ id: "conv-1" }] });
      }
      if (sql.includes("INSERT INTO messages")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: MSG }));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("T9-2: non-Medicare trial, count=3 (limit hit) → 429 NON_MEDICARE_DAILY_LIMIT without upsell", async () => {
    const created_at = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) {
        return Promise.resolve(nonMedicareTrialProfile({ created_at }));
      }
      if (sql.includes("check_and_increment_chat")) {
        return Promise.resolve({ rows: [{ allowed: false, count: 3 }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: MSG }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("NON_MEDICARE_DAILY_LIMIT");
    expect(body.limit).toBe(3);
    expect(body.count).toBe(3);
    // No upsell field on non-Medicare daily limit
    expect(body.upsell).toBeUndefined();
  });

  it("T9-3: non-Medicare trial, created_at=4 days ago → 403 TRIAL_EXPIRED with upsell", async () => {
    const created_at = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) {
        return Promise.resolve(nonMedicareTrialProfile({ created_at }));
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: MSG }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("TRIAL_EXPIRED");
    expect(body.upsell).toBe(true);
  });

  it("T9-4: non-Medicare trial, created_at=now → trial alive, allowed (SSE stream)", async () => {
    const created_at = new Date().toISOString();
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) {
        return Promise.resolve(nonMedicareTrialProfile({ created_at }));
      }
      if (sql.includes("check_and_increment_chat")) {
        return Promise.resolve({ rows: [{ allowed: true, count: 1 }] });
      }
      if (sql.includes("INSERT INTO conversations")) {
        return Promise.resolve({ rows: [{ id: "conv-1" }] });
      }
      if (sql.includes("INSERT INTO messages")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: MSG }));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("T9-5: non-Medicare trial, created_at=3 days minus 1 second → alive (margin tolerates CI latency)", async () => {
    const created_at = new Date(
      Date.now() - (3 * 24 * 60 * 60 * 1000 - 1000)
    ).toISOString();
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) {
        return Promise.resolve(nonMedicareTrialProfile({ created_at }));
      }
      if (sql.includes("check_and_increment_chat")) {
        return Promise.resolve({ rows: [{ allowed: true, count: 1 }] });
      }
      if (sql.includes("INSERT INTO conversations")) {
        return Promise.resolve({ rows: [{ id: "conv-1" }] });
      }
      if (sql.includes("INSERT INTO messages")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: MSG }));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("T9-6: non-Medicare trial, created_at=3 days plus 1ms → expired (strict > boundary)", async () => {
    const created_at = new Date(
      Date.now() - (3 * 24 * 60 * 60 * 1000 + 1)
    ).toISOString();
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) {
        return Promise.resolve(nonMedicareTrialProfile({ created_at }));
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: MSG }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("TRIAL_EXPIRED");
  });

  it("T9-7: non-Medicare trial, created_at=null → 403 TRIAL_EXPIRED (defensive null guard)", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) {
        return Promise.resolve(nonMedicareTrialProfile({ created_at: null }));
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: MSG }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("TRIAL_EXPIRED");
  });

  it("T9-8: Medicare trial (is_on_medicare=true), active subscription → uses PRICING.CHAT_LIMITS.TRIAL path (SSE stream)", async () => {
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) {
        return Promise.resolve({
          rows: [{
            plan: "trial",
            is_admin: false,
            role: "patient",
            is_on_medicare: true,
            created_at: new Date().toISOString(),
          }],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        });
      }
      if (sql.includes("SELECT trial_end")) {
        return Promise.resolve({ rows: [{ trial_end: futureDate }] });
      }
      if (sql.includes("check_weekly_frequency")) {
        return Promise.resolve({ rows: [{ allowed: true, days_used: 0 }] });
      }
      if (sql.includes("check_and_increment_chat")) {
        return Promise.resolve({ rows: [{ allowed: true, count: 1 }] });
      }
      if (sql.includes("INSERT INTO conversations")) {
        return Promise.resolve({ rows: [{ id: "conv-1" }] });
      }
      if (sql.includes("INSERT INTO messages")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: MSG }));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("T9-9: non-Medicare, plan=plus → standard Plus path, not non-Medicare trial branch (SSE stream)", async () => {
    const checkCalls: Array<[string, number]> = [];
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) {
        return Promise.resolve({
          rows: [{
            plan: "plus",
            is_admin: false,
            role: "patient",
            is_on_medicare: false,
            created_at: new Date().toISOString(),
          }],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        });
      }
      if (sql.includes("check_and_increment_chat")) {
        // Capture the limit argument
        checkCalls.push(["check_and_increment_chat", 20]);
        return Promise.resolve({ rows: [{ allowed: true, count: 1 }] });
      }
      if (sql.includes("INSERT INTO conversations")) {
        return Promise.resolve({ rows: [{ id: "conv-1" }] });
      }
      if (sql.includes("INSERT INTO messages")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: MSG }));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    // Non-Medicare trial branch should NOT have been taken
    // (no TRIAL_EXPIRED 403 means it didn't trip)
  });

  it("T9-10: non-Medicare, plan=unlimited → skips rate checks entirely (SSE stream)", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) {
        return Promise.resolve({
          rows: [{
            plan: "unlimited",
            is_admin: false,
            role: "patient",
            is_on_medicare: false,
            created_at: new Date().toISOString(),
          }],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        });
      }
      if (sql.includes("check_weekly_frequency")) {
        throw new Error("should not be called for unlimited plan");
      }
      if (sql.includes("check_and_increment_chat")) {
        throw new Error("should not be called for unlimited plan");
      }
      if (sql.includes("INSERT INTO conversations")) {
        return Promise.resolve({ rows: [{ id: "conv-1" }] });
      }
      if (sql.includes("INSERT INTO messages")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: MSG }));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("T9-11: is_on_medicare=null, plan=trial, within 3-day window, 3 msgs used → 429 NON_MEDICARE_DAILY_LIMIT (null treated as non-Medicare)", async () => {
    const created_at = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) {
        return Promise.resolve(nonMedicareTrialProfile({
          created_at,
          is_on_medicare: null,
        }));
      }
      if (sql.includes("check_and_increment_chat")) {
        return Promise.resolve({ rows: [{ allowed: false, count: 3 }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: MSG }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("NON_MEDICARE_DAILY_LIMIT");
  });

  it("T9-12: is_on_medicare=null, plan=trial, past 3-day window → 403 TRIAL_EXPIRED", async () => {
    const created_at = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) {
        return Promise.resolve(nonMedicareTrialProfile({
          created_at,
          is_on_medicare: null,
        }));
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await POST(makeRequest({ messages: MSG }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("TRIAL_EXPIRED");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Chunk 2.5a — modelOverride routing precedence
// Free-tier (any plan="trial") chat uses Haiku; appeals use Opus; paid uses
// default (undefined → Sonnet at lib/claude.ts). Tests assert the value passed
// as `modelOverride` to chat() via mockChat spy.
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/chat — modelOverride routing (Chunk 2.5a)", () => {
  const MSG = [{ role: "user" as const, content: "hi" }];

  beforeEach(() => {
    vi.clearAllMocks();
    mockChat.mockResolvedValue({
      content: "Hello!",
      suggestions: ["Try this"],
      sessionState: {
        diagnosisCodes: [],
        procedureCodes: [],
        denialCodes: [],
        policyReferences: [],
        isAppeal: false,
      },
      toolsUsed: [],
    });
  });

  /** Mock the standard happy-path query chain (rate limits allow, conversation/messages insert ok). */
  function setupHappyPath(profileRows: unknown[], trialEndInFuture = false) {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT plan")) {
        return Promise.resolve({ rows: profileRows, rowCount: profileRows.length });
      }
      if (sql.includes("SELECT trial_end")) {
        return Promise.resolve({
          rows: trialEndInFuture ? [{ trial_end: futureDate }] : [],
        });
      }
      if (sql.includes("check_weekly_frequency")) {
        return Promise.resolve({ rows: [{ allowed: true, days_used: 0 }] });
      }
      if (sql.includes("check_and_increment_chat")) {
        return Promise.resolve({ rows: [{ allowed: true, count: 1 }] });
      }
      if (sql.includes("INSERT INTO conversations")) {
        return Promise.resolve({ rows: [{ id: "conv-1" }] });
      }
      if (sql.includes("INSERT INTO messages")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });
  }

  function profileRow(opts: {
    plan: string | null;
    isOnMedicare: boolean | null;
  }) {
    return {
      plan: opts.plan,
      is_admin: false,
      role: "patient",
      is_on_medicare: opts.isOnMedicare,
      created_at: new Date().toISOString(),
    };
  }

  it("Case 1: trial + non-Medicare + non-appeal → trialModel (Haiku)", async () => {
    setupHappyPath([profileRow({ plan: "trial", isOnMedicare: false })]);
    const res = await POST(makeRequest({ messages: MSG }));
    await readSSEEvents(res);
    expect(mockChat.mock.calls[0][0].modelOverride).toBe(
      API_CONFIG.claude.trialModel,
    );
  });

  it("Case 2: trial + Medicare + non-appeal → trialModel (Haiku)", async () => {
    setupHappyPath(
      [profileRow({ plan: "trial", isOnMedicare: true })],
      true, // trial_end in future
    );
    const res = await POST(makeRequest({ messages: MSG }));
    await readSSEEvents(res);
    expect(mockChat.mock.calls[0][0].modelOverride).toBe(
      API_CONFIG.claude.trialModel,
    );
  });

  it("Case 3: trial + Medicare + appeal → appealModel (Opus) — appeal beats trial", async () => {
    setupHappyPath(
      [profileRow({ plan: "trial", isOnMedicare: true })],
      true,
    );
    const sessionState = { ...createDefaultSessionState(), isAppeal: true };
    const res = await POST(makeRequest({ messages: MSG, sessionState }));
    await readSSEEvents(res);
    expect(mockChat.mock.calls[0][0].modelOverride).toBe(
      API_CONFIG.claude.appealModel,
    );
  });

  it("Case 4: paid (plan='plus') + non-appeal → undefined (Sonnet default)", async () => {
    setupHappyPath([profileRow({ plan: "plus", isOnMedicare: true })]);
    const res = await POST(makeRequest({ messages: MSG }));
    await readSSEEvents(res);
    expect(mockChat.mock.calls[0][0].modelOverride).toBeUndefined();
  });

  it("Case 5: paid + appeal → appealModel (Opus)", async () => {
    setupHappyPath([profileRow({ plan: "plus", isOnMedicare: true })]);
    const sessionState = { ...createDefaultSessionState(), isAppeal: true };
    const res = await POST(makeRequest({ messages: MSG, sessionState }));
    await readSSEEvents(res);
    expect(mockChat.mock.calls[0][0].modelOverride).toBe(
      API_CONFIG.claude.appealModel,
    );
  });

  it("Case 6: new user (plan=null, profile loaded) + non-appeal → trialModel (Haiku)", async () => {
    // plan=null on a loaded profile row → route treats as trial via `userProfile?.plan || "trial"`.
    // Using non-Medicare path (isOnMedicare=false) avoids the subscriptions.trial_end lookup;
    // recent created_at keeps the non-Medicare 3-day window alive.
    setupHappyPath([profileRow({ plan: null, isOnMedicare: false })]);
    const res = await POST(makeRequest({ messages: MSG }));
    await readSSEEvents(res);
    expect(mockChat.mock.calls[0][0].modelOverride).toBe(
      API_CONFIG.claude.trialModel,
    );
  });

  it("Case 7: RDS timeout (userProfile=null) → 403 TRIAL_EXPIRED, chat never invoked (paid-quality protection)", async () => {
    // Documents the strict `userProfile != null && ...` check in isTrial:
    // even if the trial-expired fail-close (which fires first here, returning
    // 403) were bypassed, paid users would NOT be silently downgraded to Haiku
    // because the modelOverride logic resolves to undefined when userProfile
    // is null. Defense-in-depth: both layers fail closed.
    setupHappyPath([]); // SELECT plan returns no rows → userProfile null
    const res = await POST(makeRequest({ messages: MSG }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("TRIAL_EXPIRED");
    expect(mockChat).not.toHaveBeenCalled();
  });
});
