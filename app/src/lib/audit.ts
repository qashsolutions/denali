/**
 * Audit Logging
 *
 * CMS Interoperability compliance: Section I.4, Section V.25, HIPAA audit trail.
 * Logs sensitive operations (FHIR access, appeal generation, consent changes, etc.)
 * to the `audit_logs` table for transparency and accountability.
 * Uses RDS PostgreSQL directly via query().
 */

import { query } from "@/lib/db";

export type AuditAction =
  | "FHIR_CONNECT"
  | "FHIR_DISCONNECT"
  | "FHIR_DATA_ACCESS"
  | "FHIR_DATA_ACCESS_FAILED"
  | "APPEAL_GENERATED"
  | "APPEAL_OUTCOME"
  | "CONSENT_UPDATED"
  | "ACCOUNT_DELETED"
  | "LOGIN"
  | "SETTINGS_CHANGED"
  | "CHECKOUT_STARTED"
  | "TRIAL_STARTED"
  | "DIABETES_INSIGHT_GENERATED"
  | "DIABETES_LOG_ENTRY"
  | "PREFERENCES_UPDATED"
  | "POLICY_CHANGE_EMAIL"
  | "HEALTH_REPORT_GENERATED"
  | "REPORT_SHARED_ACCESS"
  | "REPORT_EMAILED"
  | "ALERT_BATCH_PROCESSED"
  | "ALERT_SENT"
  | "ALERT_PREFERENCE_UPDATED"
  | "IDME_VERIFY"
  | "LOGOUT"
  | "BIRTH_YEAR_REMINDER_DISMISSED"
  | "BIRTH_YEAR_REMINDER_DISABLED"
  | "BIRTH_YEAR_REMINDER_ENABLED";

type ResourceType =
  | "ehr_connection"
  | "appeal"
  | "conversation"
  | "consent"
  | "account"
  | "subscription"
  | "settings"
  | "diabetes_insight"
  | "diabetes_log"
  | "topic_preferences"
  | "policy_notification"
  | "identity"
  | "health_report";

// Actions with a dedup window (ms). Same user+action within this window → skip insert.
// Only high-frequency, low-value actions belong here. Sensitive actions (appeals, consent, etc.)
// must always log every occurrence for audit compliance.
const DEDUP_WINDOWS: Partial<Record<AuditAction, number>> = {
  FHIR_DATA_ACCESS: 5 * 60 * 1000, // 5 minutes — deduplicates rapid page navigation, not sessions
  FHIR_DATA_ACCESS_FAILED: 5 * 60 * 1000, // 5 minutes — rapid failures shouldn't flood the log
};

/**
 * Log an auditable action. Uses direct RDS query.
 * Non-blocking — callers should fire-and-forget with .catch().
 */
export async function logAudit(
  action: AuditAction,
  options: {
    userId?: string | null;
    resourceType?: ResourceType;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    request?: Request;
  } = {},
): Promise<void> {
  try {
    // Dedup check: skip if same user+action logged recently
    const dedupMs = DEDUP_WINDOWS[action];
    if (dedupMs && options.userId) {
      const cutoff = new Date(Date.now() - dedupMs).toISOString();
      const recent = await query(
        `SELECT id FROM audit_logs
         WHERE user_id = $1 AND action = $2 AND created_at >= $3
         LIMIT 1`,
        [options.userId, action, cutoff],
      );
      if (recent.rows.length > 0) return;
    }

    // Extract IP and User-Agent from request if provided
    let ipAddress: string | null = null;
    let userAgent: string | null = null;

    if (options.request) {
      ipAddress =
        options.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        options.request.headers.get("x-real-ip") ??
        null;
      userAgent = options.request.headers.get("user-agent");
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        options.userId ?? null,
        action,
        options.resourceType ?? null,
        options.resourceId ?? null,
        JSON.stringify(options.metadata ?? {}),
        ipAddress,
        userAgent,
      ],
    );
  } catch (error) {
    // Audit logging should never break the main flow
    console.warn("[Audit] Failed to write audit log:", error);
  }
}
