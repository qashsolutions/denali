/**
 * CMS Metadata API
 *
 * GET /api/cms-metadata
 *
 * Public endpoint returning app metadata for CMS directory listing.
 * CMS criteria A3 (review participation), A5 (discovery experience).
 */

import { NextResponse } from "next/server";
import { BRAND, PRICING, API_CONFIG } from "@/config";

export async function GET() {
  return NextResponse.json({
    app: {
      name: BRAND.NAME,
      version: "1.0.0",
      description:
        "Medicare coverage guidance and appeal letter generation powered by AI. Helps Original Medicare beneficiaries understand coverage, prevent claim denials, and appeal denied claims.",
      url: BRAND.SITE_URL,
      privacyPolicyUrl: `${BRAND.SITE_URL}/privacy`,
      contactEmail: "admin@denali.health",
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
      "A1_IAL2_Auth": { status: "done", notes: "Medicare OAuth via Medicare.gov satisfies IAL2/AAL2 (intermediary PHR path). TOTP MFA available as opt-in." },
      "A2_Medicare_Notifications": { status: "partial", notes: "MEDICARE_NOTIFICATIONS_SKILL detects FHIR changes. Medicare.gov bridge not yet available." },
      "A3_CMS_Review": { status: "in_progress", notes: "Data source inventory and security checklist in preparation" },
      "A4_Trial_Access": { status: "done", notes: `${PRICING.TRIAL_DURATION_DAYS}-day free trial for Medicare beneficiaries` },
      "A5_CMS_Directory": { status: "in_progress", notes: "App metadata endpoint available at /api/cms-metadata" },
      "A6_HIPAA": { status: "done", notes: "BAA with AWS (RDS, ECS/Fargate, Bedrock) executed 2026-02-25. Anthropic BAA in process." },
      "Audit_Logging": { status: "done", notes: "All sensitive operations logged to audit_logs table" },
      "Consent_Preferences": { status: "done", notes: "User-controlled consent for health data AI, storage, and analytics" },
      "AI_Disclosure": { status: "done", notes: "All AI responses marked with AI-generated disclaimer" },
    },
    trial: {
      available: true,
      durationDays: PRICING.TRIAL_DURATION_DAYS,
      includesAppeals: true,
    },
    dataConnections: {
      blueButton: {
        version: "2.0",
        scopes: API_CONFIG.blueButton.scopes,
        tokenEncryption: "AES-256-GCM",
        cacheRefreshHours: 24,
      },
    },
  });
}
