/**
 * Claude API Client
 *
 * Handles communication with Claude API for the chat functionality.
 * Manages tool calling loop and response processing.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ContentBlock, ToolUseBlock, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";
import type { BetaMessage, BetaRequestMCPServerURLDefinition } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { API_CONFIG } from "@/config";

// MCP Server configurations for Claude to access directly
// These give Claude direct access to real CMS coverage data (LCDs/NCDs)
export const MCP_SERVERS: BetaRequestMCPServerURLDefinition[] = [
  {
    type: "url",
    url: "https://mcp.deepsense.ai/cms_coverage/mcp",
    name: "cms-coverage",
  },
  {
    type: "url",
    url: "https://mcp.deepsense.ai/npi_registry/mcp",
    name: "npi-registry",
  },
  {
    type: "url",
    url: "https://mcp.deepsense.ai/icd10_codes/mcp",
    name: "icd10-codes",
  },
];

// Types for our tool system
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export type ToolExecutor = (input: Record<string, unknown>) => Promise<ToolResult>;

// Session state tracking
export interface SessionState {
  // Onboarding (NEW - warm personal flow)
  userName: string | null;           // "John" - use in responses!
  userZip: string | null;            // "94305" - use for NPI searches!

  // Medicare type
  medicareType: "original" | "advantage" | "supplement" | null;

  // Symptoms
  symptoms: string[];
  duration: string | null;
  severity: string | null;
  priorTreatments: string[];

  // Procedure
  procedureNeeded: string | null;

  // Provider (NPI lookup flow)
  providerName: string | null;       // Doctor name before confirmation
  providerSearchAttempts: number;    // Track NPI search attempts (max 3)
  provider: {
    name: string | null;
    npi: string | null;
    specialty: string | null;
    acceptsMedicare: boolean | null; // Medicare network status
  } | null;

  // Internal codes - NEVER show to user
  diagnosisCodes: string[];
  procedureCodes: string[];

  // Coverage & guidance
  coverageCriteria: string[];
  policyReferences: string[];                  // LCD/NCD policy numbers (e.g., "L35936", "NCD 220.6")
  guidanceGenerated: boolean;
  isAppeal: boolean;
  denialDate: string | null;                   // Date of denial (for appeal deadline calculation)

  // Prior authorization
  priorAuthRequired: boolean | null;           // Whether procedure requires prior auth
  priorAuthSource: "lcd" | "cms_model" | "hardcoded_list" | null;

  // Requirement verification (denial prevention)
  requirementsToVerify: string[];              // List of requirements to ask about
  requirementAnswers: Record<string, boolean>; // User's answers to requirements
  verificationComplete: boolean;               // All requirements asked
  meetsAllRequirements: boolean | null;        // Final determination

  // Red flag symptoms (can expedite approval)
  redFlagsPresent: string[];                   // List of red flags user confirmed
  redFlagsChecked: boolean;                    // Whether red flags have been asked about

  // Prior imaging status
  priorImagingDone: boolean | null;            // Whether prior imaging (X-ray) was done
  priorImagingType: string | null;             // Type of prior imaging (e.g., "X-ray")
  priorImagingDate: string | null;             // When prior imaging was done

  // Specialty validation
  specialtyMismatchWarning: string | null;     // Warning if provider specialty doesn't match procedure

  // Denial codes (CARC/RARC from denial letters)
  denialCodes: string[];                       // CARC/RARC codes mentioned in conversation
}

export interface ChatRequest {
  messages: MessageParam[];
  systemPrompt: string;
  tools: ToolDefinition[];
  sessionState?: SessionState;
  /** Override model (e.g., use Opus for appeals) */
  modelOverride?: string;
}

export interface ChatResult {
  content: string;
  suggestions: string[];
  sessionState: SessionState;
  toolsUsed: string[];
  appealLetter?: string;
}

// Initialize Claude client
let client: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

// Default session state
export function createDefaultSessionState(): SessionState {
  return {
    // Onboarding
    userName: null,
    userZip: null,

    // Medicare type
    medicareType: null,

    // Symptoms
    symptoms: [],
    duration: null,
    severity: null,
    priorTreatments: [],

    // Procedure
    procedureNeeded: null,

    // Provider
    providerName: null,
    providerSearchAttempts: 0,
    provider: null,

    // Internal codes
    diagnosisCodes: [],
    procedureCodes: [],

    // Coverage & guidance
    coverageCriteria: [],
    policyReferences: [],
    guidanceGenerated: false,
    isAppeal: false,
    denialDate: null,

    // Prior authorization
    priorAuthRequired: null,
    priorAuthSource: null,

    // Requirement verification
    requirementsToVerify: [],
    requirementAnswers: {},
    verificationComplete: false,
    meetsAllRequirements: null,

    // Red flag symptoms
    redFlagsPresent: [],
    redFlagsChecked: false,

    // Prior imaging status
    priorImagingDone: null,
    priorImagingType: null,
    priorImagingDate: null,

    // Specialty validation
    specialtyMismatchWarning: null,

    // Denial codes
    denialCodes: [],
  };
}

// Extract [MEDICARE_TYPE] block from Claude's response
function extractMedicareType(content: string, sessionState: SessionState): string {
  const match = content.match(/\[MEDICARE_TYPE\]\s*(original|advantage|supplement)\s*\[\/MEDICARE_TYPE\]/i);
  if (!match) return content;

  const type = match[1].toLowerCase() as "original" | "advantage" | "supplement";
  // Supplement maps to original (they have Original Medicare + Medigap)
  sessionState.medicareType = type === "supplement" ? "original" : type;
  console.log("[extractMedicareType] Set type:", sessionState.medicareType);

  // Remove block from content
  return content
    .replace(/\[MEDICARE_TYPE\][\s\S]*?\[\/MEDICARE_TYPE\]/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Extract [REQUIREMENTS] block from Claude's response
// Claude emits this after coverage tools return with LCD/NCD results
function extractRequirementsAndClean(content: string, sessionState: SessionState): {
  cleanContent: string;
  requirements: string[];
} {
  const match = content.match(/\[REQUIREMENTS\]\s*([\s\S]*?)\s*\[\/REQUIREMENTS\]/i);

  if (!match) {
    return { cleanContent: content, requirements: [] };
  }

  const requirements = match[1]
    .split(/\n/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter((line) => line.length > 0);

  // Remove the block from content
  const cleanContent = content
    .replace(/\[REQUIREMENTS\][\s\S]*?\[\/REQUIREMENTS\]/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (requirements.length > 0) {
    // Populate session state with requirements
    sessionState.requirementsToVerify = requirements;
    console.log("[extractRequirements] Found requirements:", requirements);

    // Auto-verify requirements that are already met based on session data
    autoVerifyRequirements(sessionState);
  }

  return { cleanContent, requirements };
}

// Auto-verify requirements that are already met from session state data
function autoVerifyRequirements(sessionState: SessionState): void {
  const { requirementsToVerify, requirementAnswers } = sessionState;
  if (requirementsToVerify.length === 0) return;

  for (const req of requirementsToVerify) {
    const lower = req.toLowerCase();
    // Already answered — skip
    if (requirementAnswers[req] !== undefined) continue;

    // Duration check
    if (sessionState.duration && (lower.includes("duration") || lower.includes("weeks") || lower.includes("months"))) {
      const reqWeeks = extractWeeksFromText(req);
      const userWeeks = extractWeeksFromText(sessionState.duration);
      if (reqWeeks !== null && userWeeks !== null && userWeeks >= reqWeeks) {
        requirementAnswers[req] = true;
        console.log("[autoVerify] Duration met:", req);
      }
    }

    // Conservative treatment check
    if (sessionState.priorTreatments.length > 0 &&
        (lower.includes("conservative") || lower.includes("treatment") || lower.includes("therapy") || lower.includes("medication"))) {
      requirementAnswers[req] = true;
      console.log("[autoVerify] Treatment met:", req);
    }

    // Prior imaging check
    if (sessionState.priorImagingDone === true &&
        (lower.includes("imaging") || lower.includes("x-ray") || lower.includes("xray") || lower.includes("radiograph"))) {
      requirementAnswers[req] = true;
      console.log("[autoVerify] Prior imaging met:", req);
    }
  }

  // Check if all verified
  const allAnswered = requirementsToVerify.every((r) => requirementAnswers[r] !== undefined);
  if (allAnswered) {
    sessionState.verificationComplete = true;
    sessionState.meetsAllRequirements = requirementsToVerify.every((r) => requirementAnswers[r] === true);
    console.log("[autoVerify] All requirements verified:", sessionState.meetsAllRequirements);
  }
}

// Extract a week count from text like "6 weeks", "3 months", "1 year"
function extractWeeksFromText(text: string): number | null {
  const match = text.match(/(\d+)\s*(week|month|year|day)s?/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  switch (match[2].toLowerCase()) {
    case "day": return num / 7;
    case "week": return num;
    case "month": return num * 4.33;
    case "year": return num * 52;
    default: return null;
  }
}

// Extract [VERIFIED] blocks from Claude's response
// Claude emits these after user answers verification questions
function extractVerificationUpdates(content: string, sessionState: SessionState): string {
  const pattern = /\[VERIFIED\]([\s\S]*?)\[\/VERIFIED\]/gi;
  let match;
  let cleanContent = content;

  while ((match = pattern.exec(content)) !== null) {
    const block = match[1].trim();
    // Format: requirement text|true/false
    const pipeIdx = block.lastIndexOf("|");
    if (pipeIdx === -1) continue;

    const reqText = block.substring(0, pipeIdx).trim();
    const metStr = block.substring(pipeIdx + 1).trim().toLowerCase();
    const met = metStr === "true" || metStr === "yes" || metStr === "met";

    // Fuzzy-match to requirementsToVerify entries
    const bestMatch = sessionState.requirementsToVerify.find((r) => {
      const rLower = r.toLowerCase();
      const reqLower = reqText.toLowerCase();
      return rLower === reqLower ||
        rLower.includes(reqLower) ||
        reqLower.includes(rLower) ||
        // Word overlap: at least 60% of words match
        wordOverlap(rLower, reqLower) >= 0.6;
    });

    if (bestMatch) {
      sessionState.requirementAnswers[bestMatch] = met;
      console.log("[extractVerification] Matched:", bestMatch, "→", met);
    } else {
      console.log("[extractVerification] No match for:", reqText);
    }
  }

  // Remove all [VERIFIED] blocks from content
  cleanContent = cleanContent.replace(/\[VERIFIED\][\s\S]*?\[\/VERIFIED\]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Check if all requirements now answered
  if (sessionState.requirementsToVerify.length > 0) {
    const allAnswered = sessionState.requirementsToVerify.every(
      (r) => sessionState.requirementAnswers[r] !== undefined
    );
    if (allAnswered) {
      sessionState.verificationComplete = true;
      sessionState.meetsAllRequirements = sessionState.requirementsToVerify.every(
        (r) => sessionState.requirementAnswers[r] === true
      );
      console.log("[extractVerification] All verified:", sessionState.meetsAllRequirements);
    }
  }

  return cleanContent;
}

// Calculate word overlap ratio between two strings
function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }
  return overlap / Math.min(wordsA.size, wordsB.size);
}

// Extract [PRIOR_AUTH_LCD] block from Claude's response
// Claude emits this when LCD text indicates prior auth is required
function extractPriorAuthFromLCD(content: string, sessionState: SessionState): string {
  const match = content.match(/\[PRIOR_AUTH_LCD\]\s*(true|false)\s*\[\/PRIOR_AUTH_LCD\]/i);
  if (!match) return content;

  const required = match[1].toLowerCase() === "true";
  if (required) {
    sessionState.priorAuthRequired = true;
    sessionState.priorAuthSource = "lcd";
    console.log("[extractPriorAuthFromLCD] PA required (from LCD)");
  }

  return content
    .replace(/\[PRIOR_AUTH_LCD\][\s\S]*?\[\/PRIOR_AUTH_LCD\]/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Extract suggestions from Claude's response and return cleaned content
// Claude includes suggestions in [SUGGESTIONS]...[/SUGGESTIONS] block
function extractSuggestionsAndClean(content: string, sessionState: SessionState): {
  cleanContent: string;
  suggestions: string[]
} {
  console.log("[extractSuggestions] Parsing content for [SUGGESTIONS] block...");

  // Try to extract [SUGGESTIONS] block (with or without closing tag)
  const suggestionsMatch = content.match(/\[SUGGESTIONS\]\s*([\s\S]*?)\s*\[\/SUGGESTIONS\]/i)
    || content.match(/\[SUGGESTIONS\]\s*([\s\S]+)$/i); // Fallback: unclosed block at end

  if (suggestionsMatch) {
    const suggestionsBlock = suggestionsMatch[1];
    const suggestions = suggestionsBlock
      .split(/\n/)
      .map((line) => line.replace(/^\[\/SUGGESTIONS\].*/i, "").trim()) // Strip any stray closing tag
      .filter((line) => line.length > 0 && line.length < 50);

    // Remove the suggestions block from content (both closed and unclosed forms)
    const cleanContent = content
      .replace(/\[SUGGESTIONS\][\s\S]*?\[\/SUGGESTIONS\]/i, "")
      .replace(/\[SUGGESTIONS\][\s\S]*$/i, "") // Also strip unclosed block at end
      .replace(/---\s*$/m, "") // Remove trailing ---
      .replace(/\n{3,}/g, "\n\n") // Clean up extra newlines
      .trim();

    if (suggestions.length >= 1) {
      console.log("[extractSuggestions] Found suggestions:", suggestions);
      console.log("[extractSuggestions] Clean content length:", cleanContent.length);
      return { cleanContent, suggestions };
    }
  }

  console.log("[extractSuggestions] No [SUGGESTIONS] block found, using question-aware defaults");

  // Question-aware fallback: match suggestions to what Claude ASKED the user
  // This must align with gate-appropriate suggestions from PROMPTING_SKILL
  const lowerContent = content.toLowerCase();
  let suggestions: string[];

  // Onboarding questions
  if (lowerContent.includes("your name") || lowerContent.includes("address you") || lowerContent.includes("call you")) {
    suggestions = ["Just call me...", "Skip this"];
  } else if (lowerContent.includes("your zip") || lowerContent.includes("zip code")) {
    suggestions = ["Let me type it", "Skip for now"];

  // Symptom intake questions
  } else if (lowerContent.includes("which body") || lowerContent.includes("what part") || lowerContent.includes("what body")) {
    suggestions = ["It's my back", "It's my knee"];
  } else if (lowerContent.includes("what's going on") || lowerContent.includes("pain") && lowerContent.includes("numbness")) {
    suggestions = ["It's pain", "It's numbness"];
  } else if (lowerContent.includes("how long") || lowerContent.includes("when did") || lowerContent.includes("how many weeks")) {
    suggestions = ["A few weeks", "Several months"];
  } else if (lowerContent.includes("treatment") || lowerContent.includes("tried") || lowerContent.includes("pt") || lowerContent.includes("physical therapy")) {
    suggestions = ["Yes, I've tried some", "No, nothing yet"];

  // Provider gate questions
  } else if (lowerContent.includes("have a doctor") || lowerContent.includes("your doctor") || lowerContent.includes("who's your")) {
    suggestions = ["Yes, I have a doctor", "Not yet"];
  } else if (lowerContent.includes("which dr") || lowerContent.includes("which doctor")) {
    suggestions = ["The first one", "The second one"];

  // Coverage/guidance delivered
  } else if (lowerContent.includes("denied") || lowerContent.includes("denial")) {
    suggestions = ["Help me appeal", "Explain the denial"];
  } else if (lowerContent.includes("checklist") || lowerContent.includes("document")) {
    suggestions = ["Print this checklist", "Start a new question"];

  // Generic fallback — safe options that don't skip gates
  } else if (lowerContent.includes("help") && lowerContent.includes("?")) {
    suggestions = ["Tell me more", "Start over"];
  } else {
    suggestions = ["Tell me more", "Start over"];
  }

  console.log("[extractSuggestions] Fallback matched:", suggestions);
  return { cleanContent: content, suggestions };
}

// Process tool calls and execute them
async function processToolCalls(
  toolBlocks: ToolUseBlock[],
  toolExecutors: Map<string, ToolExecutor>
): Promise<ToolResultBlockParam[]> {
  const results: ToolResultBlockParam[] = [];

  for (const block of toolBlocks) {
    const executor = toolExecutors.get(block.name);

    if (!executor) {
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify({
          success: false,
          error: `Unknown tool: ${block.name}`,
        }),
        is_error: true,
      });
      continue;
    }

    try {
      const result = await executor(block.input as Record<string, unknown>);
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
        is_error: !result.success,
      });
    } catch (error) {
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }),
        is_error: true,
      });
    }
  }

  return results;
}

// Timeout wrapper for API calls
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs / 1000}s`)), timeoutMs)
    ),
  ]);
}

// Main chat function with tool calling loop
// Uses beta API to access MCP servers for real LCD/NCD data
export async function chat(
  request: ChatRequest,
  toolExecutors: Map<string, ToolExecutor>,
  maxIterations: number = API_CONFIG.claude.maxToolIterations
): Promise<ChatResult> {
  const claude = getClaudeClient();
  const sessionState = request.sessionState ?? createDefaultSessionState();
  const toolsUsed: string[] = [];
  let appealLetter: string | undefined;
  const model = request.modelOverride || API_CONFIG.claude.model;
  // Opus (appeal mode) needs longer timeout — heavy reasoning with tool results
  const isAppealModel = model.includes("opus");
  const timeoutMs = isAppealModel
    ? API_CONFIG.claude.iterationTimeoutMs * 2
    : API_CONFIG.claude.iterationTimeoutMs;

  // Convert our tool definitions to Anthropic format
  const anthropicTools = request.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
  }));

  const messages = [...request.messages];
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    // Appeal mode soft cap: by iteration 4, Claude has denial codes, ICD-10, CPT, coverage, PubMed
    // Force letter generation instead of continuing to search
    if (isAppealModel && iterations === 4) {
      request.systemPrompt += `\n\n## URGENT: Generate Appeal Letter NOW\nYou have completed ${iterations - 1} tool rounds and should have denial codes, diagnosis/procedure codes, coverage policy, and clinical evidence. STOP calling tools. Use generate_appeal_letter NOW with the data you have. Do NOT search for more information.`;
    }

    // General soft cap: warn Claude to wrap up 2 iterations before the hard limit
    if (iterations === maxIterations - 1) {
      request.systemPrompt += `\n\n## URGENT: Approaching Tool Limit\nYou have used ${iterations - 1} of ${maxIterations} tool rounds. STOP calling tools after this round.\nUse the data you already have to respond to the user. Generate your response NOW.`;
    }

    // DEBUG: Log what we're sending to Claude
    console.log("========================================");
    console.log("[CLAUDE API] Iteration:", iterations, "of", maxIterations);
    console.log("[CLAUDE API] Model:", model);
    console.log("[CLAUDE API] Timeout:", timeoutMs / 1000, "s per iteration");
    console.log("[CLAUDE API] MCP Servers:", MCP_SERVERS.map(s => s.name).join(", "));
    console.log("[CLAUDE API] Local tools:", anthropicTools.map(t => t.name).join(", ") || "none");
    console.log("========================================");

    // Call Claude Beta API with MCP servers for direct LCD/NCD access
    // Wrapped in timeout to prevent Vercel 504s
    const response: BetaMessage = await withTimeout(
      claude.beta.messages.create({
        model,
        max_tokens: API_CONFIG.claude.maxTokens,
        system: request.systemPrompt,
        messages,
        tools: anthropicTools.length > 0 ? anthropicTools : undefined,
        mcp_servers: MCP_SERVERS,
        betas: ["mcp-client-2025-04-04"],
      }),
      timeoutMs,
      `Claude API iteration ${iterations}`
    );

    // DEBUG: Log response content block types
    console.log("[CLAUDE API] Response stop_reason:", response.stop_reason);
    console.log("[CLAUDE API] Response content blocks:", response.content.map(b => b.type).join(", "));

    // Check if Claude wants to use LOCAL tools (not MCP tools)
    // MCP tools (mcp_tool_use) are handled automatically by the API
    const toolUseBlocks = response.content.filter(
      (block): block is ToolUseBlock => block.type === "tool_use"
    );

    // Track MCP tool usage with session context for debugging premature calls
    const mcpBlocks = response.content.filter(b => b.type === "mcp_tool_use");
    const mcpToolNames = mcpBlocks.map(b => {
      const mcpBlock = b as { type: "mcp_tool_use"; name?: string; server_name?: string; input?: unknown };
      return mcpBlock.name || "mcp_tool";
    });

    if (mcpBlocks.length > 0) {
      // Log each MCP tool call with context
      for (const block of mcpBlocks) {
        const mcpBlock = block as { type: "mcp_tool_use"; name?: string; server_name?: string; input?: unknown };
        const toolName = mcpBlock.name || "mcp_tool";
        if (!toolsUsed.includes(toolName)) {
          toolsUsed.push(toolName);
        }
        console.log("[CLAUDE API] >>> MCP TOOL CALLED:", toolName, "| server:", mcpBlock.server_name || "unknown");
        console.log("[CLAUDE API] >>> MCP TOOL INPUT:", JSON.stringify(mcpBlock.input || {}).substring(0, 200));
      }
      // Log session context to detect premature MCP calls
      console.log("[CLAUDE API] >>> MCP CALL CONTEXT:", {
        iteration: iterations,
        hasUserName: !!sessionState.userName,
        hasUserZip: !!sessionState.userZip,
        hasSymptoms: sessionState.symptoms.length > 0,
        hasProcedure: !!sessionState.procedureNeeded,
        hasDuration: !!sessionState.duration,
        hasPriorTreatments: sessionState.priorTreatments.length > 0,
        hasProvider: !!sessionState.provider,
        mcpToolsCalled: mcpToolNames,
      });
      // Warn if MCP tools fired during intake (when TOOL_RESTRAINT is active)
      const isInIntakeGate = request.systemPrompt.includes("Do NOT Call Tools Yet");
      if (isInIntakeGate) {
        console.warn("[CLAUDE API] ⚠️ MCP TOOLS FIRED DURING INTAKE — tool restraint active!", {
          mcpToolsCalled: mcpToolNames,
        });
      } else {
        console.log("[CLAUDE API] MCP tools called (post-gate, expected):", mcpToolNames);
      }
    } else {
      console.log("[CLAUDE API] No MCP tools used in this response");
    }

    if (toolUseBlocks.length > 0) {
      console.log("[CLAUDE API] Local tools called:", toolUseBlocks.map(b => b.name).join(", "));
    }

    if (toolUseBlocks.length > 0) {
      // Track which LOCAL tools were used
      toolUseBlocks.forEach((block) => {
        if (!toolsUsed.includes(block.name)) {
          toolsUsed.push(block.name);
        }
      });

      // Execute LOCAL tools only (MCP tools are handled by API)
      const toolResults = await processToolCalls(toolUseBlocks, toolExecutors);

      // Extract data from local tool results into session state
      for (let i = 0; i < toolUseBlocks.length; i++) {
        const resultContent = toolResults[i]?.content;
        if (typeof resultContent === "string") {
          try {
            const parsed = JSON.parse(resultContent) as ToolResult;
            updateSessionFromToolResults(sessionState, toolUseBlocks[i].name, parsed);
            // Capture the formal letter from generate_appeal_letter
            if (toolUseBlocks[i].name === "generate_appeal_letter" && parsed.success) {
              const toolData = parsed.data as { letter?: string } | undefined;
              if (toolData?.letter) {
                appealLetter = toolData.letter;
              }
            }
          } catch {
            // Not valid JSON, skip
          }
        }
      }

      // Add assistant message and tool results to conversation
      messages.push({
        role: "assistant",
        content: response.content as ContentBlock[],
      });
      messages.push({
        role: "user",
        content: toolResults,
      });

      // Continue loop to get Claude's final response
      continue;
    }

    // No tool use - extract text response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    const rawContent = textBlocks.map((block) => block.text).join("\n");

    // Update session state based on response content
    updateSessionState(sessionState, rawContent, toolsUsed);

    // Extraction pipeline: parse structured blocks, update sessionState, clean content
    // 1. Extract [MEDICARE_TYPE] → set medicareType
    const afterMedicare = extractMedicareType(rawContent, sessionState);
    // 2. Extract [REQUIREMENTS] → populate requirementsToVerify + auto-verify
    const { cleanContent: afterReqs } = extractRequirementsAndClean(afterMedicare, sessionState);
    // 3. Extract [VERIFIED] blocks → update requirementAnswers
    const afterVerify = extractVerificationUpdates(afterReqs, sessionState);
    // 4. Extract [PRIOR_AUTH_LCD] → set priorAuthRequired from LCD
    const afterPA = extractPriorAuthFromLCD(afterVerify, sessionState);
    // 5. Extract [SUGGESTIONS] → always last
    const { cleanContent, suggestions } = extractSuggestionsAndClean(afterPA, sessionState);

    console.log("[chat] Raw content length:", rawContent.length);
    console.log("[chat] Clean content length:", cleanContent.length);
    console.log("[chat] Suggestions:", suggestions);

    return {
      content: cleanContent,
      suggestions,
      sessionState,
      toolsUsed,
      appealLetter,
    };
  }

  // Graceful fallback: extract any text from the last assistant message
  // instead of crashing with an error
  console.warn(`[CLAUDE API] Hit max iterations (${maxIterations}). Returning best available content.`);

  // Walk backwards through messages to find the last assistant response with text
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      const textBlocks = (msg.content as ContentBlock[]).filter(
        (block): block is Anthropic.TextBlock => block.type === "text"
      );
      if (textBlocks.length > 0) {
        const partialContent = textBlocks.map((b) => b.text).join("\n");
        updateSessionState(sessionState, partialContent, toolsUsed);
        const afterMedicare = extractMedicareType(partialContent, sessionState);
        const { cleanContent: afterReqs } = extractRequirementsAndClean(afterMedicare, sessionState);
        const afterVerify = extractVerificationUpdates(afterReqs, sessionState);
        const afterPA = extractPriorAuthFromLCD(afterVerify, sessionState);
        const { cleanContent, suggestions } = extractSuggestionsAndClean(afterPA, sessionState);

        return {
          content: cleanContent || "I gathered some information but ran out of processing time. Here's what I have so far — could you try asking again so I can finish?",
          suggestions: suggestions.length > 0 ? suggestions : ["Try again", "Start over"],
          sessionState,
          toolsUsed,
          appealLetter,
        };
      }
    }
  }

  // Absolute last resort: no text found anywhere
  return {
    content: "I wasn't able to complete the lookup in time. Could you try again? If you're appealing a denial, try giving me the denial code directly (like CO-50).",
    suggestions: ["Try again", "Start over"],
    sessionState,
    toolsUsed,
  };
}

// Update session state from local tool results (called during tool loop)
function updateSessionFromToolResults(
  state: SessionState,
  toolName: string,
  toolResult: ToolResult
): void {
  if (!toolResult.success || !toolResult.data) return;
  const data = toolResult.data as Record<string, unknown>;

  switch (toolName) {
    case "search_cpt": {
      // Extract CPT codes from search results
      const codes = data.codes as Array<{ code: string }> | undefined;
      if (codes && codes.length > 0) {
        for (const c of codes) {
          if (!state.procedureCodes.includes(c.code)) {
            state.procedureCodes.push(c.code);
          }
        }
      }
      break;
    }
    case "check_prior_auth": {
      // Extract prior auth requirement
      const requiresAuth = data.commonly_requires_prior_auth as boolean | undefined;
      if (requiresAuth !== undefined) {
        state.priorAuthRequired = requiresAuth;
      }
      // Determine source from tool result
      const source = data.source as string | undefined;
      if (source && requiresAuth) {
        if (source.includes("CMS Prior Authorization Model")) {
          state.priorAuthSource = "cms_model";
        } else {
          state.priorAuthSource = "hardcoded_list";
        }
      }
      break;
    }
    case "lookup_denial_code": {
      // Extract denial codes
      const codeType = data.type as string | undefined;
      const code = data.code as string | undefined;
      if (codeType === "CARC" && code && !state.denialCodes.includes(code)) {
        state.denialCodes.push(code);
      }
      // Also check EOB lookup results
      const results = data.results as Array<{ carc_code?: string }> | undefined;
      if (results) {
        for (const r of results) {
          if (r.carc_code && !state.denialCodes.includes(r.carc_code)) {
            state.denialCodes.push(r.carc_code);
          }
        }
      }
      break;
    }
    case "generate_appeal_letter": {
      // Extract codes from appeal letter generation
      const dxCodes = data.diagnosis_codes as Array<{ code: string }> | undefined;
      const pxCodes = data.procedure_codes as Array<{ code: string }> | undefined;
      if (dxCodes) {
        for (const c of dxCodes) {
          if (!state.diagnosisCodes.includes(c.code)) {
            state.diagnosisCodes.push(c.code);
          }
        }
      }
      if (pxCodes) {
        for (const c of pxCodes) {
          if (!state.procedureCodes.includes(c.code)) {
            state.procedureCodes.push(c.code);
          }
        }
      }
      break;
    }
  }
}

// Update session state based on final response text + tool usage
function updateSessionState(
  state: SessionState,
  content: string,
  toolsUsed: string[]
): void {
  const lowerContent = content.toLowerCase();

  // Detect if guidance was generated
  if (
    lowerContent.includes("checklist") ||
    lowerContent.includes("what the doctor needs") ||
    lowerContent.includes("documentation")
  ) {
    state.guidanceGenerated = true;
  }

  // NOTE: isAppeal is detected from USER messages only (in extractUserInfo),
  // NOT from assistant responses. Assistant coverage guidance often mentions
  // "denial" in denial-prevention context, which would false-positive here.

  // Track tool usage for coverage criteria
  // MCP tool names come from the server: search_local_coverage, search_national_coverage, get_coverage_document
  if (
    toolsUsed.includes("search_local_coverage") ||
    toolsUsed.includes("search_national_coverage") ||
    toolsUsed.includes("get_coverage_document")
  ) {
    if (state.coverageCriteria.length === 0) {
      state.coverageCriteria.push("coverage_checked");
    }
  }

  // Track NPI searches - increment attempt counter
  // MCP tool names: npi_search, npi_lookup
  if (toolsUsed.includes("npi_search") || toolsUsed.includes("npi_lookup")) {
    state.providerSearchAttempts = (state.providerSearchAttempts || 0) + 1;
  }

  // Extract policy references from Claude's text (MCP tool results are summarized by Claude)
  // Match LCD numbers (L + 5 digits) and NCD numbers (NCD + digits)
  const lcdMatches = content.match(/\bL\d{5}\b/g);
  if (lcdMatches) {
    for (const ref of lcdMatches) {
      if (!state.policyReferences.includes(ref)) {
        state.policyReferences.push(ref);
      }
    }
  }
  const ncdMatches = content.match(/\bNCD\s+\d+(?:\.\d+)?/g);
  if (ncdMatches) {
    for (const ref of ncdMatches) {
      if (!state.policyReferences.includes(ref)) {
        state.policyReferences.push(ref);
      }
    }
  }

  // Extract ICD-10 codes from text (MCP search_icd10 results referenced by Claude)
  // Pattern: letter + 2 digits + optional dot + up to 4 alphanumerics
  if (toolsUsed.includes("search_icd10") && state.diagnosisCodes.length === 0) {
    const icd10Matches = content.match(/\b[A-TV-Z]\d{2}(?:\.\d{1,4})?\b/g);
    if (icd10Matches) {
      for (const code of icd10Matches) {
        if (!state.diagnosisCodes.includes(code)) {
          state.diagnosisCodes.push(code);
        }
      }
    }
  }
}

// Parse user messages to extract name, ZIP, etc.
export function extractUserInfo(
  messages: Array<{ role: string; content: string }>,
  currentState: SessionState
): SessionState {
  const updatedState = { ...currentState };

  // Look through user messages
  for (const msg of messages) {
    if (msg.role !== "user") continue;
    const content = msg.content;

    // Extract name (if user responded with just a name or "I'm X" / "call me X")
    if (!updatedState.userName) {
      // Match "I'm John", "call me John", "my name is John", "it's John"
      const namePatterns = content.match(
        /(?:i'm|i am|call me|my name is|it's|this is|name's)\s+([a-zA-Z]{2,20})/i
      );
      if (namePatterns) {
        updatedState.userName = namePatterns[1].charAt(0).toUpperCase() + namePatterns[1].slice(1).toLowerCase();
      } else if (content.trim().length < 25 && /^[a-zA-Z]{2,20}$/i.test(content.trim())) {
        // Short message that's just a name (e.g., "John")
        const name = content.trim();
        updatedState.userName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
      }
    }

    // Extract ZIP code (5 digits)
    const zipMatch = content.match(/\b(\d{5})\b/);
    if (zipMatch && !updatedState.userZip) {
      updatedState.userZip = zipMatch[1];
    }

    // Extract duration patterns
    const durationMatch = content.match(/(\d+)\s*(week|month|year|day)s?/i);
    if (durationMatch && !updatedState.duration) {
      updatedState.duration = `${durationMatch[1]} ${durationMatch[2]}s`;
    }

    // Extract doctor name patterns (Dr. X, Doctor X)
    const doctorMatch = content.match(/(?:dr\.?|doctor)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i);
    if (doctorMatch && !updatedState.providerName) {
      updatedState.providerName = doctorMatch[1];
    }

    // Detect Medicare type from user messages
    if (!updatedState.medicareType) {
      const lower = content.toLowerCase();
      // Medicare Advantage / Part C
      if (/medicare\s*advantage|part\s*c\b|\b(humana|unitedhealth|aetna|cigna|anthem|kaiser|wellcare|centene|molina|devoted|clover|oscar|alignment)\b/i.test(content)) {
        updatedState.medicareType = "advantage";
      }
      // Original Medicare / Fee-for-service
      else if (/original\s*medicare|parts?\s*a\s*(and|&)\s*b|fee.for.service|traditional\s*medicare/i.test(content)) {
        updatedState.medicareType = "original";
      }
      // Supplement / Medigap → maps to original (they have both)
      else if (/medigap|medicare\s*supplement|supplemental?\s*(plan|insurance|coverage)/i.test(lower)) {
        updatedState.medicareType = "original";
      }
    }

    // Detect requirement verification skip
    if (updatedState.requirementsToVerify.length > 0 &&
        !updatedState.verificationComplete &&
        /\b(skip|just show me|move on|don't need|go ahead|show checklist)\b/i.test(content)) {
      updatedState.verificationComplete = true;
      // Leave meetsAllRequirements as null to indicate skipped
      console.log("[extractUserInfo] User skipped requirement verification");
    }

    // Detect appeal intent from USER messages only
    // (not from assistant responses which mention "denial" in prevention context)
    if (!updatedState.isAppeal) {
      if (/\b(appeal|appealing|denied|denial|rejected|refused)\b/i.test(content)) {
        updatedState.isAppeal = true;
      }
    }

    // Extract denial date if in appeal mode
    if (updatedState.isAppeal && !updatedState.denialDate) {
      // Match common date formats: Jan 15, January 15, 1/15/2026, 2026-01-15
      const dateMatch = content.match(
        /(?:denied|denial|rejected).*?(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}(?:,?\s*\d{4})?)/i
      );
      if (dateMatch) {
        updatedState.denialDate = dateMatch[1];
      }
    }
  }

  return updatedState;
}

// Format messages for Claude API
export function formatMessages(
  messages: Array<{ role: "user" | "assistant"; content: string }>
): MessageParam[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}
