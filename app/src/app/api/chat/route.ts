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
import { getUploadLimitForPlan, formatFileSize } from "@/config/pricing";
import { logAudit } from "@/lib/audit";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createHash } from "crypto";
import type { FileAttachment } from "@/types/attachment";
import { ALLOWED_MEDIA_TYPES } from "@/types/attachment";

// Request body type
interface ChatRequestBody {
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  conversationId?: string;
  sessionState?: SessionState;
  attachment?: FileAttachment;
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
    let userProfile: { plan: string | null; is_admin: boolean | null } | null = null;

    if (authUser) {
      chatIdentifier = authUser.id;

      // Fetch profile once — reused for rate limiting AND attachment validation
      const { data: profile } = await authSupabase
        .from("users")
        .select("plan, is_admin")
        .eq("id", authUser.id)
        .single();
      userProfile = profile;

      if (profile?.is_admin) {
        chatLimit = 0; // Admin: unlimited
      } else {
        const plan = profile?.plan || "free";
        if (plan === "monthly" || plan === "per_appeal") {
          chatLimit = PRICING.CHAT_LIMITS.PAID; // 0 = unlimited
        } else {
          chatLimit = PRICING.CHAT_LIMITS.AUTH_FREE; // 10/day
        }
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

    // --- Attachment validation ---
    let attachment: FileAttachment | undefined;
    if (body.attachment) {
      // Must be authenticated to upload files
      if (!authUser) {
        return NextResponse.json(
          { error: "Sign in to upload files." },
          { status: 401 }
        );
      }

      // Validate media type
      if (!ALLOWED_MEDIA_TYPES.includes(body.attachment.mediaType)) {
        return NextResponse.json(
          { error: "Only PDF, PNG, and JPEG files are supported." },
          { status: 400 }
        );
      }

      // Validate base64 data present
      if (!body.attachment.base64Data) {
        return NextResponse.json(
          { error: "File data is missing." },
          { status: 400 }
        );
      }

      // Check size against plan limit (reuse profile fetched for rate limiting)
      const userPlan = userProfile?.plan || "free";
      const userIsAdmin = userProfile?.is_admin || false;
      const uploadLimit = getUploadLimitForPlan(userPlan, userIsAdmin, true);

      // uploadLimit 0 for admin = unlimited
      if (uploadLimit > 0 && body.attachment.sizeBytes > uploadLimit) {
        return NextResponse.json(
          { error: `File exceeds your ${formatFileSize(uploadLimit)} upload limit.` },
          { status: 413 }
        );
      }

      attachment = body.attachment;
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

    // Format messages for Claude API (with optional multimodal attachment)
    // Strip [Attached: ...] markers from text sent to Claude — Claude gets the actual
    // file via multimodal blocks, so the marker is redundant. DB saves keep the marker.
    const claudeMessages = attachment
      ? body.messages.map((msg, idx) =>
          idx === body.messages.length - 1 && msg.role === "user"
            ? { ...msg, content: msg.content.replace(/\n?\n?\[Attached: .+?\]/, "").trim() }
            : msg
        )
      : body.messages;
    const formattedMessages = formatMessages(claudeMessages, attachment);

    // --- Streaming SSE response ---
    // Create SSE stream for real-time text delivery to client.
    // Claude's tool iterations happen server-side; only the final text response streams.
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    const writeSSE = (event: string, data: unknown) => {
      writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)).catch(() => {});
    };

    // Start async chat processing (runs after Response is returned)
    const modelOverride = sessionState.isAppeal
      ? API_CONFIG.claude.appealModel
      : undefined;
    console.log("[Chat API] Starting streaming response...", modelOverride ? `(appeal mode: ${modelOverride})` : "");

    (async () => {
      try {
        const result = await chat(
          {
            messages: formattedMessages,
            systemPrompt,
            tools: toolDefinitions,
            sessionState,
            modelOverride,
          },
          toolExecutors,
          undefined, // maxIterations (use default)
          {
            onDelta: (text) => writeSSE("delta", { text }),
            onToolProgress: (name) => writeSSE("tool", { name }),
          }
        );
        console.log("[Chat API] Claude response received:");
        console.log("[Chat API] - Tools used:", result.toolsUsed);
        console.log("[Chat API] - Content preview:", result.content.substring(0, 200) + "...");

        // Get or create conversation ID
        let conversationId = body.conversationId;
        let isNewConversation = false;

        if (!conversationId) {
          isNewConversation = true;
          const firstUserMsg = body.messages.find((m) => m.role === "user");
          const title = firstUserMsg
            ? firstUserMsg.content.slice(0, 60) + (firstUserMsg.content.length > 60 ? "..." : "")
            : null;

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
            conversationId = crypto.randomUUID();
            console.warn("[Chat API] Failed to create conversation in DB:", convError?.message);
          } else {
            conversationId = newConv.id;
            console.log("[Chat API] Created conversation:", conversationId, authUser ? "(owned)" : "(anon)");
          }
        }

        // Save messages (fire-and-forget)
        const lastUserMsg = body.messages[body.messages.length - 1];
        if (conversationId && lastUserMsg) {
          authSupabase
            .from("messages")
            .insert([
              { conversation_id: conversationId, role: lastUserMsg.role, content: lastUserMsg.content },
              { conversation_id: conversationId, role: "assistant", content: result.content },
            ])
            .then(({ error: msgErr }) => {
              if (msgErr) console.warn("[Chat API] Failed to save messages:", msgErr.message);
              else if (isNewConversation) console.log("[Chat API] Messages saved for conversation:", conversationId);
            });
        }

        // Persist learning (non-blocking)
        if (result.toolsUsed.length > 0) {
          persistLearning(entities, result.sessionState, result.toolsUsed).catch(
            (err) => console.warn("Failed to persist learning:", err)
          );
        }

        // Persist appeal if generate_appeal_letter was used
        let appealId: string | undefined;
        if (result.toolsUsed.includes("generate_appeal_letter") && conversationId) {
          const ss = result.sessionState;
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
                userId: authUser?.id,
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

        // Send metadata as final SSE event (client replaces streaming text with clean content)
        writeSSE("done", {
          content: result.content,
          suggestions: result.suggestions,
          conversationId,
          sessionState: result.sessionState,
          toolsUsed: result.toolsUsed,
          appealId,
          appealLetter: result.appealLetter,
        } satisfies ChatResponseBody);

        console.log("[Chat API] Stream complete with", result.suggestions.length, "suggestions");
        await writer.close();
      } catch (error) {
        console.error("[Chat API] Stream error:", error);
        const message = error instanceof Error ? error.message : "An error occurred";
        writeSSE("error", { error: message });
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error("Chat API error (pre-stream):", error);

    // Pre-stream errors (validation, rate limiting) return JSON with proper status codes
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return NextResponse.json(
          { error: "API configuration error" },
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
