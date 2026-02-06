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

// Max execution time for this route (seconds)
// Pro plan max is 300s. Our per-iteration timeout (60s) handles graceful failure.
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import {
  chat,
  formatMessages,
  createDefaultSessionState,
  extractUserInfo,
  type SessionState,
} from "@/lib/claude";
import {
  buildSystemPromptWithLearning,
  detectTriggers,
  extractEntitiesFromMessages,
} from "@/lib/skills-loader";
import { getToolDefinitions, createToolExecutorMap } from "@/lib/tools";
import {
  updateSymptomMapping,
  updateProcedureMapping,
  queueLearningJob,
  recordCoveragePath,
  type ExtractedEntities,
} from "@/lib/learning";
import { createConversation } from "@/lib/conversation-service";
import { FEEDBACK_CONFIG, API_CONFIG } from "@/config";

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
    console.log("[Chat API] Received request with", body.messages?.length, "messages");

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
    let sessionState = body.sessionState ?? createDefaultSessionState();

    // Extract user info (name, ZIP, etc.) from messages
    sessionState = extractUserInfo(body.messages, sessionState);
    console.log("[Chat API] User info extracted:", {
      userName: sessionState.userName,
      userZip: sessionState.userZip,
      providerName: sessionState.providerName,
      duration: sessionState.duration,
    });

    // Detect triggers based on conversation content
    const triggers = detectTriggers(body.messages, sessionState);
    console.log("[Chat API] Detected triggers:", triggers);

    // Build dynamic system prompt with learning context (async)
    // This injects learned symptom/procedure mappings and successful coverage paths
    const systemPrompt = await buildSystemPromptWithLearning(
      triggers,
      sessionState,
      body.messages
    );
    console.log("[Chat API] System prompt length:", systemPrompt.length);

    // Get tool definitions and create executor map
    const toolDefinitions = getToolDefinitions();
    const toolExecutors = createToolExecutorMap();
    console.log("[Chat API] Available tools:", toolDefinitions.map(t => t.name));

    // Extract entities for learning (async, non-blocking)
    const entities = extractEntitiesFromMessages(body.messages);
    console.log("[Chat API] Extracted entities:", {
      symptoms: entities.symptoms.length,
      procedures: entities.procedures.length,
      medications: entities.medications.length,
      providers: entities.providers.length,
    });

    if (entities.symptoms.length > 0 || entities.procedures.length > 0) {
      // Queue learning job for background processing
      queueLearningJob("extract_entities", {
        symptoms: entities.symptoms,
        procedures: entities.procedures,
        medications: entities.medications,
        providers: entities.providers,
        conversationId: body.conversationId,
      }).catch((err) => console.warn("Failed to queue learning job:", err));
    }

    // Format messages for Claude API
    const formattedMessages = formatMessages(body.messages);

    // Call Claude with tools
    // Use Opus for appeals (higher quality), Sonnet for chat (faster)
    const modelOverride = sessionState.isAppeal
      ? API_CONFIG.claude.appealModel
      : undefined;
    console.log("[Chat API] Calling Claude API...", modelOverride ? `(appeal mode: ${modelOverride})` : "");
    const result = await chat(
      {
        messages: formattedMessages,
        systemPrompt,
        tools: toolDefinitions,
        sessionState,
        modelOverride,
      },
      toolExecutors
    );
    console.log("[Chat API] Claude response received:");
    console.log("[Chat API] - Tools used:", result.toolsUsed);
    console.log("[Chat API] - Suggestions:", result.suggestions);
    console.log("[Chat API] - Content preview:", result.content.substring(0, 200) + "...");
    console.log("[Chat API] - Session state:", {
      userName: result.sessionState.userName,
      userZip: result.sessionState.userZip,
      symptoms: result.sessionState.symptoms,
      duration: result.sessionState.duration,
      priorTreatments: result.sessionState.priorTreatments,
      procedureNeeded: result.sessionState.procedureNeeded,
      providerName: result.sessionState.providerName,
      provider: result.sessionState.provider,
      guidanceGenerated: result.sessionState.guidanceGenerated,
      isAppeal: result.sessionState.isAppeal,
    });

    // Get or create conversation ID
    let conversationId = body.conversationId;

    if (!conversationId) {
      // Create new conversation in database (required for FK constraints)
      console.log("[Chat API] Creating new conversation...");
      const newConvId = await createConversation({
        isAppeal: result.sessionState.isAppeal,
      });

      if (newConvId) {
        conversationId = newConvId;
        console.log("[Chat API] Created conversation:", conversationId);
      } else {
        // Fallback: generate UUID but log warning (tracking won't work)
        conversationId = crypto.randomUUID();
        console.warn("[Chat API] Failed to create conversation in DB, using local UUID:", conversationId);
      }
    }

    // Persist learning from successful tool use (non-blocking)
    if (result.toolsUsed.length > 0) {
      persistLearning(entities, result.sessionState, result.toolsUsed).catch(
        (err) => console.warn("Failed to persist learning:", err)
      );
    }

    // Build response
    const response: ChatResponseBody = {
      content: result.content,
      suggestions: result.suggestions,
      conversationId,
      sessionState: result.sessionState,
      toolsUsed: result.toolsUsed,
    };

    console.log("[Chat API] Sending response with", response.suggestions.length, "suggestions");
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

      if (error.message.includes("timed out")) {
        return NextResponse.json(
          { error: "This is taking longer than usual. Please try again — it usually works on the second try." },
          { status: 504 }
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

/**
 * Persist learning from successful tool use
 * Updates symptom/procedure mappings when codes are found
 */
async function persistLearning(
  entities: ExtractedEntities,
  sessionState: SessionState,
  toolsUsed: string[]
): Promise<void> {
  const boost = FEEDBACK_CONFIG.toolSuccessBoost;

  // If ICD-10 search was used and we have diagnosis codes, update symptom mappings
  if (
    toolsUsed.includes("search_icd10") &&
    sessionState.diagnosisCodes.length > 0 &&
    entities.symptoms.length > 0
  ) {
    for (const symptom of entities.symptoms) {
      for (const code of sessionState.diagnosisCodes) {
        await updateSymptomMapping(
          symptom.phrase,
          code,
          "", // Description will be looked up by the function
          boost
        );
      }
    }
  }

  // If CPT search was used and we have procedure codes, update procedure mappings
  if (
    toolsUsed.includes("search_cpt") &&
    sessionState.procedureCodes.length > 0 &&
    entities.procedures.length > 0
  ) {
    for (const procedure of entities.procedures) {
      for (const code of sessionState.procedureCodes) {
        await updateProcedureMapping(
          procedure.phrase,
          code,
          "", // Description will be looked up by the function
          boost
        );
      }
    }
  }

  // If coverage was checked, record the coverage path
  // MCP tool names: search_national_coverage, search_local_coverage
  if (
    (toolsUsed.includes("search_national_coverage") || toolsUsed.includes("search_local_coverage")) &&
    sessionState.diagnosisCodes.length > 0 &&
    sessionState.procedureCodes.length > 0
  ) {
    // Record coverage path for the first dx/px combination
    await recordCoveragePath(
      sessionState.diagnosisCodes[0],
      sessionState.procedureCodes[0],
      {}, // Policy refs would come from tool results
      "pending", // Outcome unknown until user reports
      sessionState.coverageCriteria
    );
  }
}
