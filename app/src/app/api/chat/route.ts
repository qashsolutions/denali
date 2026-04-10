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
function withFallback<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
  label: string,
): Promise<T> {
  const start = Date.now();
  return Promise.race([
    promise.then((result) => {
      logFallbackMetric({
        label,
        timeoutMs,
        fired: false,
        actualMs: Date.now() - start,
      });
      return result;
    }),
    new Promise<T>((resolve) =>
      setTimeout(() => {
        console.warn(
          `[Chat API] ${label} timed out after ${timeoutMs / 1000}s, using fallback`,
        );
        logFallbackMetric({
          label,
          timeoutMs,
          fired: true,
          actualMs: timeoutMs,
        });
        resolve(fallback);
      }, timeoutMs),
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
import { logClaudeMetric, logFallbackMetric } from "@/lib/metrics/logger";
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
import { saveAppeal, getUnreportedOutcome } from "@/lib/conversation-server";
import { FEEDBACK_CONFIG, API_CONFIG, PRICING } from "@/config";
import { getUploadLimitForPlan, formatFileSize } from "@/config/pricing";
import { VALIDATION, RATE_LIMITS, SYSTEM } from "@/config/messages";
import { logAudit } from "@/lib/audit";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
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
    console.log(
      "[Chat API] Received request with",
      body.messages?.length,
      "messages",
    );

    // Validate request
    if (
      !body.messages ||
      !Array.isArray(body.messages) ||
      body.messages.length === 0
    ) {
      return NextResponse.json(
        { error: VALIDATION.MESSAGES_REQUIRED },
        { status: 400 },
      );
    }

    // --- Auth required: sign-in enforced for all chat ---
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json(
        {
          error: RATE_LIMITS.TRIAL_REQUIRED,
          code: "AUTH_REQUIRED",
        },
        { status: 401 },
      );
    }

    let chatLimit: number = PRICING.CHAT_LIMITS.TRIAL;
    let weeklyLimit: number = PRICING.WEEKLY_LIMITS.TRIAL;
    const chatIdentifier: string = authUser.userId;
    let userProfile: {
      plan: string | null;
      is_admin: boolean | null;
      role: string | null;
    } | null = null;

    // Fetch profile once — reused for rate limiting, attachment validation, AND role verification
    // Wrapped in withFallback so a transient RDS outage doesn't block chat entirely.
    // Falls back to trial-level defaults (most restrictive) if the query fails.
    const profileResult = await withFallback(
      query<{
        plan: string | null;
        is_admin: boolean | null;
        role: string | null;
      }>(`SELECT plan, is_admin, role FROM users WHERE id = $1 LIMIT 1`, [
        authUser.userId,
      ]),
      5000,
      {
        rows: [],
        rowCount: 0,
        command: "",
        oid: 0,
        fields: [],
      } as unknown as import("pg").QueryResult<{
        plan: string | null;
        is_admin: boolean | null;
        role: string | null;
      }>,
      "profile lookup",
    );
    userProfile = profileResult.rows[0] ?? null;

    if (userProfile?.is_admin) {
      chatLimit = 0; // Admin: unlimited
      weeklyLimit = 0;
    } else {
      const plan = userProfile?.plan || "trial";
      if (plan === "unlimited") {
        chatLimit = PRICING.CHAT_LIMITS.UNLIMITED;
        weeklyLimit = PRICING.WEEKLY_LIMITS.UNLIMITED;
      } else if (plan === "plus") {
        chatLimit = PRICING.CHAT_LIMITS.PLUS;
        weeklyLimit = PRICING.WEEKLY_LIMITS.PLUS;
      } else if (plan === "starter") {
        chatLimit = PRICING.CHAT_LIMITS.STARTER;
        weeklyLimit = PRICING.WEEKLY_LIMITS.STARTER;
      } else if (plan === "trial") {
        // Check trial expiry
        const subResult = await query<{ trial_end: string | null }>(
          `SELECT trial_end FROM subscriptions WHERE user_id = $1 LIMIT 1`,
          [authUser.userId],
        );
        const trialEnd = subResult.rows[0]?.trial_end
          ? new Date(subResult.rows[0].trial_end)
          : null;
        if (trialEnd && trialEnd > new Date()) {
          chatLimit = PRICING.CHAT_LIMITS.TRIAL;
          weeklyLimit = PRICING.WEEKLY_LIMITS.TRIAL;
        } else if (!subResult.rows[0]) {
          // No subscription row — trial POST in verify-otp must have failed. Auto-create.
          console.warn(
            "[Chat] No subscription row for trial user",
            authUser.userId,
            "— auto-creating trial",
          );
          const now = new Date();
          const end = new Date(now);
          end.setDate(end.getDate() + PRICING.TRIAL_DURATION_DAYS);
          await query(
            `INSERT INTO subscriptions (user_id, plan, status, trial_start, trial_end, trial_converted)
             VALUES ($1, 'trial', 'trialing', $2, $3, false)
             ON CONFLICT (user_id) DO NOTHING`,
            [authUser.userId, now.toISOString(), end.toISOString()],
          );
          chatLimit = PRICING.CHAT_LIMITS.TRIAL;
          weeklyLimit = PRICING.WEEKLY_LIMITS.TRIAL;
        } else {
          // Trial expired — locked out
          return NextResponse.json(
            {
              error: RATE_LIMITS.TRIAL_EXPIRED,
              code: "TRIAL_EXPIRED",
              upsell: true,
            },
            { status: 403 },
          );
        }
      } else {
        // Unknown plan — locked out
        return NextResponse.json(
          {
            error: "Your free trial has ended. Upgrade to keep using Denali.",
            code: "TRIAL_EXPIRED",
            upsell: true,
          },
          { status: 403 },
        );
      }
    }

    // --- Weekly frequency check ---
    if (weeklyLimit > 0) {
      try {
        const weeklyResult = await query<{
          allowed: boolean;
          days_used: number;
        }>(`SELECT * FROM check_weekly_frequency($1, $2)`, [
          chatIdentifier,
          weeklyLimit,
        ]);
        const weekly = weeklyResult.rows[0];
        if (weekly && !weekly.allowed) {
          return NextResponse.json(
            {
              error: RATE_LIMITS.WEEKLY_LIMIT(weeklyLimit),
              code: "WEEKLY_LIMIT",
              weeklyLimit,
              daysUsed: weekly.days_used,
            },
            { status: 429 },
          );
        }
      } catch (weeklyError) {
        console.warn("[Chat API] Weekly frequency check failed:", weeklyError);
      }
    }

    // --- Daily message limit check ---
    if (chatLimit > 0) {
      try {
        const usageResult = await query<{ allowed: boolean; count: number }>(
          `SELECT * FROM check_and_increment_chat($1, $2)`,
          [chatIdentifier, chatLimit],
        );
        const usageRow = usageResult.rows[0];
        if (usageRow && !usageRow.allowed) {
          return NextResponse.json(
            {
              error: RATE_LIMITS.DAILY_LIMIT(chatLimit),
              code: "RATE_LIMITED",
              limit: chatLimit,
              count: usageRow.count,
            },
            { status: 429 },
          );
        }
      } catch (usageError) {
        console.warn("[Chat API] Rate limit check failed:", usageError);
        // Don't block on rate limit errors — proceed with the request
      }
    }

    // --- Attachment validation ---
    let attachment: FileAttachment | undefined;
    if (body.attachment) {
      // Validate media type
      if (!ALLOWED_MEDIA_TYPES.includes(body.attachment.mediaType)) {
        return NextResponse.json(
          { error: VALIDATION.FILE_TYPE_UNSUPPORTED },
          { status: 400 },
        );
      }

      // Validate base64 data present
      if (!body.attachment.base64Data) {
        return NextResponse.json(
          { error: VALIDATION.FILE_READ_FAILED },
          { status: 400 },
        );
      }

      // Check size against plan limit (reuse profile fetched for rate limiting)
      const userPlan = userProfile?.plan || "trial";
      const userIsAdmin = userProfile?.is_admin || false;
      const uploadLimit = getUploadLimitForPlan(userPlan, userIsAdmin, true);

      // uploadLimit 0 for admin = unlimited
      if (uploadLimit > 0 && body.attachment.sizeBytes > uploadLimit) {
        return NextResponse.json(
          { error: VALIDATION.FILE_TOO_LARGE(formatFileSize(uploadLimit)) },
          { status: 413 },
        );
      }

      attachment = body.attachment;
    }

    // Initialize or restore session state
    let sessionState = body.sessionState ?? createDefaultSessionState();

    // Extract user info (name, ZIP, etc.) from messages
    sessionState = extractUserInfo(body.messages, sessionState);
    console.log("[Chat API] User info extracted:", {
      hasName: !!sessionState.userName,
      hasZip: !!sessionState.userZip,
      hasProvider: !!sessionState.providerName,
      hasDuration: !!sessionState.duration,
    });

    // Detect triggers based on conversation content
    const triggers = detectTriggers(body.messages, sessionState);

    // Check for unreported outcomes (only on first message of session)
    // 5s timeout: non-critical data, don't let it block the response
    if (body.messages.length <= 2 && sessionState.userName) {
      try {
        const unreported = await withFallback(
          getUnreportedOutcome(body.sessionState?.email ?? null),
          5000,
          null,
          "getUnreportedOutcome",
        );
        if (unreported) {
          triggers.hasUnreportedOutcome = true;
          triggers.unreportedAppealId = unreported.appealId;
          triggers.unreportedProcedure =
            unreported.serviceDescription || undefined;
          triggers.unreportedAppealLevel = unreported.appealLevel || 1;
        }
      } catch (err) {
        console.warn("[Chat API] Failed to check unreported outcomes:", err);
      }
    }

    // Role detection — verified server-side from DB, not trusted from client sessionState
    const verifiedRole = userProfile?.role || "patient";
    if (verifiedRole === "counselor") {
      triggers.isCounselor = true;
    } else if (verifiedRole === "provider") {
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
    if (
      sessionState.conditions?.some((c) =>
        ["type1", "type2", "pre-diabetic", "other-diabetes"].includes(
          c.category,
        ),
      )
    ) {
      triggers.hasDiabetesContext = true;
    } else if (sessionState.labs && sessionState.labs.length > 0) {
      triggers.hasDiabetesContext = true;
    } else {
      const userContent = body.messages
        .filter((m) => m.role === "user")
        .map((m) => m.content.toLowerCase())
        .join(" ");
      if (
        /diabetes|diabetic|a1c|hemoglobin a1c|blood sugar|glucose|insulin|pre-?diabetic|mdpp/i.test(
          userContent,
        )
      ) {
        triggers.hasDiabetesContext = true;
      }
    }

    // Obesity context detection (from FHIR conditions, medications, or user keywords)
    if (sessionState.conditions?.some((c) => c.category === "obesity")) {
      triggers.hasObesityContext = true;
    } else if (sessionState.medications?.some((m) => m.isObesityMed)) {
      triggers.hasObesityContext = true;
    } else {
      const userContent = body.messages
        .filter((m) => m.role === "user")
        .map((m) => m.content.toLowerCase())
        .join(" ");
      if (
        /\bobes\w*|overweight|bmi|bariatric|weight\s*(loss|management)|wegovy|ozempic.*weight|zepbound|semaglutide.*weight|tirzepatide.*weight|saxenda|contrave|qsymia|glp-?1.*weight|ibt.*obes/i.test(
          userContent,
        )
      ) {
        triggers.hasObesityContext = true;
      }
    }

    console.log("[Chat API] Detected triggers:", {
      hasHealthData: triggers.hasHealthData,
      hasDiabetesContext: triggers.hasDiabetesContext,
      hasObesityContext: triggers.hasObesityContext,
      hasRecentDenials: triggers.hasRecentDenials,
      hasUnreportedOutcome: triggers.hasUnreportedOutcome,
      isCounselor: triggers.isCounselor,
      isProvider: triggers.isProvider,
    });

    // Build dynamic system prompt with learning context (async)
    // This injects learned symptom/procedure mappings and successful coverage paths
    // 10s timeout: learning context is additive — base prompt works without it
    const basePrompt = buildSystemPrompt(triggers, sessionState);
    const systemPrompt = await withFallback(
      buildSystemPromptWithLearning(triggers, sessionState, body.messages),
      10_000,
      basePrompt,
      "buildSystemPromptWithLearning",
    );
    console.log("[Chat API] System prompt length:", systemPrompt.length);
    console.log(
      "[Chat API] Health context injected:",
      systemPrompt.includes("PATIENT CHART"),
    );
    if (triggers.hasHealthData) {
      console.log("[Chat API] Health data flags:", {
        conditions: sessionState.conditions?.length ?? 0,
        medications: sessionState.medications?.length ?? 0,
        screenings: sessionState.screenings?.length ?? 0,
        diabetesClass: sessionState.diabetesClassification,
        obesityClass: sessionState.obesityClassification,
      });
    }

    // Get tool definitions and create executor map
    const toolDefinitions = getToolDefinitions();
    const toolExecutors = createToolExecutorMap();
    console.log(
      "[Chat API] Available tools:",
      toolDefinitions.map((t) => t.name),
    );

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
            ? {
                ...msg,
                content: msg.content
                  .replace(/\n?\n?\[Attached: .+?\]/, "")
                  .trim(),
              }
            : msg,
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
      writer
        .write(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        )
        .catch(() => {});
    };

    // Start async chat processing (runs after Response is returned)
    const modelOverride = sessionState.isAppeal
      ? API_CONFIG.claude.appealModel
      : undefined;
    console.log(
      "[Chat API] Starting streaming response...",
      modelOverride ? `(appeal mode: ${modelOverride})` : "",
    );

    (async () => {
      const chatStart = Date.now();
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
          },
        );
        const chatDurationMs = Date.now() - chatStart;
        logClaudeMetric({
          model: modelOverride || API_CONFIG.claude.model,
          iterations: result.iterations,
          totalMs: chatDurationMs,
          timedOut: false,
          toolsUsed: result.toolsUsed,
        });
        console.log("[Chat API] Claude response received:", {
          contentLength: result.content.length,
          toolsUsed: result.toolsUsed,
        });

        // Get or create conversation ID
        let conversationId = body.conversationId;
        let isNewConversation = false;

        if (!conversationId) {
          isNewConversation = true;
          const firstUserMsg = body.messages.find((m) => m.role === "user");
          const title = firstUserMsg
            ? firstUserMsg.content.slice(0, 60) +
              (firstUserMsg.content.length > 60 ? "..." : "")
            : null;

          try {
            const newConvResult = await query<{ id: string }>(
              `INSERT INTO conversations (user_id, is_appeal, title, status, started_at)
               VALUES ($1, $2, $3, $4, $5) RETURNING id`,
              [
                authUser?.userId ?? null,
                result.sessionState.isAppeal || false,
                title ?? null,
                "active",
                new Date().toISOString(),
              ],
            );
            conversationId = newConvResult.rows[0]?.id ?? crypto.randomUUID();
            console.log(
              "[Chat API] Created conversation:",
              conversationId,
              authUser ? "(owned)" : "(anon)",
            );
          } catch (convError) {
            conversationId = crypto.randomUUID();
            console.warn(
              "[Chat API] Failed to create conversation in DB:",
              convError,
            );
          }
        }

        // Save messages (fire-and-forget)
        const lastUserMsg = body.messages[body.messages.length - 1];
        if (conversationId && lastUserMsg) {
          query(
            `INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3), ($1, $4, $5)`,
            [
              conversationId,
              lastUserMsg.role,
              lastUserMsg.content,
              "assistant",
              result.content,
            ],
          )
            .then(() => {
              if (isNewConversation)
                console.log(
                  "[Chat API] Messages saved for conversation:",
                  conversationId,
                );
            })
            .catch((msgErr: Error) => {
              console.warn(
                "[Chat API] Failed to save messages:",
                msgErr.message,
              );
            });

          // Persist last suggestions so they can be restored on conversation load (fire-and-forget)
          if (result.suggestions.length > 0) {
            query(
              `UPDATE conversations SET last_suggestions = $2 WHERE id = $1`,
              [conversationId, JSON.stringify(result.suggestions)],
            ).catch(() => {});
          }
        }

        // Persist learning (non-blocking)
        if (result.toolsUsed.length > 0) {
          persistLearning(
            entities,
            result.sessionState,
            result.toolsUsed,
          ).catch((err) => console.warn("Failed to persist learning:", err));
        }

        // Persist appeal if generate_appeal_letter was used
        let appealId: string | undefined;
        if (
          result.toolsUsed.includes("generate_appeal_letter") &&
          conversationId
        ) {
          const ss = result.sessionState;
          const lcdRefs = ss.policyReferences.filter((r) => r.startsWith("L"));
          const ncdRefs = ss.policyReferences.filter((r) =>
            r.startsWith("NCD"),
          );
          try {
            const savedAppealId = await saveAppeal(conversationId, "", {
              appealLetter: result.appealLetter || result.content,
              denialReason:
                ss.denialCodes.length > 0
                  ? `CARC ${ss.denialCodes.join(", ")}`
                  : undefined,
              denialDate: ss.denialDate || undefined,
              icd10Codes:
                ss.diagnosisCodes.length > 0 ? ss.diagnosisCodes : undefined,
              cptCodes:
                ss.procedureCodes.length > 0 ? ss.procedureCodes : undefined,
              lcdRefs: lcdRefs.length > 0 ? lcdRefs : undefined,
              ncdRefs: ncdRefs.length > 0 ? ncdRefs : undefined,
              medicareType: ss.medicareType || undefined,
              appealLevel: ss.appealLevel || 1,
              priorAppealId: ss.priorAppealId || undefined,
            });
            if (savedAppealId) {
              appealId = savedAppealId;
              console.log("[Chat API] Appeal saved:", appealId);
              logAudit("APPEAL_GENERATED", {
                userId: authUser?.userId,
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

        console.log(
          "[Chat API] Stream complete with",
          result.suggestions.length,
          "suggestions",
        );
        await writer.close();
      } catch (error) {
        console.error("[Chat API] Stream error:", error);
        logClaudeMetric({
          model: modelOverride || API_CONFIG.claude.model,
          iterations: 0,
          totalMs: Date.now() - chatStart,
          timedOut:
            error instanceof Error && error.message.includes("timed out"),
          toolsUsed: [],
        });
        writeSSE("error", { error: SYSTEM.CHAT_ERROR });
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error("Chat API error (pre-stream):", error);

    // Pre-stream errors (validation, rate limiting) return JSON with proper status codes
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return NextResponse.json({ error: SYSTEM.CHAT_ERROR }, { status: 500 });
      }
    }

    return NextResponse.json(
      { error: SYSTEM.CHAT_ERROR_RETRY },
      { status: 500 },
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    hasBedrockAccess: true, // IAM auth via ECS task role
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
  toolsUsed: string[],
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
          boost,
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
          boost,
        );
      }
    }
  }

  // If coverage was checked, record the coverage path
  if (
    (toolsUsed.includes("search_national_coverage") ||
      toolsUsed.includes("search_local_coverage")) &&
    sessionState.diagnosisCodes.length > 0 &&
    sessionState.procedureCodes.length > 0
  ) {
    // Record coverage path for the first dx/px combination
    await recordCoveragePath(
      sessionState.diagnosisCodes[0],
      sessionState.procedureCodes[0],
      {}, // Policy refs would come from tool results
      "pending", // Outcome unknown until user reports
      sessionState.coverageCriteria,
    );
  }
}
