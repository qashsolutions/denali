/**
 * Claude API Client
 *
 * Handles communication with Claude API for the chat functionality.
 * Manages tool calling loop and response processing.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Message, MessageParam, ContentBlock, ToolUseBlock, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { API_CONFIG } from "@/config";

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

  // Symptoms
  symptoms: string[];
  duration: string | null;
  severity: string | null;
  priorTreatments: string[];

  // Procedure
  procedureNeeded: string | null;

  // Provider (NPI lookup flow)
  providerName: string | null;       // Doctor name before confirmation
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
  guidanceGenerated: boolean;
  isAppeal: boolean;

  // Requirement verification (denial prevention)
  requirementsToVerify: string[];              // List of requirements to ask about
  requirementAnswers: Record<string, boolean>; // User's answers to requirements
  verificationComplete: boolean;               // All requirements asked
  meetsAllRequirements: boolean | null;        // Final determination

  // Specialty validation
  specialtyMismatchWarning: string | null;     // Warning if provider specialty doesn't match procedure
}

export interface ChatRequest {
  messages: MessageParam[];
  systemPrompt: string;
  tools: ToolDefinition[];
  sessionState?: SessionState;
}

export interface ChatResult {
  content: string;
  suggestions: string[];
  sessionState: SessionState;
  toolsUsed: string[];
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

    // Symptoms
    symptoms: [],
    duration: null,
    severity: null,
    priorTreatments: [],

    // Procedure
    procedureNeeded: null,

    // Provider
    providerName: null,
    provider: null,

    // Internal codes
    diagnosisCodes: [],
    procedureCodes: [],

    // Coverage & guidance
    coverageCriteria: [],
    guidanceGenerated: false,
    isAppeal: false,

    // Requirement verification
    requirementsToVerify: [],
    requirementAnswers: {},
    verificationComplete: false,
    meetsAllRequirements: null,

    // Specialty validation
    specialtyMismatchWarning: null,
  };
}

// Extract suggestions from Claude's response and return cleaned content
// Claude includes suggestions in [SUGGESTIONS]...[/SUGGESTIONS] block
function extractSuggestionsAndClean(content: string, sessionState: SessionState): {
  cleanContent: string;
  suggestions: string[]
} {
  console.log("[extractSuggestions] Parsing content for [SUGGESTIONS] block...");

  // Try to extract [SUGGESTIONS] block
  const suggestionsMatch = content.match(/\[SUGGESTIONS\]\s*([\s\S]*?)\s*\[\/SUGGESTIONS\]/i);

  if (suggestionsMatch) {
    const suggestionsBlock = suggestionsMatch[1];
    const suggestions = suggestionsBlock
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.length < 50);

    // Remove the suggestions block from content
    const cleanContent = content
      .replace(/\[SUGGESTIONS\][\s\S]*?\[\/SUGGESTIONS\]/i, "")
      .replace(/---\s*$/m, "") // Remove trailing ---
      .replace(/\n{3,}/g, "\n\n") // Clean up extra newlines
      .trim();

    if (suggestions.length >= 1) {
      console.log("[extractSuggestions] Found suggestions:", suggestions);
      console.log("[extractSuggestions] Clean content length:", cleanContent.length);
      return { cleanContent, suggestions };
    }
  }

  // Also try old format for backwards compatibility
  const oldPatterns = [
    /---\s*\nwhat would you like to do\??\s*\n((?:[•\-\*]\s*.+\n?)+)/i,
    /what would you like to do\??\s*\n((?:[•\-\*]\s*.+\n?)+)/i,
  ];

  for (const pattern of oldPatterns) {
    const match = content.match(pattern);
    if (match) {
      const bulletSection = match[1];
      const suggestions = bulletSection
        .split(/\n/)
        .map((line) => line.replace(/^[•\-\*]\s*/, "").trim())
        .filter((line) => line.length > 0 && line.length < 50);

      // Remove the old format from content
      const cleanContent = content
        .replace(/---\s*\nwhat would you like to do\?[\s\S]*$/i, "")
        .replace(/what would you like to do\?[\s\S]*$/i, "")
        .trim();

      if (suggestions.length >= 1) {
        console.log("[extractSuggestions] Found old-format suggestions:", suggestions);
        return { cleanContent, suggestions };
      }
    }
  }

  console.log("[extractSuggestions] No suggestions block found, using context-aware defaults");

  // Context-aware fallback suggestions
  const lowerContent = content.toLowerCase();
  let suggestions: string[];

  if (lowerContent.includes("which body") || lowerContent.includes("what part") || lowerContent.includes("what body")) {
    suggestions = ["It's my back", "It's my knee"];
  } else if (lowerContent.includes("mri") || lowerContent.includes("scan")) {
    suggestions = ["Check Medicare coverage", "What body part?"];
  } else if (lowerContent.includes("denied") || lowerContent.includes("denial")) {
    suggestions = ["Help me appeal", "Explain the denial"];
  } else if (lowerContent.includes("document") || lowerContent.includes("checklist")) {
    suggestions = ["Print this checklist", "What if it's denied?"];
  } else if (!sessionState.symptoms.length && !sessionState.procedureNeeded) {
    suggestions = ["Ask about coverage", "Help with a denial"];
  } else {
    suggestions = ["Tell me more", "Start over"];
  }

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

// Main chat function with tool calling loop
export async function chat(
  request: ChatRequest,
  toolExecutors: Map<string, ToolExecutor>,
  maxIterations: number = API_CONFIG.claude.maxToolIterations
): Promise<ChatResult> {
  const claude = getClaudeClient();
  const sessionState = request.sessionState ?? createDefaultSessionState();
  const toolsUsed: string[] = [];

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

    // Call Claude API
    const response: Message = await claude.messages.create({
      model: API_CONFIG.claude.model,
      max_tokens: API_CONFIG.claude.maxTokens,
      system: request.systemPrompt,
      messages,
      tools: anthropicTools.length > 0 ? anthropicTools : undefined,
    });

    // Check if Claude wants to use tools
    const toolUseBlocks = response.content.filter(
      (block): block is ToolUseBlock => block.type === "tool_use"
    );

    if (toolUseBlocks.length > 0) {
      // Track which tools were used
      toolUseBlocks.forEach((block) => {
        if (!toolsUsed.includes(block.name)) {
          toolsUsed.push(block.name);
        }
      });

      // Execute tools
      const toolResults = await processToolCalls(toolUseBlocks, toolExecutors);

      // Add assistant message and tool results to conversation
      messages.push({
        role: "assistant",
        content: response.content,
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

    // Extract suggestions and clean content (remove [SUGGESTIONS] block)
    const { cleanContent, suggestions } = extractSuggestionsAndClean(rawContent, sessionState);

    console.log("[chat] Raw content length:", rawContent.length);
    console.log("[chat] Clean content length:", cleanContent.length);
    console.log("[chat] Suggestions:", suggestions);

    return {
      content: cleanContent,
      suggestions,
      sessionState,
      toolsUsed,
    };
  }

  throw new Error("Max tool calling iterations reached");
}

// Update session state based on conversation
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

  // Detect if this is an appeal conversation
  if (
    lowerContent.includes("appeal") ||
    lowerContent.includes("denied") ||
    lowerContent.includes("denial")
  ) {
    state.isAppeal = true;
  }

  // Track tool usage for coverage criteria
  if (toolsUsed.includes("get_coverage_requirements") || toolsUsed.includes("search_ncd") || toolsUsed.includes("search_lcd")) {
    // Coverage was checked - mark it
    if (state.coverageCriteria.length === 0) {
      state.coverageCriteria.push("coverage_checked");
    }
  }

  // Track NPI searches
  if (toolsUsed.includes("search_npi")) {
    // Provider was searched
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

    // Extract name (if assistant asked and user responded with just a name)
    if (!updatedState.userName && content.length < 30 && /^[a-zA-Z]+$/i.test(content.trim())) {
      // Could be a name - will be confirmed by context
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
