/**
 * Account Deletion API Route
 *
 * DELETE /api/account/delete
 *
 * Deletes user account and all associated data (GDPR/CCPA compliance).
 * This is a destructive operation and cannot be undone.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient();

    // Get user from auth header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401 }
      );
    }

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    const userId = user.id;
    const phone = user.phone;

    // Start deletion process
    // Order matters due to foreign key constraints

    // 1. Delete user feedback
    await supabase
      .from("user_feedback")
      .delete()
      .eq("user_id", userId);

    // 2. Delete messages from user's conversations
    const { data: conversations } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", userId);

    if (conversations && conversations.length > 0) {
      const conversationIds = conversations.map((c) => c.id);
      await supabase
        .from("messages")
        .delete()
        .in("conversation_id", conversationIds);
    }

    // 3. Delete appeals
    await supabase
      .from("appeals")
      .delete()
      .eq("user_id", userId);

    // 4. Delete conversations
    await supabase
      .from("conversations")
      .delete()
      .eq("user_id", userId);

    // 5. Delete usage record
    if (phone) {
      await supabase
        .from("usage")
        .delete()
        .eq("phone", phone);
    }

    // 6. Cancel any active subscriptions via Stripe
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (subscription?.stripe_subscription_id) {
      try {
        // Cancel Stripe subscription
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
    await supabase
      .from("subscriptions")
      .delete()
      .eq("user_id", userId);

    // 8. Delete user events
    await supabase
      .from("user_events")
      .delete()
      .eq("user_id", userId);

    // 9. Delete user verification records
    await supabase
      .from("user_verification")
      .delete()
      .eq("user_id", userId);

    // 10. Delete the user from auth
    // Note: This requires service role key, so we use RPC if available
    try {
      await supabase.rpc("delete_user_cascade", { target_user_id: userId });
    } catch (rpcError) {
      // If RPC doesn't exist, delete from users table
      await supabase
        .from("users")
        .delete()
        .eq("id", userId);

      // Sign out the user (this invalidates their session)
      await supabase.auth.signOut();
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
