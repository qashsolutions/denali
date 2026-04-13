/**
 * Account Deletion API Route
 *
 * DELETE /api/account/delete
 *
 * Deletes user account and all associated data (GDPR/CCPA compliance).
 * This is a destructive operation and cannot be undone.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, deleteCognitoUser } from "@/lib/auth-server";
import { query, transaction } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { withMetrics } from "@/lib/metrics";
import { SYSTEM } from "@/config/messages";

async function _DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: SYSTEM.SESSION_INVALID },
        { status: 401 },
      );
    }

    const userId = user.userId;
    const email = user.email;

    // Block admin account deletion — admin accounts must be managed directly in AWS
    const adminCheckResult = await query<{ is_admin: boolean }>(
      `SELECT is_admin FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    if (adminCheckResult.rows[0]?.is_admin) {
      return NextResponse.json(
        { error: SYSTEM.ADMIN_DELETE_BLOCKED },
        { status: 403 },
      );
    }

    // Log before deletion (userId may be cleared after delete via FK)
    logAudit("ACCOUNT_DELETED", {
      userId,
      resourceType: "account",
      metadata: { email: email ?? null },
      request,
    }).catch(() => {});

    // --- Cancel Stripe BEFORE transaction (external API, not rollbackable) ---
    const subResult = await query<{ stripe_subscription_id: string | null }>(
      `SELECT stripe_subscription_id FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId],
    );
    const stripeSubId = subResult.rows[0]?.stripe_subscription_id;
    if (stripeSubId) {
      try {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (stripeKey) {
          await fetch(
            `https://api.stripe.com/v1/subscriptions/${stripeSubId}`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${stripeKey}` },
            },
          );
        }
      } catch (stripeError) {
        console.error("Failed to cancel Stripe subscription:", stripeError instanceof Error ? stripeError.message : "unknown error");
      }
    }

    // --- Cascade deletion in a single transaction (all-or-nothing) ---
    await transaction(async (q) => {
      // 0. Blue Button data
      await q(`DELETE FROM health_reports WHERE user_id = $1`, [userId]);
      await q(`DELETE FROM fhir_cache WHERE user_id = $1`, [userId]);
      await q(`DELETE FROM ehr_connections WHERE user_id = $1`, [userId]);

      // 1. Diabetes data
      await q(`DELETE FROM diabetes_snapshots WHERE user_id = $1`, [userId]);
      await q(`DELETE FROM diabetes_log WHERE user_id = $1`, [userId]);
      await q(`DELETE FROM diabetes_insights WHERE user_id = $1`, [userId]);

      // 2. Chat usage tracking
      await q(`DELETE FROM chat_daily_usage WHERE identifier = $1`, [userId]);

      // 3. Consent preferences
      await q(`DELETE FROM consent_preferences WHERE user_id = $1`, [userId]);

      // 4. Alert data
      await q(`DELETE FROM alert_log WHERE user_id = $1`, [userId]);
      await q(`DELETE FROM alert_preferences WHERE user_id = $1`, [userId]);

      // 5. User feedback
      await q(`DELETE FROM user_feedback WHERE user_id = $1`, [userId]);

      // 6. User events (linked to conversations via conversation_id, ON DELETE SET NULL)
      await q(
        `DELETE FROM user_events WHERE conversation_id IN (
           SELECT id FROM conversations WHERE user_id = $1
         )`,
        [userId],
      );

      // 7. Messages (linked to conversations)
      await q(
        `DELETE FROM messages WHERE conversation_id IN (
           SELECT id FROM conversations WHERE user_id = $1
         )`,
        [userId],
      );

      // 8. Appeals
      await q(`DELETE FROM appeals WHERE user_id = $1`, [userId]);

      // 9. Conversations
      await q(`DELETE FROM conversations WHERE user_id = $1`, [userId]);

      // 10. Usage record (keyed by email)
      if (email) {
        await q(`DELETE FROM usage WHERE email = $1`, [email]);
      }

      // 11. Subscriptions
      await q(`DELETE FROM subscriptions WHERE user_id = $1`, [userId]);

      // 12. User verification
      await q(`DELETE FROM user_verification WHERE user_id = $1`, [userId]);

      // 13. Delete the user record
      await q(`DELETE FROM users WHERE id = $1`, [userId]);
    });

    // 14. Delete the Cognito user (removes login credentials — outside transaction)
    try {
      await deleteCognitoUser(email);
    } catch (authDeleteError) {
      console.error("Failed to delete Cognito user:", authDeleteError);
      // Continue — public.users is already deleted; Cognito record is orphaned but harmless
    }

    return NextResponse.json({
      success: true,
      message:
        "Your account and all associated data have been permanently deleted.",
    });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json({ error: SYSTEM.DELETE_FAILED }, { status: 500 });
  }
}

// Also support POST for clients that don't support DELETE
async function _POST(request: NextRequest) {
  return _DELETE(request);
}

export const DELETE = withMetrics(_DELETE, "/api/account/delete");
export const POST = withMetrics(_POST, "/api/account/delete");
