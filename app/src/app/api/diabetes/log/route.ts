/**
 * Diabetes Log API Route
 *
 * GET  /api/diabetes/log   — list user's entries (30 most recent)
 * POST /api/diabetes/log   — create entry
 * DELETE /api/diabetes/log?id=<id> — delete entry
 *
 * Auth required. Any signed-in user can use this.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";

const VALID_ENTRY_TYPES = ["glucose", "activity", "meal", "note"] as const;
const VALID_CONTEXTS = ["fasting", "before_meal", "after_meal", "bedtime", "other"] as const;

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: entries, error } = await supabase
      .from("diabetes_log")
      .select("id, logged_at, entry_type, glucose_value, glucose_context, activity_minutes, activity_type, note")
      .eq("user_id", user.id)
      .order("logged_at", { ascending: false })
      .limit(30);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
    }

    return NextResponse.json({ entries: entries ?? [] });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { entry_type, logged_at, glucose_value, glucose_context, activity_minutes, activity_type, note } = body;

    // Validate entry_type
    if (!entry_type || !VALID_ENTRY_TYPES.includes(entry_type)) {
      return NextResponse.json({ error: "Invalid entry_type" }, { status: 400 });
    }

    // Validate glucose_context if provided
    if (glucose_context && !VALID_CONTEXTS.includes(glucose_context)) {
      return NextResponse.json({ error: "Invalid glucose_context" }, { status: 400 });
    }

    // Validate activity_minutes if provided
    if (activity_minutes != null && (typeof activity_minutes !== "number" || activity_minutes <= 0)) {
      return NextResponse.json({ error: "activity_minutes must be positive" }, { status: 400 });
    }

    const { data: entry, error } = await supabase
      .from("diabetes_log")
      .insert({
        user_id: user.id,
        entry_type,
        logged_at: logged_at || new Date().toISOString(),
        glucose_value: entry_type === "glucose" ? glucose_value : null,
        glucose_context: entry_type === "glucose" ? glucose_context : null,
        activity_minutes: entry_type === "activity" ? activity_minutes : null,
        activity_type: entry_type === "activity" ? activity_type : null,
        note: ["meal", "note"].includes(entry_type) ? note : null,
      })
      .select()
      .single();

    if (error) {
      console.error("[DiabetesLog] Insert failed:", error);
      return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
    }

    logAudit("DIABETES_LOG_ENTRY", {
      userId: user.id,
      resourceType: "diabetes_log",
      resourceId: entry.id,
      metadata: { entry_type },
    }).catch(() => {});

    return NextResponse.json({ entry }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    // RLS ensures user can only delete own entries
    const { error } = await supabase
      .from("diabetes_log")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
