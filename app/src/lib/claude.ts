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
function extractSuggestions(content: string, sessionState: SessionState): string[] {
  // Default suggestions based on session state
  if (!sessionState.symptoms.length && !sessionState.procedureNeeded) {
    return ["Ask about coverage", "Help with a denial"];
  }

  if (sessionState.symptoms.length && !sessionState.procedureNeeded) {
    return ["What treatment is needed?", "Check Medicare coverage"];
  }

  if (sessionState.procedureNeeded && !sessionState.guidanceGenerated) {
    return ["Check Medicare coverage", "What should the doctor document?"];
  }

  if (sessionState.guidanceGenerated) {
    return ["Print this checklist", "Email to me", "What if it's denied?"];
  }

  if (sessionState.isAppeal) {
    return ["Print letter", "Download PDF", "Start a new question"];
  }

  return ["New question"];
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
