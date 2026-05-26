import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * claude.ts — Unit Tests
 *
 * Tests the extraction pipeline, session state management, user info parsing,
 * tool processing, and the chat loop's edge cases.
 * The Claude API is mocked — we test our code, not Anthropic's.
 */

// Mock Anthropic SDK — must be constructable classes
const mockCreate = vi.fn();
function MockClient() { return { messages: { create: mockCreate } }; }
vi.mock("@anthropic-ai/sdk", () => ({ default: MockClient }));
vi.mock("@anthropic-ai/bedrock-sdk", () => ({ default: MockClient }));

// Need to set ANTHROPIC_API_KEY so getClaudeClient() uses the mocked Anthropic (not Bedrock)
process.env.ANTHROPIC_API_KEY = "test-key";

import {
  extractUserInfo,
  formatMessages,
  createDefaultSessionState,
  chat,
  type ToolExecutor,
  type ToolDefinition,
  type SessionState,
} from "../claude";

function makeState(overrides?: Partial<SessionState>): SessionState {
  return { ...createDefaultSessionState(), ...overrides };
}

// ── extractUserInfo ──

describe("extractUserInfo — name extraction", () => {
  it("extracts name from 'I'm John'", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "I'm John" }],
      makeState()
    );
    expect(state.userName).toBe("John");
  });

  it("extracts name from 'call me Sarah'", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "call me Sarah" }],
      makeState()
    );
    expect(state.userName).toBe("Sarah");
  });

  it("extracts name from 'my name is Bob'", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "my name is Bob" }],
      makeState()
    );
    expect(state.userName).toBe("Bob");
  });

  it("extracts name from short single-word message", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "Maria" }],
      makeState()
    );
    expect(state.userName).toBe("Maria");
  });

  it("does NOT extract common verbs as names ('I'm having...')", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "I'm having trouble with my bill" }],
      makeState()
    );
    // NOT_NAMES blocklist filters out gerunds/prepositions
    expect(state.userName).toBeFalsy();
  });

  it("does NOT extract prepositions as names", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "I'm about to call Medicare" }],
      makeState()
    );
    expect(state.userName).toBeFalsy();
  });

  it("does not overwrite existing name", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "I'm Jane" }],
      makeState({ userName: "Bob" })
    );
    expect(state.userName).toBe("Bob");
  });
});

describe("extractUserInfo — ZIP code", () => {
  it("extracts 5-digit ZIP", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "I live in 75201" }],
      makeState()
    );
    expect(state.userZip).toBe("75201");
  });

  it("does not overwrite existing ZIP", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "My zip is 90210" }],
      makeState({ userZip: "75201" })
    );
    expect(state.userZip).toBe("75201");
  });
});

describe("extractUserInfo — duration", () => {
  it("extracts '6 weeks'", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "It's been going on for 6 weeks" }],
      makeState()
    );
    expect(state.duration).toContain("6");
    expect(state.duration).toContain("week");
  });

  it("extracts '3 months'", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "About 3 months now" }],
      makeState()
    );
    expect(state.duration).toContain("3");
    expect(state.duration).toContain("month");
  });
});

describe("extractUserInfo — provider name", () => {
  it("extracts 'Dr. Smith'", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "I see Dr. Smith" }],
      makeState()
    );
    // Regex captures up to 2 words after Dr. — "Smith" is clean here
    expect(state.providerName).toBe("Smith");
  });

  it("extracts 'Doctor Chen' with trailing word", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "Doctor Chen" }],
      makeState()
    );
    expect(state.providerName).toBe("Chen");
  });
});

describe("extractUserInfo — Medicare type detection", () => {
  it("detects Medicare Advantage", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "I have Medicare Advantage" }],
      makeState()
    );
    expect(state.medicareType).toBe("advantage");
  });

  it("detects MA plan name (Humana)", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "I'm on Humana Gold Plus" }],
      makeState()
    );
    expect(state.medicareType).toBe("advantage");
  });

  it("detects Original Medicare", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "I have Original Medicare" }],
      makeState()
    );
    expect(state.medicareType).toBe("original");
  });

  it("maps Medigap to original", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "I have a Medigap plan" }],
      makeState()
    );
    expect(state.medicareType).toBe("original");
  });
});

describe("extractUserInfo — appeal detection", () => {
  it("detects appeal intent from 'denied'", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "My claim was denied" }],
      makeState()
    );
    expect(state.isAppeal).toBe(true);
  });

  it("detects Level 2 escalation", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "My first appeal was denied, I need to go to the next level" }],
      makeState({ isAppeal: true })
    );
    expect(state.appealLevel).toBe(2);
  });

  it("detects Level 3 (ALJ) from 'second appeal denied'", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "My second appeal denied too" }],
      makeState({ isAppeal: true, appealLevel: undefined as unknown as number })
    );
    expect(state.appealLevel).toBe(3);
  });

  it("extracts denial codes from user message", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "I got denial code CO-50 on my claim" }],
      makeState({ isAppeal: true })
    );
    expect(state.denialCodes).toContain("50");
  });

  it("extracts denial date", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "My claim was denied on 1/15/2026" }],
      makeState()
    );
    expect(state.denialDate).toContain("1/15/2026");
  });
});

describe("extractUserInfo — requirement skip", () => {
  it("marks verification complete on 'skip'", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "Just skip that" }],
      makeState({ requirementsToVerify: ["Symptom duration > 6 weeks"] })
    );
    expect(state.verificationComplete).toBe(true);
  });

  it("implicit skip when user asks for checklist directly", () => {
    const state = extractUserInfo(
      [{ role: "user", content: "Show me the checklist" }],
      makeState({ coverageCriteria: ["coverage_checked"], requirementsToVerify: [] })
    );
    expect(state.verificationComplete).toBe(true);
  });
});

// ── formatMessages ──

describe("formatMessages", () => {
  it("formats simple text messages", () => {
    const result = formatMessages([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ role: "user", content: "Hello" });
    expect(result[1]).toEqual({ role: "assistant", content: "Hi there" });
  });

  it("attaches PDF to last user message only", () => {
    const attachment = {
      mediaType: "application/pdf" as const,
      base64Data: "abc123",
      sizeBytes: 100,
      fileName: "test.pdf",
    };
    const result = formatMessages(
      [
        { role: "user", content: "First message" },
        { role: "assistant", content: "Reply" },
        { role: "user", content: "Here's my EOB" },
      ],
      attachment
    );

    // First user message should be plain text
    expect(result[0].content).toBe("First message");
    // Last user message should be multimodal
    expect(Array.isArray(result[2].content)).toBe(true);
    const blocks = result[2].content as Array<{ type: string }>;
    expect(blocks.some(b => b.type === "document")).toBe(true);
    expect(blocks.some(b => b.type === "text")).toBe(true);
  });

  it("attaches image as image block", () => {
    const attachment = {
      mediaType: "image/png" as const,
      base64Data: "imgdata",
      sizeBytes: 500,
      fileName: "scan.png",
    };
    const result = formatMessages(
      [{ role: "user", content: "What's this?" }],
      attachment
    );
    const blocks = result[0].content as Array<{ type: string }>;
    expect(blocks.some(b => b.type === "image")).toBe(true);
  });
});

// ── chat() — extraction pipeline via mock API ──

describe("chat — extraction pipeline", () => {
  const toolDefs: ToolDefinition[] = [];
  const toolExecutors = new Map<string, ToolExecutor>();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockClaudeResponse(text: string, stopReason = "end_turn") {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text }],
      stop_reason: stopReason,
      usage: { input_tokens: 100, output_tokens: 50 },
    });
  }

  it("extracts [MEDICARE_TYPE] and removes it from content", async () => {
    mockClaudeResponse("Hello!\n[MEDICARE_TYPE]advantage[/MEDICARE_TYPE]\nHow can I help?");

    const result = await chat(
      { messages: [{ role: "user", content: "hi" }], systemPrompt: "test", tools: toolDefs },
      toolExecutors
    );

    expect(result.sessionState.medicareType).toBe("advantage");
    expect(result.content).not.toContain("MEDICARE_TYPE");
    expect(result.content).toContain("Hello!");
  });

  it("maps supplement to original Medicare type", async () => {
    mockClaudeResponse("[MEDICARE_TYPE]supplement[/MEDICARE_TYPE]\nYou have Medigap.");

    const result = await chat(
      { messages: [{ role: "user", content: "hi" }], systemPrompt: "test", tools: toolDefs },
      toolExecutors
    );

    expect(result.sessionState.medicareType).toBe("original");
  });

  it("extracts [REQUIREMENTS] and populates requirementsToVerify", async () => {
    mockClaudeResponse(
      "Coverage found.\n[REQUIREMENTS]\n- Symptom duration > 6 weeks\n- Failed conservative treatment\n[/REQUIREMENTS]\nLet me check."
    );

    const result = await chat(
      { messages: [{ role: "user", content: "hi" }], systemPrompt: "test", tools: toolDefs },
      toolExecutors
    );

    expect(result.sessionState.requirementsToVerify).toContain("Symptom duration > 6 weeks");
    expect(result.sessionState.requirementsToVerify).toContain("Failed conservative treatment");
    expect(result.content).not.toContain("REQUIREMENTS");
  });

  it("extracts [VERIFIED] blocks and updates requirementAnswers", async () => {
    const state = makeState({
      requirementsToVerify: ["Symptom duration > 6 weeks"],
    });
    mockClaudeResponse("Got it.\n[VERIFIED]Symptom duration > 6 weeks|true[/VERIFIED]\nYou're all set.");

    const result = await chat(
      { messages: [{ role: "user", content: "hi" }], systemPrompt: "test", tools: toolDefs, sessionState: state },
      toolExecutors
    );

    expect(result.sessionState.requirementAnswers["Symptom duration > 6 weeks"]).toBe(true);
    expect(result.sessionState.verificationComplete).toBe(true);
    expect(result.content).not.toContain("VERIFIED");
  });

  it("extracts [PRIOR_AUTH_LCD] and sets priorAuthRequired", async () => {
    mockClaudeResponse("The LCD says:\n[PRIOR_AUTH_LCD]true[/PRIOR_AUTH_LCD]\nPrior auth needed.");

    const result = await chat(
      { messages: [{ role: "user", content: "hi" }], systemPrompt: "test", tools: toolDefs },
      toolExecutors
    );

    expect(result.sessionState.priorAuthRequired).toBe(true);
    expect(result.sessionState.priorAuthSource).toBe("lcd");
    expect(result.content).not.toContain("PRIOR_AUTH_LCD");
  });

  it("extracts [SUGGESTIONS] block", async () => {
    mockClaudeResponse("Here's what I found.\n[SUGGESTIONS]\nCheck coverage\nFile appeal\n[/SUGGESTIONS]");

    const result = await chat(
      { messages: [{ role: "user", content: "hi" }], systemPrompt: "test", tools: toolDefs },
      toolExecutors
    );

    expect(result.suggestions).toContain("Check coverage");
    expect(result.suggestions).toContain("File appeal");
    expect(result.content).not.toContain("SUGGESTIONS");
  });

  it("generates fallback suggestions when no [SUGGESTIONS] block", async () => {
    mockClaudeResponse("What's your name?");

    const result = await chat(
      { messages: [{ role: "user", content: "hi" }], systemPrompt: "test", tools: toolDefs },
      toolExecutors
    );

    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("extracts policy references from content", async () => {
    mockClaudeResponse("According to LCD L35936 and NCD 220.6, this is covered.");

    const result = await chat(
      { messages: [{ role: "user", content: "hi" }], systemPrompt: "test", tools: toolDefs },
      toolExecutors
    );

    expect(result.sessionState.policyReferences).toContain("L35936");
    expect(result.sessionState.policyReferences.some(r => r.includes("NCD 220.6"))).toBe(true);
  });
});

// ── chat() — tool processing ──

describe("chat — tool calling loop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes tools and returns final text response", async () => {
    // First call: Claude requests a tool
    mockCreate
      .mockResolvedValueOnce({
        content: [
          { type: "tool_use", id: "tu_1", name: "search_cpt", input: { query: "MRI" } },
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 100, output_tokens: 50 },
      })
      // Second call: Claude returns text
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "MRI code is 72148." }],
        stop_reason: "end_turn",
        usage: { input_tokens: 200, output_tokens: 50 },
      });

    const mockExecutor: ToolExecutor = vi.fn().mockResolvedValue({
      success: true,
      data: { codes: [{ code: "72148", description: "MRI Lumbar Spine" }] },
    });

    const toolDefs: ToolDefinition[] = [{
      name: "search_cpt",
      description: "Search CPT codes",
      input_schema: { type: "object", properties: { query: { type: "string" } } },
    }];

    const result = await chat(
      { messages: [{ role: "user", content: "What's the CPT for MRI?" }], systemPrompt: "test", tools: toolDefs },
      new Map([["search_cpt", mockExecutor]])
    );

    expect(result.toolsUsed).toContain("search_cpt");
    expect(result.content).toContain("72148");
    expect(result.sessionState.procedureCodes).toContain("72148");
  });

  it("handles unknown tool gracefully", async () => {
    mockCreate
      .mockResolvedValueOnce({
        content: [
          { type: "tool_use", id: "tu_2", name: "nonexistent_tool", input: {} },
        ],
        stop_reason: "tool_use",
        usage: {},
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "I couldn't find that." }],
        stop_reason: "end_turn",
        usage: {},
      });

    const result = await chat(
      { messages: [{ role: "user", content: "test" }], systemPrompt: "test", tools: [] },
      new Map()
    );

    expect(result.content).toContain("couldn't find");
  });

  it("handles tool executor throwing error", async () => {
    mockCreate
      .mockResolvedValueOnce({
        content: [
          { type: "tool_use", id: "tu_3", name: "failing_tool", input: {} },
        ],
        stop_reason: "tool_use",
        usage: {},
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "That didn't work." }],
        stop_reason: "end_turn",
        usage: {},
      });

    const failingExecutor: ToolExecutor = vi.fn().mockRejectedValue(new Error("DB connection failed"));

    const result = await chat(
      { messages: [{ role: "user", content: "test" }], systemPrompt: "test", tools: [{ name: "failing_tool", description: "", input_schema: { type: "object", properties: {} } }] },
      new Map([["failing_tool", failingExecutor]])
    );

    expect(result.content).toBeTruthy();
  });
});

// ── chat() — max iterations fallback ──

describe("chat — max iterations graceful fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns partial content when max iterations hit", async () => {
    // Every call returns tool_use — forces max iteration exit
    mockCreate.mockResolvedValue({
      content: [
        { type: "text", text: "Looking up information..." },
        { type: "tool_use", id: "tu_loop", name: "test_tool", input: {} },
      ],
      stop_reason: "tool_use",
      usage: {},
    });

    const mockExecutor: ToolExecutor = vi.fn().mockResolvedValue({ success: true, data: {} });

    const result = await chat(
      { messages: [{ role: "user", content: "test" }], systemPrompt: "test", tools: [{ name: "test_tool", description: "", input_schema: { type: "object", properties: {} } }] },
      new Map([["test_tool", mockExecutor]]),
      2 // maxIterations = 2
    );

    // Should return partial content from last assistant message, not crash
    expect(result.content).toBeTruthy();
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("returns fallback message when no text found in any iteration", async () => {
    // Every call returns tool_use only — no text blocks
    mockCreate.mockResolvedValue({
      content: [
        { type: "tool_use", id: "tu_only", name: "test_tool", input: {} },
      ],
      stop_reason: "tool_use",
      usage: {},
    });

    const mockExecutor: ToolExecutor = vi.fn().mockResolvedValue({ success: true, data: {} });

    const result = await chat(
      { messages: [{ role: "user", content: "test" }], systemPrompt: "test", tools: [{ name: "test_tool", description: "", input_schema: { type: "object", properties: {} } }] },
      new Map([["test_tool", mockExecutor]]),
      2
    );

    expect(result.content).toContain("try again");
    expect(result.suggestions).toContain("Try again");
  });
});
