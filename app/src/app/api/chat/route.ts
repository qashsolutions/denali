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

/** Race a promise against a timeout. Returns fallback on timeout instead of throwing. */
function withFallback<T>(promise: Promise<T>, timeoutMs: number, fallback: T, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) =>
      setTimeout(() => {
        console.warn(`[Chat API] ${label} timed out after ${timeoutMs / 1000}s, using fallback`);
        resolve(fallback);
      }, timeoutMs)
    ),
  ]);
}

import { NextRequest, NextResponse } from "next/server";
import {
  chat,
  formatMessages,
  createDefaultSessionState,
  extractUserInfo,
  type SessionState,
} from "@/lib/claude";
import {
  buildSystemPrompt,
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
import { saveAppeal, getUnreportedOutcome } from "@/lib/conversation-service";
import { FEEDBACK_CONFIG, API_CONFIG, PRICING } from "@/config";
import { logAudit } from "@/lib/audit";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createHash } from "crypto";

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
  appealId?: string;
  appealLetter?: string;
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

    // --- Rate limiting: check daily chat usage ---
    const authSupabase = await createServerSupabaseClient();
    const { data: { user: authUser } } = await authSupabase.auth.getUser();

    let chatLimit: number = PRICING.CHAT_LIMITS.ANON; // 3/day for unauthenticated
    let chatIdentifier: string;

    if (authUser) {
      chatIdentifier = authUser.id;

      // Check if paid subscriber (unlimited)
      const { data: profile } = await authSupabase
        .from("users")
        .select("plan")
        .eq("id", authUser.id)
        .single();

      const plan = profile?.plan || "free";
      if (plan === "monthly" || plan === "per_appeal") {
        chatLimit = PRICING.CHAT_LIMITS.PAID; // 0 = unlimited
      } else {
        chatLimit = PRICING.CHAT_LIMITS.AUTH_FREE; // 10/day
      }
    } else {
      // Hash IP for privacy
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || request.headers.get("x-real-ip")
        || "unknown";
      chatIdentifier = `ip:${createHash("sha256").update(ip).digest("hex").slice(0, 16)}`;
    }

    if (chatLimit > 0) {
      const { data: usageResult, error: usageError } = await authSupabase.rpc(
        "check_and_increment_chat",
        { p_identifier: chatIdentifier, p_daily_limit: chatLimit }
      );

      if (usageError) {
        console.warn("[Chat API] Rate limit check failed:", usageError.message);
        // Don't block on rate limit errors — proceed with the request
      } else if (usageResult && !(usageResult as { allowed: boolean; count: number }).allowed) {
        const usage = usageResult as { allowed: boolean; count: number };
        const isAuthed = !!authUser;
        return NextResponse.json(
          {
            error: isAuthed
              ? `You've reached your daily limit of ${chatLimit} messages. Upgrade for unlimited access.`
              : `You've used your ${chatLimit} free messages today. Sign in for more.`,
            code: "RATE_LIMITED",
            limit: chatLimit,
            count: usage.count,
            isAuthenticated: isAuthed,
          },
          { status: 429 }
        );
      }
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

    // Check for unreported outcomes (only on first message of session)
    // 5s timeout: non-critical data, don't let it block the response
    if (body.messages.length <= 2 && sessionState.userName) {
      try {
        const unreported = await withFallback(
          getUnreportedOutcome(body.sessionState?.email ?? null),
          5000, null, "getUnreportedOutcome"
        );
        if (unreported) {
          triggers.hasUnreportedOutcome = true;
          triggers.unreportedAppealId = unreported.appealId;
          triggers.unreportedProcedure = unreported.serviceDescription || undefined;
        }
      } catch (err) {
        console.warn("[Chat API] Failed to check unreported outcomes:", err);
      }
    }

    // Role detection (from session state, set by client from user profile)
    if (body.sessionState?.userRole === "counselor") {
      triggers.isCounselor = true;
    } else if (body.sessionState?.userRole === "provider") {
      triggers.isProvider = true;
    }

    // Populate health context from fhir_cache (cache read only — never calls CMS API)
    // healthDataAvailable, activeCoverage, and recentDenials are set by the client
    // from useHealthData hook data. If the client passes a userId, we can also
    // verify/refresh from cache server-side.
    if (sessionState.healthDataAvailable) {
      triggers.hasHealthData = true;
      triggers.hasRecentDenials = (sessionState.recentDenials?.length ?? 0) > 0;
      triggers.hasRecentChanges = true; // MEDICARE_NOTIFICATIONS_SKILL uses FHIR context to determine what's new
    }

    // Diabetes context detection (from FHIR conditions, labs, or user keywords)
    if (sessionState.conditions?.some(c => ["type1", "type2", "pre-diabetic", "other-diabetes", "obesity"].includes(c.category))) {
      triggers.hasDiabetesContext = true;
    } else if (sessionState.labs && sessionState.labs.length > 0) {
      triggers.hasDiabetesContext = true;
    } else {
      const userContent = body.messages
        .filter((m) => m.role === "user")
        .map((m) => m.content.toLowerCase())
        .join(" ");
      if (/diabetes|diabetic|a1c|hemoglobin a1c|blood sugar|glucose|insulin|pre-?diabetic|mdpp/i.test(userContent)) {
        triggers.hasDiabetesContext = true;
      }
    }

    console.log("[Chat API] Detected triggers:", triggers);

    // Build dynamic system prompt with learning context (async)
    // This injects learned symptom/procedure mappings and successful coverage paths
    // 10s timeout: learning context is additive — base prompt works without it
    const basePrompt = buildSystemPrompt(triggers, sessionState);
    const systemPrompt = await withFallback(
      buildSystemPromptWithLearning(triggers, sessionState, body.messages),
      10_000, basePrompt, "buildSystemPromptWithLearning"
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
      // Create conversation using the authenticated server client (authSupabase).
      // This sets user_id directly at creation time — no client-side claiming needed.
      // The browser client (getClient) has no auth context on the server, so it can
      // only create with user_id=NULL, requiring a separate claim step that often fails.
      const firstUserMsg = body.messages.find((m) => m.role === "user");
      const title = firstUserMsg
        ? firstUserMsg.content.slice(0, 60) + (firstUserMsg.content.length > 60 ? "..." : "")
        : null;
      console.log("[Chat API] Creating new conversation...");

      const { data: newConv, error: convError } = await authSupabase
        .from("conversations")
        .insert({
          user_id: authUser?.id || null,
          is_appeal: result.sessionState.isAppeal || false,
          title: title || null,
          status: "active",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (convError || !newConv) {
        // Fallback: generate UUID but log warning (tracking won't work)
        conversationId = crypto.randomUUID();
        console.warn("[Chat API] Failed to create conversation in DB:", convError?.message);
      } else {
        conversationId = newConv.id;
        console.log("[Chat API] Created conversation:", conversationId, authUser ? "(owned)" : "(anon)");
      }
    }

    // Persist learning from successful tool use (non-blocking)
    if (result.toolsUsed.length > 0) {
      persistLearning(entities, result.sessionState, result.toolsUsed).catch(
        (err) => console.warn("Failed to persist learning:", err)
      );
    }

    // Persist appeal if generate_appeal_letter was used
    let appealId: string | undefined;
    if (result.toolsUsed.includes("generate_appeal_letter") && conversationId) {
      const ss = result.sessionState;
      // Separate LCD and NCD policy references
      const lcdRefs = ss.policyReferences.filter((r) => r.startsWith("L"));
      const ncdRefs = ss.policyReferences.filter((r) => r.startsWith("NCD"));
      try {
        const savedAppealId = await saveAppeal(conversationId, "", {
          appealLetter: result.appealLetter || result.content,
          denialReason: ss.denialCodes.length > 0 ? `CARC ${ss.denialCodes.join(", ")}` : undefined,
          denialDate: ss.denialDate || undefined,
          icd10Codes: ss.diagnosisCodes.length > 0 ? ss.diagnosisCodes : undefined,
          cptCodes: ss.procedureCodes.length > 0 ? ss.procedureCodes : undefined,
          lcdRefs: lcdRefs.length > 0 ? lcdRefs : undefined,
          ncdRefs: ncdRefs.length > 0 ? ncdRefs : undefined,
        });
        if (savedAppealId) {
          appealId = savedAppealId;
          console.log("[Chat API] Appeal saved:", appealId);
          logAudit("APPEAL_GENERATED", {
            userId: body.sessionState?.email ? undefined : undefined,
            resourceType: "appeal",
            resourceId: savedAppealId,
            metadata: { conversationId, denialCodes: ss.denialCodes },
            request,
          }).catch(() => {});
        }
      } catch (err) {
        console.warn("Failed to save appeal:", err);
      }
    }

    // Build response
    const response: ChatResponseBody = {
      content: result.content,
      suggestions: result.suggestions,
      conversationId,
      sessionState: result.sessionState,
      toolsUsed: result.toolsUsed,
      appealId,
      appealLetter: result.appealLetter,
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
