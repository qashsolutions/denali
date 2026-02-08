/**
 * Consent Preferences API
 *
 * GET  /api/consent — return user's consent preferences
 * PUT  /api/consent — update consent preference
 *
 * CMS criteria: Section I.5 (patient consent preferences)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";

const VALID_CONSENT_TYPES = [
  "health_data_ai",
  "health_data_storage",
  "analytics",
] as const;

type ConsentType = (typeof VALID_CONSENT_TYPES)[number];

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: prefs } = await supabase
      .from("consent_preferences")
      .select("consent_type, granted, version, updated_at")
      .eq("user_id", user.id);

    // Build a map of consent type → granted boolean
    const consent: Record<string, boolean> = {};
    for (const type of VALID_CONSENT_TYPES) {
      const pref = prefs?.find((p) => p.consent_type === type);
      consent[type] = pref?.granted ?? false;
    }

    return NextResponse.json({ consent });
  } catch (error) {
    console.error("[Consent] GET error:", error);
    return NextResponse.json({ error: "Failed to load consent" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { consentType, granted } = body as {
      consentType: string;
      granted: boolean;
    };

    if (!VALID_CONSENT_TYPES.includes(consentType as ConsentType)) {
      return NextResponse.json({ error: "Invalid consent type" }, { status: 400 });
    }

    if (typeof granted !== "boolean") {
      return NextResponse.json({ error: "granted must be a boolean" }, { status: 400 });
    }

    const now = new Date().toISOString();

    const { error: upsertError } = await supabase
      .from("consent_preferences")
      .upsert(
        {
          user_id: user.id,
          consent_type: consentType,
          granted,
          granted_at: granted ? now : null,
          revoked_at: granted ? null : now,
          updated_at: now,
        },
        { onConflict: "user_id,consent_type" }
      );

    if (upsertError) {
      console.error("[Consent] Upsert error:", upsertError);
      return NextResponse.json({ error: "Failed to update consent" }, { status: 500 });
    }

    logAudit("CONSENT_UPDATED", {
      userId: user.id,
      resourceType: "consent",
      metadata: { consentType, granted },
      request,
    }).catch(() => {});

    return NextResponse.json({ success: true, consentType, granted });
  } catch (error) {
    console.error("[Consent] PUT error:", error);
    return NextResponse.json({ error: "Failed to update consent" }, { status: 500 });
  }
}
