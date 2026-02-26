/**
 * Server-side conversation functions for AWS RDS.
 * ONLY import from API routes (server context) — uses Node.js pg driver.
 */

import { query } from "@/lib/db";
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

  // Calculate appeal deadline
  let deadline: string | null = null;
  if (appealData.denialDate) {
    const deadlineDate = new Date(appealData.denialDate);
    deadlineDate.setDate(deadlineDate.getDate() + MEDICARE_CONSTANTS.APPEAL_DEADLINE_DAYS);
    deadline = deadlineDate.toISOString();
  }

  let appealId: string;
  try {
    const result = await query<{ id: string }>(
      `INSERT INTO appeals (
        conversation_id, email, user_id, appeal_letter, denial_date, denial_reason,
        service_description, icd10_codes, cpt_codes, ncd_refs, lcd_refs, pubmed_refs,
        deadline, status, paid
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
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
      ]
    );
    appealId = result.rows[0]?.id;
    if (!appealId) {
      console.error("[saveAppeal] No ID returned from insert");
      return null;
    }
  } catch (err) {
    console.error("[saveAppeal] Failed to insert appeal:", err);
    return null;
  }

  // Increment lifetime count + decrement available credit (non-blocking)
  if (resolvedEmail) {
    query(`SELECT increment_appeal_count($1, $2)`, [resolvedEmail, appealData.userId || null])
      .catch((err) => console.warn("[saveAppeal] increment_appeal_count failed:", err));

    query(`SELECT decrement_appeal_credit($1)`, [resolvedEmail])
      .catch((err) => console.warn("[saveAppeal] decrement_appeal_credit failed:", err));

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
} | null> {
  if (!email) return null;

  try {
    const result = await query<{
      appeal_id: string;
      followup_id: string;
      service_description: string | null;
      denial_date: string | null;
    }>(`SELECT * FROM get_unreported_outcome($1)`, [email]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      appealId: row.appeal_id,
      followupId: row.followup_id,
      serviceDescription: row.service_description,
      denialDate: row.denial_date,
    };
  } catch (err) {
    console.warn("[getUnreportedOutcome] Failed:", err);
    return null;
  }
}
