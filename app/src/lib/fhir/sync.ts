/**
 * Health Data Sync
 *
 * Orchestrates fetching from Blue Button → transform → cache in RDS PostgreSQL.
 * Health page + chat read from fhir_cache, never call CMS API directly.
 */

import { query } from "@/lib/db";
import { getValidToken } from "./tokens";
import { fhirGet, fhirGetBundle } from "./client";
import {
  transformPatient,
  transformCoverage,
  transformEOB,
  type PatientSummary,
  type CoverageSummary,
  type ClaimSummary,
  type LabResult,
  type DiagnosisSummary,
  type MedicationSummary,
  type ScreeningHistory,
  type ProviderDetail,
  type HospitalizationSummary,
} from "./transforms";
import {
  extractConditionsFromClaims,
  extractMedicationsFromClaims,
  extractScreeningsFromClaims,
  extractProvidersFromClaims,
  extractHospitalizationsFromClaims,
} from "./eob-clinical";

export interface HealthData {
  patient: PatientSummary | null;
  coverage: CoverageSummary[];
  claims: ClaimSummary[];
  labs: LabResult[];
  conditions: DiagnosisSummary[];
  medications: MedicationSummary[];
  screenings: ScreeningHistory[];
  providers: ProviderDetail[];
  hospitalizations: HospitalizationSummary[];
  lastSynced: string | null;
}

const UPSERT_FHIR_CACHE = `
  INSERT INTO fhir_cache (user_id, resource_type, data, cached_at, expires_at)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (user_id, resource_type) DO UPDATE
    SET data = EXCLUDED.data,
        cached_at = EXCLUDED.cached_at,
        expires_at = EXCLUDED.expires_at
`;

/**
 * Fetch fresh data from Blue Button, transform, and cache.
 */
export async function syncHealthData(userId: string): Promise<HealthData> {
  const tokenPair = await getValidToken(userId);
  if (!tokenPair) {
    throw new Error("No active Medicare connection or token expired");
  }

  const { accessToken, fhirPatientId } = tokenPair;
  const now = new Date().toISOString();

  // Blue Button 2.0 only provides Patient, Coverage, and ExplanationOfBenefit.
  const [patientRaw, coverageRaw, eobsRaw] = await Promise.all([
    fhirPatientId
      ? fhirGet<Record<string, unknown>>(`Patient/${fhirPatientId}`, accessToken)
      : fhirGet<Record<string, unknown>>("Patient", accessToken),
    fhirGetBundle<Record<string, unknown>>("Coverage", accessToken),
    fhirGetBundle<Record<string, unknown>>(
      "ExplanationOfBenefit?_sort=-_lastUpdated",
      accessToken,
      3 // max 3 pages = ~150 EOBs
    ),
  ]);

  // Transform
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patient = transformPatient(patientRaw as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const coverage = coverageRaw.map((c) => transformCoverage(c as any));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const claims = eobsRaw.map((e) => transformEOB(e as any));

  // Extract clinical intelligence from EOB claims
  const labs: LabResult[] = []; // No lab values available from EOBs
  const conditions = extractConditionsFromClaims(claims);
  const medications = extractMedicationsFromClaims(claims);
  const screenings = extractScreeningsFromClaims(claims);
  const providers = extractProvidersFromClaims(claims);
  const hospitalizations = extractHospitalizationsFromClaims(claims);

  // Cache transformed data
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await Promise.all([
    query(UPSERT_FHIR_CACHE, [userId, "patient", JSON.stringify(patient), now, expires]),
    query(UPSERT_FHIR_CACHE, [userId, "coverage", JSON.stringify(coverage), now, expires]),
    query(UPSERT_FHIR_CACHE, [userId, "eob", JSON.stringify(claims), now, expires]),
    query(UPSERT_FHIR_CACHE, [userId, "conditions", JSON.stringify(conditions), now, expires]),
    query(UPSERT_FHIR_CACHE, [userId, "medications", JSON.stringify(medications), now, expires]),
    query(UPSERT_FHIR_CACHE, [userId, "screenings", JSON.stringify(screenings), now, expires]),
    query(UPSERT_FHIR_CACHE, [userId, "providers", JSON.stringify(providers), now, expires]),
    query(UPSERT_FHIR_CACHE, [userId, "hospitalizations", JSON.stringify(hospitalizations), now, expires]),
  ]);

  // Update last_synced_at on the connection
  await query(
    `UPDATE ehr_connections SET last_synced_at = $1, updated_at = $1
     WHERE user_id = $2 AND provider = 'bluebutton'`,
    [now, userId]
  );

  return { patient, coverage, claims, labs, conditions, medications, screenings, providers, hospitalizations, lastSynced: now };
}

/**
 * Read cached health data from RDS.
 */
export async function getCachedHealthData(userId: string): Promise<HealthData | null> {
  const result = await query<{ resource_type: string; data: unknown; cached_at: string | null; expires_at: string | null }>(
    `SELECT resource_type, data, cached_at, expires_at FROM fhir_cache WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) return null;

  let patient: PatientSummary | null = null;
  let coverage: CoverageSummary[] = [];
  let claims: ClaimSummary[] = [];
  const labs: LabResult[] = [];
  let conditions: DiagnosisSummary[] = [];
  let medications: MedicationSummary[] = [];
  let screenings: ScreeningHistory[] = [];
  let providers: ProviderDetail[] = [];
  let hospitalizations: HospitalizationSummary[] = [];
  let lastSynced: string | null = null;

  for (const row of result.rows) {
    // Check if cache has expired
    if (row.expires_at && new Date(row.expires_at) < new Date()) continue;

    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;

    if (row.resource_type === "patient") {
      patient = data as PatientSummary;
    } else if (row.resource_type === "coverage") {
      coverage = data as CoverageSummary[];
    } else if (row.resource_type === "eob") {
      claims = data as ClaimSummary[];
    } else if (row.resource_type === "labs") {
      // labs not populated from EOBs but kept for schema compatibility
    } else if (row.resource_type === "conditions") {
      conditions = data as DiagnosisSummary[];
    } else if (row.resource_type === "medications") {
      medications = data as MedicationSummary[];
    } else if (row.resource_type === "screenings") {
      screenings = data as ScreeningHistory[];
    } else if (row.resource_type === "providers") {
      providers = data as ProviderDetail[];
    } else if (row.resource_type === "hospitalizations") {
      hospitalizations = data as HospitalizationSummary[];
    }

    if (row.cached_at && (!lastSynced || row.cached_at > lastSynced)) {
      lastSynced = row.cached_at;
    }
  }

  if (!patient && coverage.length === 0 && claims.length === 0) return null;

  return { patient, coverage, claims, labs, conditions, medications, screenings, providers, hospitalizations, lastSynced };
}
