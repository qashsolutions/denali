/**
 * Audit Logging
 *
 * CMS Interoperability compliance: Section I.4, Section V.25, HIPAA audit trail.
 * Logs sensitive operations (FHIR access, appeal generation, consent changes, etc.)
 * to the `audit_logs` table for transparency and accountability.
 */

import { createAdminClient } from "@/lib/supabase-admin";
import type { Json } from "@/types/database";

export type AuditAction =
  | "FHIR_CONNECT"
  | "FHIR_DISCONNECT"
  | "FHIR_DATA_ACCESS"
  | "APPEAL_GENERATED"
  | "APPEAL_OUTCOME"
  | "CONSENT_UPDATED"
  | "ACCOUNT_DELETED"
  | "LOGIN"
  | "SETTINGS_CHANGED"
  | "CHECKOUT_STARTED"
  | "TRIAL_STARTED";

type ResourceType =
  | "ehr_connection"
  | "appeal"
  | "conversation"
  | "consent"
  | "account"
  | "subscription"
  | "settings";

/**
 * Log an auditable action. Uses the admin client to bypass RLS.
 * Non-blocking — callers should fire-and-forget with .catch().
 */
export async function logAudit(
  action: AuditAction,
  options: {
    userId?: string | null;
    resourceType?: ResourceType;
    resourceId?: string;
    metadata?: Record<string, Json>;
    request?: Request;
  } = {}
): Promise<void> {
  try {
    const admin = createAdminClient();

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

    await admin.from("audit_logs").insert({
      user_id: options.userId ?? null,
      action,
      resource_type: options.resourceType ?? null,
      resource_id: options.resourceId ?? null,
      metadata: (options.metadata ?? {}) as Json,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  } catch (error) {
    // Audit logging should never break the main flow
    console.warn("[Audit] Failed to write audit log:", error);
  }
}
