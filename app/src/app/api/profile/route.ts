/**
 * Profile API Route
 *
 * GET /api/profile
 *
 * Returns the authenticated user's profile (plan, role, is_admin, appeal count).
 * Uses server-side Supabase client (cookie-authenticated) — browser client
 * .from("users").select() is unreliable with stale tokens.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("plan, role, is_admin")
    .eq("id", user.id)
    .single();

  let appealCount = 0;
  let appealCredits = 0;
  if (user.email) {
    const { data: usage } = await supabase
      .from("usage")
      .select("appeal_count, appeal_credits")
      .eq("email", user.email)
      .single();
    appealCount = usage?.appeal_count || 0;
    appealCredits = usage?.appeal_credits || 0;
  }

  return NextResponse.json({
    authenticated: true,
    plan: profile?.plan || "trial",
    role: profile?.role || "patient",
    isAdmin: profile?.is_admin || false,
    appealCount,
    appealCredits,
  });
}
