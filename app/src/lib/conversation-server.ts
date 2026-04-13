/**
 * Server-side conversation functions for AWS RDS.
 * ONLY import from API routes (server context) — uses Node.js pg driver.
 */

import { query, transaction } from "@/lib/db";
import { MEDICARE_CONSTANTS } from "@/config";

export async function saveAppeal(
  conversationId: string,
  email: string,
  appealData: {
    appealLetter: string;
    denialDate?: string;
    denialReason?: string;
    serviceDescription?: string;
    icd10Codes?: string[];
    cptCodes?: string[];
    ncdRefs?: string[];
    lcdRefs?: string[];
    pubmedRefs?: string[];
    userId?: string;
    medicareType?: string;
    appealLevel?: number;
    priorAppealId?: string;
  }
): Promise<string | null> {
  // Resolve email from conversation's user if not provided
  let resolvedEmail = email;
  if (!resolvedEmail) {
    const convResult = await query<{ email: string }>(
      `SELECT u.email FROM conversations c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.id = $1`,
      [conversationId]
    );
    resolvedEmail = convResult.rows[0]?.email || "";
  }

  const level = appealData.appealLevel || 1;

  // Calculate appeal deadline based on level
  // Level 1: denial_date + 120/60 days; Level 2 FFS: 180 days; Level 2 MA: null (auto-forward); Level 3+: 60 days
  let deadline: string | null = null;
  if (appealData.denialDate) {
    const deadlineDays: number | null = level === 1
      ? MEDICARE_CONSTANTS.getAppealDeadlineDays(appealData.medicareType)
      : level === 2
        ? (appealData.medicareType === "advantage" ? null : 180)
        : 60;
    if (deadlineDays !== null) {
      const deadlineDate = new Date(appealData.denialDate);
      deadlineDate.setDate(deadlineDate.getDate() + deadlineDays);
      deadline = deadlineDate.toISOString();
    }
    // MA Level 2: deadline stays null — plan auto-forwards to IRE (42 CFR §422.590)
  }

  // Atomic: INSERT appeal + decrement credit in a single transaction.
  // If either fails, both roll back — prevents free appeals from decrement failures.
  // Level 2+ appeals for the same denial are FREE (no credit decrement).
  let appealId: string;
  try {
    appealId = await transaction(async (txQuery) => {
      const result = await txQuery<{ id: string }>(
        `INSERT INTO appeals (
          conversation_id, email, user_id, appeal_letter, denial_date, denial_reason,
          service_description, icd10_codes, cpt_codes, ncd_refs, lcd_refs, pubmed_refs,
          deadline, status, paid, appeal_level, prior_appeal_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING id`,
        [
          conversationId,
          resolvedEmail,
          appealData.userId || null,
          appealData.appealLetter,
          appealData.denialDate || null,
          appealData.denialReason || null,
          appealData.serviceDescription || null,
          appealData.icd10Codes || null,
          appealData.cptCodes || null,
          appealData.ncdRefs || null,
          appealData.lcdRefs || null,
          appealData.pubmedRefs || null,
          deadline,
          "draft",
          false,
          level,
          appealData.priorAppealId || null,
        ]
      );
      const id = result.rows[0]?.id;
      if (!id) throw new Error("No ID returned from insert");

      // Only charge credit for Level 1 (new appeal).
      // Level 2+ for the same denial = free escalation.
      if (resolvedEmail && level === 1) {
        await txQuery(`SELECT decrement_appeal_credit($1)`, [resolvedEmail]);
      }

      return id;
    });
  } catch (err) {
    console.error("[saveAppeal] Transaction failed (insert + credit decrement):", err instanceof Error ? err.message : "unknown error");
    return null;
  }

  // Non-critical follow-ups outside the transaction (fire-and-forget)
  if (resolvedEmail) {
    query(`SELECT increment_appeal_count($1, $2)`, [resolvedEmail, appealData.userId || null])
      .catch((err) => console.warn("[saveAppeal] increment_appeal_count failed:", err));

    scheduleOutcomeFollowups(appealId, resolvedEmail)
      .catch((err) => console.warn("[saveAppeal] scheduleOutcomeFollowups failed:", err));
  }

  return appealId;
}

async function scheduleOutcomeFollowups(appealId: string, email: string): Promise<void> {
  const now = new Date();
  const day30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const day60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO outcome_followups (appeal_id, email, followup_type, scheduled_at)
     VALUES ($1, $2, 'day_30', $3), ($1, $2, 'day_60', $4)`,
    [appealId, email, day30.toISOString(), day60.toISOString()]
  );
  console.log("[scheduleOutcomeFollowups] Scheduled day_30 and day_60 for appeal:", appealId);
}

export async function getUnreportedOutcome(email: string | null): Promise<{
  appealId: string;
  followupId: string;
  serviceDescription: string | null;
  denialDate: string | null;
  appealLevel: number;
} | null> {
  if (!email) return null;

  try {
    const result = await query<{
      appeal_id: string;
      followup_id: string;
      service_description: string | null;
      denial_date: string | null;
      appeal_level: number;
    }>(`SELECT * FROM get_unreported_outcome($1)`, [email]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      appealId: row.appeal_id,
      followupId: row.followup_id,
      serviceDescription: row.service_description,
      denialDate: row.denial_date,
      appealLevel: row.appeal_level || 1,
    };
  } catch (err) {
    console.warn("[getUnreportedOutcome] Failed:", err);
    return null;
  }
}
