/**
 * CMS Metadata API
 *
 * GET /api/cms-metadata
 *
 * Public endpoint returning app metadata for CMS directory listing.
 * CMS criteria A3 (review participation), A5 (discovery experience).
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    app: {
      name: "DenaliHealth",
      version: "1.0.0",
      description:
        "Medicare coverage guidance and appeal letter generation powered by AI. Helps Original Medicare beneficiaries understand coverage, prevent claim denials, and appeal denied claims.",
      url: "https://denali.health",
      privacyPolicyUrl: "https://denali.health/faq",
      contactEmail: "support@denali.health",
    },
    cms: {
      categories: [
        "Conversational AI Assistants",
        "Diabetes & Obesity Prevention",
      ],
      frameworkVersion: "2025",
      earlyAdopter: true,
    },
    compliance: {
      "A1_IAL2_Auth": { status: "in_progress", notes: "Passkey/WebAuthn enrollment available; full IAL2 pending CMS credential service" },
      "A2_Medicare_Notifications": { status: "planned", notes: "Blue Button 2.0 integrated; Medicare.gov notification bridge in development" },
      "A3_CMS_Review": { status: "in_progress", notes: "Data source inventory and security checklist in preparation" },
      "A4_Trial_Access": { status: "done", notes: "30-day free trial for Medicare beneficiaries" },
      "A5_CMS_Directory": { status: "in_progress", notes: "App metadata endpoint available at /api/cms-metadata" },
      "A6_HIPAA": { status: "in_progress", notes: "BAA with Supabase/Vercel in progress" },
      "Audit_Logging": { status: "done", notes: "All sensitive operations logged to audit_logs table" },
      "Consent_Preferences": { status: "done", notes: "User-controlled consent for health data AI, storage, and analytics" },
      "AI_Disclosure": { status: "done", notes: "All AI responses marked with AI-generated disclaimer" },
    },
    trial: {
      available: true,
      durationDays: 30,
      includesAppeals: true,
    },
    dataConnections: {
      blueButton: {
        version: "2.0",
        scopes: "patient/Patient.read patient/Coverage.read patient/ExplanationOfBenefit.read",
        tokenEncryption: "AES-256-GCM",
        cacheRefreshHours: 24,
      },
    },
  });
}
