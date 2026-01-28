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
  symptoms: string[];
  duration: string | null;
  severity: string | null;
  priorTreatments: string[];
  procedureNeeded: string | null;
  provider: {
    name: string | null;
    npi: string | null;
    specialty: string | null;
  } | null;
  diagnosisCodes: string[]; // Internal only - never show to user
  procedureCodes: string[]; // Internal only - never show to user
  coverageCriteria: string[];
  guidanceGenerated: boolean;
  isAppeal: boolean;
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
    symptoms: [],
    duration: null,
    severity: null,
    priorTreatments: [],
    procedureNeeded: null,
    provider: null,
    diagnosisCodes: [],
    procedureCodes: [],
    coverageCriteria: [],
    guidanceGenerated: false,
    isAppeal: false,
  };
}

// Extract suggestions from Claude's response
// Claude should include suggestions at the end in format:
// ---
// What would you like to do?
// • Suggestion one
// • Suggestion two
function extractSuggestions(content: string, sessionState: SessionState): string[] {
  console.log("[extractSuggestions] Parsing content for suggestions...");

  // Try to extract suggestions from Claude's response
  // Look for bullet points after "What would you like to do?" or similar
  const suggestionPatterns = [
    /what would you like to do\??\s*\n((?:[•\-\*]\s*.+\n?)+)/i,
    /here are some options:?\s*\n((?:[•\-\*]\s*.+\n?)+)/i,
    /you could:?\s*\n((?:[•\-\*]\s*.+\n?)+)/i,
    /next steps:?\s*\n((?:[•\-\*]\s*.+\n?)+)/i,
  ];

  for (const pattern of suggestionPatterns) {
    const match = content.match(pattern);
    if (match) {
      const bulletSection = match[1];
      const suggestions = bulletSection
        .split(/\n/)
        .map((line) => line.replace(/^[•\-\*]\s*/, "").trim())
        .filter((line) => line.length > 0 && line.length < 60); // Keep short, valid suggestions

      if (suggestions.length >= 1 && suggestions.length <= 4) {
        console.log("[extractSuggestions] Found dynamic suggestions:", suggestions);
        return suggestions;
      }
    }
  }

  console.log("[extractSuggestions] No dynamic suggestions found, using context-aware defaults");

  // Context-aware fallback suggestions based on session state and content
  const lowerContent = content.toLowerCase();

  // Check for specific content patterns to generate relevant suggestions
  if (lowerContent.includes("mri") || lowerContent.includes("scan") || lowerContent.includes("imaging")) {
    if (!sessionState.guidanceGenerated) {
      return ["What body part is the scan for?", "Check if Medicare covers this"];
    }
  }

  if (lowerContent.includes("denied") || lowerContent.includes("denial") || lowerContent.includes("appeal")) {
    return ["Help me write an appeal", "What was the denial reason?"];
  }

  if (lowerContent.includes("checklist") || lowerContent.includes("documentation")) {
    return ["Print this checklist", "Email to myself", "Ask another question"];
  }

  if (lowerContent.includes("what part") || lowerContent.includes("which body")) {
    return ["Tell me about your symptoms", "Ask about a specific body part"];
  }

  // Default fallback based on session state
  if (!sessionState.symptoms.length && !sessionState.procedureNeeded) {
    return ["Ask about coverage", "Help with a denial"];
  }

  if (sessionState.symptoms.length && !sessionState.procedureNeeded) {
    return ["What treatment might I need?", "Check Medicare coverage"];
  }

  if (sessionState.procedureNeeded && !sessionState.guidanceGenerated) {
    return ["Check Medicare coverage", "What documentation is needed?"];
  }

  if (sessionState.guidanceGenerated) {
    return ["Print this checklist", "What if it gets denied?"];
  }

  if (sessionState.isAppeal) {
    return ["Print letter", "Download PDF", "Start new question"];
  }

  return ["Ask another question"];
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

  let messages = [...request.messages];
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
    const content = textBlocks.map((block) => block.text).join("\n");

    // Update session state based on response content
    updateSessionState(sessionState, content, toolsUsed);

    // Generate suggestions
    const suggestions = extractSuggestions(content, sessionState);

    return {
      content,
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
  if (toolsUsed.includes("search_coverage")) {
    // Coverage was checked
  }
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
