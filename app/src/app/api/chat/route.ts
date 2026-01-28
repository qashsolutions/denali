/**
 * Chat API Route
 *
 * POST /api/chat
 *
 * Handles chat messages by:
 * 1. Loading relevant skills based on conversation context
 * 2. Calling Claude API with tool definitions
 * 3. Executing tool calls as needed
 * 4. Returning structured response with suggestions
 */

import { NextRequest, NextResponse } from "next/server";
import {
  chat,
  formatMessages,
  createDefaultSessionState,
  type SessionState,
} from "@/lib/claude";
import { buildSystemPrompt, detectTriggers } from "@/lib/skills-loader";
import { getToolDefinitions, createToolExecutorMap } from "@/lib/tools";

// Request body type
interface ChatRequestBody {
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  conversationId?: string;
  sessionState?: SessionState;
}

// Response type
interface ChatResponseBody {
  content: string;
  suggestions: string[];
  conversationId: string;
  sessionState: SessionState;
  toolsUsed: string[];
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: ChatRequestBody = await request.json();

    // Validate request
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Initialize or restore session state
    const sessionState = body.sessionState ?? createDefaultSessionState();

    // Detect triggers based on conversation content
    const triggers = detectTriggers(body.messages, sessionState);

    // Build dynamic system prompt based on triggers
    const systemPrompt = buildSystemPrompt(triggers, sessionState);

    // Get tool definitions and create executor map
    const toolDefinitions = getToolDefinitions();
    const toolExecutors = createToolExecutorMap();

    // Format messages for Claude API
    const formattedMessages = formatMessages(body.messages);

    // Call Claude with tools
    const result = await chat(
      {
        messages: formattedMessages,
        systemPrompt,
        tools: toolDefinitions,
        sessionState,
      },
      toolExecutors
    );

    // Generate conversation ID if not provided
    const conversationId = body.conversationId ?? `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Build response
    const response: ChatResponseBody = {
      content: result.content,
      suggestions: result.suggestions,
      conversationId,
      sessionState: result.sessionState,
      toolsUsed: result.toolsUsed,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Chat API error:", error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return NextResponse.json(
          { error: "API configuration error" },
          { status: 500 }
        );
      }

      if (error.message.includes("rate limit")) {
        return NextResponse.json(
          { error: "Service is temporarily busy. Please try again in a moment." },
          { status: 429 }
        );
      }

      if (error.message.includes("Max tool calling iterations")) {
        return NextResponse.json(
          { error: "Request took too long to process. Please try again." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "An error occurred processing your message. Please try again." },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    hasApiKey: !!process.env.ANTHROPIC_API_KEY,
    timestamp: new Date().toISOString(),
  });
}
