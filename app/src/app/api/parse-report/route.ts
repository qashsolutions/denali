/**
 * POST /api/parse-report — Phase 1 mobile transient extractor.
 *
 * Net-new route owned by `mobile-upload-parse-builder` (Wave 2).
 *
 * Contract:
 *   Request:
 *     { report_type: 'lab'|'ehr'|'visit',
 *       extracted_text: string,
 *       locale?: string }
 *   Response (200):
 *     { observations: ExtractedObservation[], summary: string }
 *
 * Load-bearing invariants (mobile/CLAUDE.md § Non-negotiable invariants):
 *   1. ZERO RDS writes. The only `query()` calls allowed in the happy path
 *      are reads (users.plan, consent_preferences). Audit log INSERTs are
 *      ALSO allowed — they carry no extracted_text or observations.
 *   2. No body logging. `extracted_text` and the returned `observations`
 *      MUST NOT appear in console.log / metrics / audit metadata.
 *   3. Single one-shot Bedrock call. No tool loop, no SSE, no streaming.
 *   4. health_data_ai consent gate. When OFF, 403 — matches the multi-layer
 *      enforcement pattern documented in the root CLAUDE.md.
 *
 * Model routing (mirror `app/src/app/api/chat/route.ts:594-600`):
 *   appeal > trial > paid default. Appeal path is N/A here.
 *   - trial (or null profile treated as paid for safety symmetry) → Haiku
 *   - paid (plus / unlimited / starter) → Sonnet
 *
 * Timeout: 90s on the Bedrock call. Falls back to a 504-style error when
 * the per-call timer fires.
 */

import { NextRequest, NextResponse } from "next/server";
import { API_CONFIG } from "@/config";
import { getAuthUser } from "@/lib/auth-server";
import { getClaudeClient } from "@/lib/claude";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logClaudeMetric } from "@/lib/metrics/logger";

export const runtime = "nodejs";
// Allow up to 100s on the platform; we self-time-out the Bedrock call at 90s.
export const maxDuration = 100;

const PARSE_TIMEOUT_MS = 90_000;
const MAX_EXTRACTED_TEXT_LEN = 200_000; // ~50k tokens of input ceiling.

// ── Types ────────────────────────────────────────────────────────────────

type ReportType = "lab" | "ehr" | "visit";

interface ParseRequestBody {
  report_type: ReportType;
  extracted_text: string;
  locale?: string;
}

interface ExtractedObservation {
  category:
    | "biomarker"
    | "vital"
    | "anthropometric"
    | "condition"
    | "screening";
  code_system: "LOINC" | "ICD10" | "internal";
  code: string;
  display: string;
  value_num: number | null;
  value_text: string | null;
  unit: string | null;
  effective_at: string;
  confidence: number;
  source_text: string;
  /** The report's own printed reference interval, verbatim, or null. */
  reference_range: string | null;
  /** The report's OWN abnormal flag, copied — never inferred. */
  abnormal_flag: "normal" | "low" | "high" | "critical" | null;
}

interface ParseResponseBody {
  observations: ExtractedObservation[];
  summary: string;
}

// ── System prompt ────────────────────────────────────────────────────────

function buildSystemPrompt(reportType: ReportType, locale?: string): string {
  const localeNote = locale
    ? `\n\nLocale hint (date format / unit conventions): ${locale}`
    : "";
  return [
    "You are a medical-record extractor.",
    `Input is text from a patient's ${reportType} report (lab values, EHR export, or doctor-visit summary).`,
    "",
    "Return ONLY a JSON object — no prose, no markdown fences, no explanation.",
    "",
    "Schema:",
    "{",
    '  "observations": [',
    "    {",
    '      "category": "biomarker" | "vital" | "anthropometric" | "condition" | "screening",',
    '      "code_system": "LOINC" | "ICD10" | "internal",',
    '      "code": string,',
    '      "display": string,',
    '      "value_num": number | null,',
    '      "value_text": string | null,',
    '      "unit": string | null,',
    '      "effective_at": ISO8601 date or date-time string,',
    '      "confidence": number,           // 0..1',
    '      "source_text": string,          // short excerpt for citation',
    '      "reference_range": string | null, // the report\'s printed reference interval, verbatim (e.g. "8-61"), or null',
    '      "abnormal_flag": "normal" | "low" | "high" | "critical" | null  // the report\'s OWN flag, copied — never inferred',
    "    }",
    "  ],",
    '  "summary": "ONE short factual sentence — see the summary rule below"',
    "}",
    "",
    "Rules:",
    "- For lab values, use LOINC codes. Example: HbA1c → 4548-4.",
    "- For diagnoses / conditions, use ICD-10 codes.",
    "- For values you can't confidently code, set code_system='internal' and code to a stable slug (e.g. 'bp_systolic').",
    "- Always include unit when present (mg/dL, mmHg, kg, etc.).",
    "- effective_at: use the date the observation is ABOUT (lab collected date, visit date), not now().",
    "- confidence reflects how sure you are about both the value and the code mapping.",
    "- Skip any value you cannot confidently extract — quality over quantity.",
    "- source_text: a short verbatim excerpt (one line) the user can reference in the review UI.",
    "- reference_range: copy the report's printed reference interval verbatim if shown (e.g. '8-61'); else null.",
    "- abnormal_flag: copy the report's OWN flag — its H/High→\"high\", L/Low→\"low\", Critical/Panic→\"critical\", Normal/in-range→\"normal\" column. If the report shows NO flag for a value, use null. NEVER infer or compute a flag the report does not itself state.",
    "- Do NOT include patient identifiers (name, DOB, MRN, address) anywhere in the output.",
    "",
    // CLINICAL BOUNDARY: the summary must NOT diagnose. We interpret only what
    // the report literally prints — never a condition, cause, risk, or advice.
    "- summary: ONE short, factual sentence about WHAT THE REPORT CONTAINS only — e.g. how many values it lists and how many it flags outside the reference range. Do NOT diagnose, NOT name a disease or condition, NOT infer a cause, NOT assess risk, NOT recommend anything. Good: \"This lab report lists 8 values; 3 are flagged outside the reference range.\" Bad: \"Findings consistent with <disease>\" or \"positive screen for <risk>\".",
    "",
    "Output JSON only. No surrounding text.",
    localeNote,
  ].join("\n");
}

// ── Body parsing helpers ─────────────────────────────────────────────────

function isReportType(v: unknown): v is ReportType {
  return v === "lab" || v === "ehr" || v === "visit";
}

function validateBody(raw: unknown): ParseRequestBody | { error: string } {
  if (!raw || typeof raw !== "object") {
    return { error: "Request body must be a JSON object" };
  }
  const body = raw as Record<string, unknown>;

  if (!isReportType(body.report_type)) {
    return { error: "report_type must be one of: lab, ehr, visit" };
  }
  if (typeof body.extracted_text !== "string" || body.extracted_text.length === 0) {
    return { error: "extracted_text is required and must be a non-empty string" };
  }
  if (body.extracted_text.length > MAX_EXTRACTED_TEXT_LEN) {
    return {
      error: `extracted_text exceeds ${MAX_EXTRACTED_TEXT_LEN} chars`,
    };
  }
  if (body.locale !== undefined && typeof body.locale !== "string") {
    return { error: "locale must be a string when provided" };
  }

  return {
    report_type: body.report_type,
    extracted_text: body.extracted_text,
    locale: body.locale as string | undefined,
  };
}

// ── Model routing ────────────────────────────────────────────────────────

/**
 * Mirror of `chat/route.ts:594-600` precedence — appeal > trial > paid.
 * Appeal does not apply to this route.
 *
 * - `plan == null` (RDS-timeout or unset) → treat as paid (Sonnet) so a
 *   transient outage doesn't silently downgrade paying users.
 * - `plan === "trial"` → Haiku (free-tier model).
 * - any other string (plus / unlimited / starter) → Sonnet default.
 */
function resolveModel(plan: string | null | undefined): string {
  const isTrial = plan != null && plan === "trial";
  return isTrial ? API_CONFIG.claude.trialModel : API_CONFIG.claude.model;
}

// ── Bedrock call with timeout ────────────────────────────────────────────

interface ClaudeMessageResult {
  text: string;
}

async function runOneShotClaude(
  systemPrompt: string,
  userText: string,
  model: string,
): Promise<ClaudeMessageResult> {
  const client = getClaudeClient();

  // Race the Anthropic call against PARSE_TIMEOUT_MS. AnthropicBedrock /
  // Anthropic SDK both accept AbortSignal; we use it to actually cancel
  // (not just race), matching the AbortController pattern in claude.ts.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PARSE_TIMEOUT_MS);

  try {
    const message = await (
      client as unknown as {
        messages: {
          create: (params: unknown, options?: { signal?: AbortSignal }) => Promise<{
            content: Array<{ type: string; text?: string }>;
          }>;
        };
      }
    ).messages.create(
      {
        model,
        max_tokens: API_CONFIG.claude.maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userText }],
      },
      { signal: controller.signal },
    );

    // Concatenate any text blocks; tool/thinking blocks are unused here.
    const text = (message.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");

    return { text };
  } finally {
    clearTimeout(timer);
  }
}

// ── JSON envelope parser ─────────────────────────────────────────────────

/**
 * Extract the JSON envelope from Claude's response. Tolerant of:
 *   - Plain JSON.
 *   - ```json … ``` fenced JSON (in case the model ignores the no-fence rule).
 *   - Leading/trailing whitespace.
 *
 * Returns `null` on parse failure — caller surfaces a 502-style error.
 */
function parseEnvelope(text: string): ParseResponseBody | null {
  let candidate = text.trim();

  // Strip ```json … ``` or ``` … ``` fences if present.
  const fenceMatch = candidate.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) {
    candidate = fenceMatch[1].trim();
  }

  if (!candidate.startsWith("{")) {
    // Try to find the first { … } block.
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace <= firstBrace) return null;
    candidate = candidate.slice(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    if (!Array.isArray(obj.observations)) return null;
    if (typeof obj.summary !== "string") return null;

    // Light shape validation per row — drop rows that don't look right.
    const observations: ExtractedObservation[] = [];
    for (const row of obj.observations) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      if (typeof r.code !== "string" || typeof r.display !== "string") continue;
      if (typeof r.effective_at !== "string") continue;
      observations.push({
        category: r.category as ExtractedObservation["category"],
        code_system: r.code_system as ExtractedObservation["code_system"],
        code: r.code,
        display: r.display,
        value_num: typeof r.value_num === "number" ? r.value_num : null,
        value_text: typeof r.value_text === "string" ? r.value_text : null,
        unit: typeof r.unit === "string" ? r.unit : null,
        effective_at: r.effective_at,
        confidence: typeof r.confidence === "number" ? r.confidence : 0,
        source_text: typeof r.source_text === "string" ? r.source_text : "",
        reference_range:
          typeof r.reference_range === "string" ? r.reference_range : null,
        abnormal_flag:
          r.abnormal_flag === "normal" ||
          r.abnormal_flag === "low" ||
          r.abnormal_flag === "high" ||
          r.abnormal_flag === "critical"
            ? r.abnormal_flag
            : null,
      });
    }
    return { observations, summary: obj.summary };
  } catch {
    return null;
  }
}

// ── POST handler ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  const startedAt = Date.now();

  // 1. Auth
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  // 2. Body validation
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }
  const validated = validateBody(raw);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  // 3. health_data_ai consent gate (server-side backup; the mobile client
  //    also blocks the submit when the toggle is OFF).
  const consentResult = await query<{ granted: boolean }>(
    `SELECT granted FROM consent_preferences
     WHERE user_id = $1 AND consent_type = 'health_data_ai'`,
    [authUser.userId],
  );
  const hasConsent = consentResult.rows.some((r) => r.granted === true);
  if (!hasConsent) {
    return NextResponse.json(
      {
        error: "AI parsing is disabled. Enable health_data_ai in Settings.",
        code: "HEALTH_DATA_AI_DISABLED",
      },
      { status: 403 },
    );
  }

  // 4. Plan read (for model routing).
  const planResult = await query<{ plan: string | null }>(
    `SELECT plan FROM users WHERE id = $1 LIMIT 1`,
    [authUser.userId],
  );
  const userPlan = planResult.rows[0]?.plan ?? null;
  const model = resolveModel(userPlan);

  // 5. One-shot Bedrock call.
  const systemPrompt = buildSystemPrompt(
    validated.report_type,
    validated.locale,
  );

  let result: ClaudeMessageResult;
  let timedOut = false;
  try {
    result = await runOneShotClaude(systemPrompt, validated.extracted_text, model);
  } catch (err) {
    const isAbort = (err as { name?: string } | undefined)?.name === "AbortError";
    timedOut = isAbort;
    const durationMs = Date.now() - startedAt;
    logClaudeMetric({
      model,
      iterations: 1,
      totalMs: durationMs,
      timedOut,
      toolsUsed: [],
    });
    // Fire-and-forget audit — no body content.
    logAudit("PARSE_REPORT_INVOKED", {
      userId: authUser.userId,
      request,
      metadata: {
        report_type: validated.report_type,
        durationMs,
        outcome: timedOut ? "timeout" : "error",
      },
    }).catch(() => {});
    return NextResponse.json(
      {
        error: timedOut
          ? "Parse timed out — try a shorter document."
          : "Parse failed — please retry.",
      },
      { status: timedOut ? 504 : 502 },
    );
  }

  // 6. Parse JSON envelope.
  const envelope = parseEnvelope(result.text);
  const durationMs = Date.now() - startedAt;

  logClaudeMetric({
    model,
    iterations: 1,
    totalMs: durationMs,
    timedOut: false,
    toolsUsed: [],
  });
  // Audit — no body content. Records only that the route was invoked.
  logAudit("PARSE_REPORT_INVOKED", {
    userId: authUser.userId,
    request,
    metadata: {
      report_type: validated.report_type,
      durationMs,
      outcome: envelope ? "ok" : "parse_failure",
      observation_count: envelope?.observations.length ?? 0,
    },
  }).catch(() => {});

  if (!envelope) {
    return NextResponse.json(
      { error: "Model returned malformed JSON; please retry." },
      { status: 502 },
    );
  }

  return NextResponse.json(envelope, { status: 200 });
}
