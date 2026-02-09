/**
 * Health Data Sync
 *
 * Orchestrates fetching from Blue Button → transform → cache in Supabase.
 * Health page + chat read from fhir_cache, never call CMS API directly.
 */

import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getValidToken } from "./tokens";
import { fhirGet, fhirGetBundle } from "./client";
import type { Json } from "@/types/database";
import {
  transformPatient,
  transformCoverage,
  transformEOB,
  extractDiabetesLabs,
  extractDiabetesConditions,
  extractDiabetesMedications,
  type PatientSummary,
  type CoverageSummary,
  type ClaimSummary,
  type LabResult,
  type DiagnosisSummary,
  type MedicationSummary,
} from "./transforms";
import { appendDiabetesSnapshots } from "./snapshots";

export interface HealthData {
  patient: PatientSummary | null;
  coverage: CoverageSummary[];
  claims: ClaimSummary[];
  labs: LabResult[];
  conditions: DiagnosisSummary[];
  medications: MedicationSummary[];
  lastSynced: string | null;
}

/**
 * Fetch fresh data from Blue Button, transform, and cache.
 */
export async function syncHealthData(userId: string): Promise<HealthData> {
  const tokenPair = await getValidToken(userId);
  if (!tokenPair) {
    throw new Error("No active Blue Button connection or token expired");
  }

  const { accessToken, fhirPatientId } = tokenPair;
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Fetch Patient, Coverage, EOBs, Observations, Conditions, Medications in parallel
  const [patientRaw, coverageRaw, eobsRaw, observationsRaw, conditionsRaw, medsRaw] = await Promise.all([
    fhirPatientId
      ? fhirGet<Record<string, unknown>>(`Patient/${fhirPatientId}`, accessToken)
      : fhirGet<Record<string, unknown>>("Patient", accessToken),
    fhirGetBundle<Record<string, unknown>>("Coverage", accessToken),
    fhirGetBundle<Record<string, unknown>>(
      "ExplanationOfBenefit?_sort=-_lastUpdated",
      accessToken,
      3 // max 3 pages = ~150 EOBs
    ),
    fhirGetBundle<Record<string, unknown>>(
      "Observation?category=laboratory&_sort=-date&_count=50",
      accessToken,
      1 // 1 page — lab results are typically small
    ).catch(() => [] as Record<string, unknown>[]), // Graceful: labs are optional
    fhirGetBundle<Record<string, unknown>>(
      "Condition?category=encounter-diagnosis",
      accessToken,
      1
    ).catch(() => [] as Record<string, unknown>[]), // Graceful: conditions are optional
    fhirGetBundle<Record<string, unknown>>(
      "MedicationRequest?_sort=-date&_count=50",
      accessToken,
      1
    ).catch(() => [] as Record<string, unknown>[]), // Graceful: medications are optional
  ]);

  // Transform
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patient = transformPatient(patientRaw as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const coverage = coverageRaw.map((c) => transformCoverage(c as any));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const claims = eobsRaw.map((e) => transformEOB(e as any));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const labs = extractDiabetesLabs(observationsRaw as any[]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions = extractDiabetesConditions(conditionsRaw as any[]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const medications = extractDiabetesMedications(medsRaw as any[]);

  // Cache transformed data (upsert per resource type)
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await Promise.all([
    admin.from("fhir_cache").upsert(
      { user_id: userId, resource_type: "patient", data: patient as unknown as Json, cached_at: now, expires_at: expires },
      { onConflict: "user_id,resource_type" }
    ),
    admin.from("fhir_cache").upsert(
      { user_id: userId, resource_type: "coverage", data: coverage as unknown as Json, cached_at: now, expires_at: expires },
      { onConflict: "user_id,resource_type" }
    ),
    admin.from("fhir_cache").upsert(
      { user_id: userId, resource_type: "eob", data: claims as unknown as Json, cached_at: now, expires_at: expires },
      { onConflict: "user_id,resource_type" }
    ),
    admin.from("fhir_cache").upsert(
      { user_id: userId, resource_type: "labs", data: labs as unknown as Json, cached_at: now, expires_at: expires },
      { onConflict: "user_id,resource_type" }
    ),
    admin.from("fhir_cache").upsert(
      { user_id: userId, resource_type: "conditions", data: conditions as unknown as Json, cached_at: now, expires_at: expires },
      { onConflict: "user_id,resource_type" }
    ),
    admin.from("fhir_cache").upsert(
      { user_id: userId, resource_type: "medications", data: medications as unknown as Json, cached_at: now, expires_at: expires },
      { onConflict: "user_id,resource_type" }
    ),
  ]);

  // Append labs to longitudinal snapshot history (fire-and-forget)
  appendDiabetesSnapshots(userId, labs).catch((err) =>
    console.warn("[Sync] Snapshot append failed:", err)
  );

  // Update last_synced_at on the connection
  await admin
    .from("ehr_connections")
    .update({ last_synced_at: now, updated_at: now })
    .eq("user_id", userId)
    .eq("provider", "bluebutton");

  return { patient, coverage, claims, labs, conditions, medications, lastSynced: now };
}

/**
 * Read cached health data (uses RLS — call from authenticated context).
 */
export async function getCachedHealthData(userId: string): Promise<HealthData | null> {
  const supabase = await createServerSupabaseClient();

  const { data: rows, error } = await supabase
    .from("fhir_cache")
    .select("resource_type, data, cached_at, expires_at")
    .eq("user_id", userId);

  if (error || !rows || rows.length === 0) return null;

  let patient: PatientSummary | null = null;
  let coverage: CoverageSummary[] = [];
  let claims: ClaimSummary[] = [];
  let labs: LabResult[] = [];
  let conditions: DiagnosisSummary[] = [];
  let medications: MedicationSummary[] = [];
  let lastSynced: string | null = null;

  for (const row of rows) {
    // Check if cache has expired
    if (row.expires_at && new Date(row.expires_at) < new Date()) continue;

    if (row.resource_type === "patient") {
      patient = row.data as unknown as PatientSummary;
    } else if (row.resource_type === "coverage") {
      coverage = row.data as unknown as CoverageSummary[];
    } else if (row.resource_type === "eob") {
      claims = row.data as unknown as ClaimSummary[];
    } else if (row.resource_type === "labs") {
      labs = row.data as unknown as LabResult[];
    } else if (row.resource_type === "conditions") {
      conditions = row.data as unknown as DiagnosisSummary[];
    } else if (row.resource_type === "medications") {
      medications = row.data as unknown as MedicationSummary[];
    }

    if (row.cached_at && (!lastSynced || row.cached_at > lastSynced)) {
      lastSynced = row.cached_at;
    }
  }

  if (!patient && coverage.length === 0 && claims.length === 0) return null;

  return { patient, coverage, claims, labs, conditions, medications, lastSynced };
}

