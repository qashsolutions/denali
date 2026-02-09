/**
 * Account Deletion API Route
 *
 * DELETE /api/account/delete
 *
 * Deletes user account and all associated data (GDPR/CCPA compliance).
 * This is a destructive operation and cannot be undone.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { logAudit } from "@/lib/audit";

export async function DELETE(request: NextRequest) {
  try {
    // Cookie-authenticated server client for auth verification
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    const userId = user.id;
    const email = user.email;

    // Admin client bypasses RLS for cascade deletion
    const admin = createAdminClient();

    // Log before deletion (userId will be SET NULL after delete via FK)
    logAudit("ACCOUNT_DELETED", {
      userId,
      resourceType: "account",
      metadata: { email: email ?? null },
      request,
    }).catch(() => {});

    // Start deletion process
    // Order matters due to foreign key constraints

    // 0. Delete EHR connections and FHIR cache (Blue Button data)
    await admin
      .from("fhir_cache")
      .delete()
      .eq("user_id", userId);
    await admin
      .from("ehr_connections")
      .delete()
      .eq("user_id", userId);

    // 0b. Delete diabetes data
    await admin.from("diabetes_snapshots").delete().eq("user_id", userId);
    await admin.from("diabetes_log").delete().eq("user_id", userId);
    await admin.from("diabetes_insights").delete().eq("user_id", userId);

    // 0c. Delete chat usage tracking
    await admin.from("chat_daily_usage").delete().eq("identifier", userId);

    // 0d. Delete consent preferences
    await admin.from("consent_preferences").delete().eq("user_id", userId);

    // 1. Delete user feedback
    await admin
      .from("user_feedback")
      .delete()
      .eq("user_id", userId);

    // 2. Delete messages from user's conversations
    const { data: conversations } = await admin
      .from("conversations")
      .select("id")
      .eq("user_id", userId);

    if (conversations && conversations.length > 0) {
      const conversationIds = conversations.map((c: { id: string }) => c.id);
      await admin
        .from("messages")
        .delete()
        .in("conversation_id", conversationIds);
    }

    // 3. Delete appeals
    await admin
      .from("appeals")
      .delete()
      .eq("user_id", userId);

    // 4. Delete conversations
    await admin
      .from("conversations")
      .delete()
      .eq("user_id", userId);

    // 5. Delete usage record
    if (email) {
      await admin
        .from("usage")
        .delete()
        .eq("email", email);
    }

    // 6. Cancel any active subscriptions via Stripe
    const { data: subscription } = await admin
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (subscription?.stripe_subscription_id) {
      try {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (stripeKey) {
          await fetch(
            `https://api.stripe.com/v1/subscriptions/${subscription.stripe_subscription_id}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${stripeKey}`,
              },
            }
          );
        }
      } catch (stripeError) {
        console.error("Failed to cancel Stripe subscription:", stripeError);
        // Continue with deletion even if Stripe fails
      }
    }

    // 7. Delete subscriptions
    await admin
      .from("subscriptions")
      .delete()
      .eq("user_id", userId);

    // 8. Delete user events
    await admin
      .from("user_events")
      .delete()
      .eq("user_id", userId);

    // 9. Delete user verification records
    await admin
      .from("user_verification")
      .delete()
      .eq("user_id", userId);

    // 10. Delete the user record + sign out
    try {
      await admin.rpc("delete_user_cascade", { target_user_id: userId });
    } catch {
      // If RPC doesn't exist, delete from users table directly
      await admin
        .from("users")
        .delete()
        .eq("id", userId);
    }

    // Sign out via the cookie-auth client
    await supabase.auth.signOut();

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
