/**
 * Alert Processing Engine
 *
 * Daily batch processor that checks eligible users for alert conditions,
 * deduplicates against alert_log, and sends via AWS SES. Called by
 * POST /api/alerts/process (EventBridge → Lambda → ALB).
 *
 * NO PHI in emails — generic notifications directing users to log in.
 */

import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { ALERT_CONFIG, getEligibleAlertTypes } from "@/config/alerts";
import type { AlertType } from "@/config/alerts";
import { buildAlertEmail } from "./templates";
import type { MedicationSummary, ClaimSummary } from "@/lib/fhir/transforms";

interface ProcessResult {
  processed: number;
  sent: number;
  errors: number;
  details: Array<{ userId: string; alertType: string; status: string }>;
}

interface AlertCandidate {
  alertType: AlertType | "outcome_followup";
  dedupKey: string;
  metadata?: Record<string, unknown>;
  outcomeToken?: string;
}

/**
 * Main batch processor. Queries eligible users, checks alert conditions,
 * deduplicates, sends emails, logs results.
 */
export async function processAlerts(dryRun: boolean = false): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, sent: 0, errors: 0, details: [] };

  // SES email sending uses IAM auth — no API key needed

  // Get eligible users (Plus, Unlimited, or admin — with email + Blue Button connected)
  const users = await query<{
    id: string;
    email: string;
    plan: string;
    is_admin: boolean;
  }>(
    `SELECT u.id, u.email, COALESCE(s.plan_type, u.plan) as plan, u.is_admin
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
     WHERE u.email IS NOT NULL
       AND (u.plan IN ('plus', 'unlimited') OR u.is_admin = true
            OR s.plan_type IN ('plus', 'unlimited'))`
  );

  for (const user of users.rows) {
    try {
      const eligible = getEligibleAlertTypes(user.plan, user.is_admin);
      if (eligible.length === 0 && !user.is_admin) continue;

      // Get user's alert preferences (missing row = disabled — opt-in required per CMS)
      const prefs = await query<{ alert_type: string; enabled: boolean }>(
        `SELECT alert_type, enabled FROM alert_preferences WHERE user_id = $1`,
        [user.id]
      );
      const prefMap = new Map(prefs.rows.map((p) => [p.alert_type, p.enabled]));
      const hasAnyAlertEnabled = Array.from(prefMap.values()).some((v) => v === true);

      // Check today's send count for safety cap
      const todayCount = await query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM alert_log
         WHERE user_id = $1 AND sent_at >= CURRENT_DATE`,
        [user.id]
      );
      let sentToday = parseInt(todayCount.rows[0]?.count || "0", 10);

      // Collect candidates from all alert types
      const candidates: AlertCandidate[] = [];

      for (const alertType of eligible) {
        // Skip unless user has explicitly opted in (missing row = disabled per CMS)
        if (prefMap.get(alertType) !== true) continue;

        const typeCandidates = await checkAlertCondition(user.id, alertType);
        candidates.push(...typeCandidates);
      }

      // Outcome followups are not plan-gated, but still require at least one
      // alert type opted in — a user who has disabled all email alerts should
      // not receive followup prompts either.
      if (hasAnyAlertEnabled) {
        const followupCandidates = await checkOutcomeFollowups(user.id, user.email);
        candidates.push(...followupCandidates);
      }

      // Dedup against alert_log and enforce daily cap
      for (const candidate of candidates) {
        if (sentToday >= ALERT_CONFIG.MAX_ALERTS_PER_USER_PER_DAY) break;

        const alreadySent = await query<{ id: string }>(
          `SELECT id FROM alert_log
           WHERE user_id = $1 AND alert_type = $2 AND dedup_key = $3
           LIMIT 1`,
          [user.id, candidate.alertType, candidate.dedupKey]
        );

        if (alreadySent.rows.length > 0) continue;

        result.processed++;

        if (dryRun) {
          result.details.push({
            userId: user.id,
            alertType: candidate.alertType,
            status: "dry_run",
          });
          continue;
        }

        // Send email
        const { subject, html } = buildAlertEmail(
          candidate.alertType,
          { outcomeToken: candidate.outcomeToken }
        );

        try {
          const emailResult = await sendEmail({
            from: "denali.health <no-reply@denali.health>",
            to: [user.email],
            subject,
            html,
          });

          if (!emailResult.messageId) {
            console.error(`[Alerts] SES send failed for ${user.email}`);
            await logAlertSend(user.id, candidate, user.email, null, "failed");
            result.errors++;
            result.details.push({
              userId: user.id,
              alertType: candidate.alertType,
              status: "failed",
            });
            continue;
          }

          await logAlertSend(user.id, candidate, user.email, emailResult.messageId, "sent");

          // Mark outcome followup as sent if applicable
          if (candidate.alertType === "outcome_followup" && candidate.metadata?.followupId) {
            await query(
              `UPDATE outcome_followups SET sent_at = NOW() WHERE id = $1`,
              [candidate.metadata.followupId]
            );
          }

          result.sent++;
          sentToday++;
          result.details.push({
            userId: user.id,
            alertType: candidate.alertType,
            status: "sent",
          });
        } catch (err) {
          console.error(`[Alerts] Send error for ${user.email}:`, err);
          result.errors++;
          result.details.push({
            userId: user.id,
            alertType: candidate.alertType,
            status: "error",
          });
        }

        // 100ms delay between sends to avoid SES rate limits
        await new Promise((r) => setTimeout(r, 100));
      }
    } catch (err) {
      console.error(`[Alerts] Error processing user ${user.id}:`, err);
      result.errors++;
    }
  }

  // Audit log (fire-and-forget)
  logAudit("ALERT_BATCH_PROCESSED", {
    metadata: {
      processed: result.processed,
      sent: result.sent,
      errors: result.errors,
      dryRun,
    },
  }).catch(() => {});

  return result;
}

/**
 * Check a specific alert condition for a user. Returns deduped candidates.
 */
async function checkAlertCondition(
  userId: string,
  alertType: AlertType
): Promise<AlertCandidate[]> {
  switch (alertType) {
    case "appeal_deadline":
      return checkAppealDeadlines(userId);
    case "med_refill":
      return checkMedRefillGaps(userId);
    case "new_denial":
      return checkNewDenials(userId);
    case "data_refresh":
      return checkDataRefresh(userId);
    default:
      return [];
  }
}

/**
 * Appeal deadline: alerts at 30, 14, 7 days before deadline.
 */
async function checkAppealDeadlines(userId: string): Promise<AlertCandidate[]> {
  const appeals = await query<{ id: string; deadline: string }>(
    `SELECT id, deadline FROM appeals
     WHERE user_id = $1
       AND deadline IS NOT NULL
       AND deadline > NOW()
       AND outcome_reported_at IS NULL`,
    [userId]
  );

  const candidates: AlertCandidate[] = [];
  const now = new Date();

  for (const appeal of appeals.rows) {
    const deadline = new Date(appeal.deadline);
    const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    for (const reminderDay of ALERT_CONFIG.APPEAL_DEADLINE_REMINDERS) {
      if (daysUntil <= reminderDay) {
        candidates.push({
          alertType: "appeal_deadline",
          dedupKey: `appeal_deadline:${reminderDay}:${appeal.id}`,
          metadata: { appealId: appeal.id, daysUntil, reminderDay },
        });
        break; // Only the most urgent reminder per appeal
      }
    }
  }

  return candidates;
}

/**
 * Medication refill: alerts when estimated run-out date has passed by GAP_DAYS.
 * Recomputes from estimatedRunOutDate (not stale cached gapDays).
 */
async function checkMedRefillGaps(userId: string): Promise<AlertCandidate[]> {
  const cached = await query<{ data: string }>(
    `SELECT data FROM fhir_cache
     WHERE user_id = $1 AND resource_type = 'medications'
     LIMIT 1`,
    [userId]
  );

  if (cached.rows.length === 0) return [];

  let medications: MedicationSummary[];
  try {
    medications = JSON.parse(cached.rows[0].data);
  } catch {
    return [];
  }

  const candidates: AlertCandidate[] = [];
  const now = new Date();
  const gapThreshold = ALERT_CONFIG.MED_REFILL_GAP_DAYS;

  for (const med of medications) {
    if (!med.estimatedRunOutDate) continue;

    const runOut = new Date(med.estimatedRunOutDate);
    const gapDays = Math.ceil((now.getTime() - runOut.getTime()) / (1000 * 60 * 60 * 24));

    if (gapDays >= gapThreshold) {
      // Monthly dedup key prevents daily spam for same med
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      candidates.push({
        alertType: "med_refill",
        dedupKey: `med_refill:${med.name}:${month}`,
        metadata: { drugName: med.name, gapDays },
      });
    }
  }

  return candidates;
}

/**
 * New denial: alerts when a denied claim appears that hasn't been alerted on.
 */
async function checkNewDenials(userId: string): Promise<AlertCandidate[]> {
  const cached = await query<{ data: string }>(
    `SELECT data FROM fhir_cache
     WHERE user_id = $1 AND resource_type = 'eob'
     LIMIT 1`,
    [userId]
  );

  if (cached.rows.length === 0) return [];

  let claims: ClaimSummary[];
  try {
    claims = JSON.parse(cached.rows[0].data);
  } catch {
    return [];
  }

  const candidates: AlertCandidate[] = [];

  for (const claim of claims) {
    if (claim.status === "Denied" && claim.denialReasons && claim.denialReasons.length > 0) {
      candidates.push({
        alertType: "new_denial",
        dedupKey: `new_denial:${claim.id}`,
        metadata: { claimId: claim.id },
      });
    }
  }

  return candidates;
}

/**
 * Data refresh: alerts when last FHIR sync is older than STALE_DAYS.
 */
async function checkDataRefresh(userId: string): Promise<AlertCandidate[]> {
  const conn = await query<{ last_synced_at: string }>(
    `SELECT last_synced_at FROM ehr_connections
     WHERE user_id = $1 AND status = 'connected'
     LIMIT 1`,
    [userId]
  );

  if (conn.rows.length === 0) return [];

  const lastSync = new Date(conn.rows[0].last_synced_at);
  const now = new Date();
  const daysSince = Math.ceil((now.getTime() - lastSync.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSince >= ALERT_CONFIG.DATA_REFRESH_STALE_DAYS) {
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return [
      {
        alertType: "data_refresh",
        dedupKey: `data_refresh:${month}`,
        metadata: { daysSince },
      },
    ];
  }

  return [];
}

/**
 * Outcome followups: scheduled by saveAppeal(), not plan-gated.
 */
async function checkOutcomeFollowups(
  userId: string,
  _email: string
): Promise<AlertCandidate[]> {
  const followups = await query<{
    id: string;
    appeal_id: string;
    token: string;
    followup_type: string;
  }>(
    `SELECT of.id, of.appeal_id, of.token, of.followup_type
     FROM outcome_followups of
     JOIN appeals a ON a.id = of.appeal_id
     WHERE a.user_id = $1
       AND of.sent_at IS NULL
       AND of.responded_at IS NULL
       AND of.scheduled_at <= NOW()
     LIMIT 5`,
    [userId]
  );

  return followups.rows.map((f) => ({
    alertType: "outcome_followup" as const,
    dedupKey: `outcome_followup:${f.id}`,
    outcomeToken: f.token,
    metadata: { followupId: f.id, appealId: f.appeal_id, followupType: f.followup_type },
  }));
}

/**
 * Insert into alert_log for dedup + audit trail.
 */
async function logAlertSend(
  userId: string,
  candidate: AlertCandidate,
  email: string,
  resendId: string | null,
  status: "sent" | "bounced" | "failed"
): Promise<void> {
  await query(
    `INSERT INTO alert_log (user_id, alert_type, dedup_key, email, resend_id, status, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      userId,
      candidate.alertType,
      candidate.dedupKey,
      email,
      resendId,
      status,
      JSON.stringify(candidate.metadata || {}),
    ]
  );
}
