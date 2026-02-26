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
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    const userId = user.userId;
    const email = user.email;

    // Block admin account deletion — admin accounts must be managed directly in AWS
    const adminCheckResult = await query<{ is_admin: boolean }>(
      `SELECT is_admin FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (adminCheckResult.rows[0]?.is_admin) {
      return NextResponse.json(
        { error: "Admin accounts cannot be deleted through the app." },
        { status: 403 }
      );
    }

    // Log before deletion (userId may be cleared after delete via FK)
    logAudit("ACCOUNT_DELETED", {
      userId,
      resourceType: "account",
      metadata: { email: email ?? null },
      request,
    }).catch(() => {});

    // --- Cascade deletion in FK-safe order ---

    // 0. Delete EHR connections and FHIR cache (Blue Button data)
    await query(`DELETE FROM fhir_cache WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM ehr_connections WHERE user_id = $1`, [userId]);

    // 0b. Delete diabetes data
    await query(`DELETE FROM diabetes_snapshots WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM diabetes_log WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM diabetes_insights WHERE user_id = $1`, [userId]);

    // 0c. Delete chat usage tracking
    await query(`DELETE FROM chat_daily_usage WHERE identifier = $1`, [userId]);

    // 0d. Delete consent preferences
    await query(`DELETE FROM consent_preferences WHERE user_id = $1`, [userId]);

    // 1. Delete user feedback
    await query(`DELETE FROM user_feedback WHERE user_id = $1`, [userId]);

    // 2. Delete messages from user's conversations
    await query(
      `DELETE FROM messages WHERE conversation_id IN (
         SELECT id FROM conversations WHERE user_id = $1
       )`,
      [userId]
    );

    // 3. Delete appeals
    await query(`DELETE FROM appeals WHERE user_id = $1`, [userId]);

    // 4. Delete conversations
    await query(`DELETE FROM conversations WHERE user_id = $1`, [userId]);

    // 5. Delete usage record
    if (email) {
      await query(`DELETE FROM usage WHERE email = $1`, [email]);
    }

    // 6. Cancel any active Stripe subscriptions
    const subResult = await query<{ stripe_subscription_id: string | null }>(
      `SELECT stripe_subscription_id FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );
    const stripeSubId = subResult.rows[0]?.stripe_subscription_id;
    if (stripeSubId) {
      try {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (stripeKey) {
          await fetch(`https://api.stripe.com/v1/subscriptions/${stripeSubId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${stripeKey}` },
          });
        }
      } catch (stripeError) {
        console.error("Failed to cancel Stripe subscription:", stripeError);
        // Continue with deletion even if Stripe fails
      }
    }

    // 7. Delete subscriptions
    await query(`DELETE FROM subscriptions WHERE user_id = $1`, [userId]);

    // 8. Delete user events
    await query(`DELETE FROM user_events WHERE user_id = $1`, [userId]);

    // 9. Delete user verification records
    await query(`DELETE FROM user_verification WHERE user_id = $1`, [userId]);

    // 10. Delete the user record (try RPC first, then direct delete)
    try {
      await query(`SELECT delete_user_cascade($1)`, [userId]);
    } catch {
      await query(`DELETE FROM users WHERE id = $1`, [userId]);
    }

    // 11. Delete the Cognito user (removes login credentials)
    try {
      await deleteCognitoUser(email);
    } catch (authDeleteError) {
      console.error("Failed to delete Cognito user:", authDeleteError);
      // Continue — public.users is already deleted; Cognito record is orphaned but harmless
    }

    return NextResponse.json({
      success: true,
      message: "Your account and all associated data have been permanently deleted.",
    });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete account. Please contact support." },
      { status: 500 }
    );
  }
}

// Also support POST for clients that don't support DELETE
export async function POST(request: NextRequest) {
  return DELETE(request);
}
