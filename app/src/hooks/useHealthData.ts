"use client";

/**
 * Health Data Hook
 *
 * Client hook for fetching and managing Blue Button health data.
 * Reads from /api/fhir/data (which reads from fhir_cache).
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { cacheSet, cacheGetIfFresh, STORES, TTL } from "@/lib/offline-cache";
import type {
  PatientSummary,
  CoverageSummary,
  ClaimSummary,
  LabResult,
  DiagnosisSummary,
  MedicationSummary,
  ScreeningHistory,
  ProviderDetail,
  HospitalizationSummary,
} from "@/lib/fhir/transforms";
import { computeDashboardMetrics, type HealthDashboardMetrics } from "@/lib/health-analytics";

interface UseHealthDataReturn {
  patient: PatientSummary | null;
  coverage: CoverageSummary[];
  claims: ClaimSummary[];
  labs: LabResult[];
  conditions: DiagnosisSummary[];
  medications: MedicationSummary[];
  screenings: ScreeningHistory[];
  providers: ProviderDetail[];
  hospitalizations: HospitalizationSummary[];
  metrics: HealthDashboardMetrics;
  isConnected: boolean;
  isLoading: boolean;
  lastSynced: Date | null;
  error: string | null;
  connect: () => void;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useHealthData(): UseHealthDataReturn {
  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [coverage, setCoverage] = useState<CoverageSummary[]>([]);
  const [claims, setClaims] = useState<ClaimSummary[]>([]);
  const [labs, setLabs] = useState<LabResult[]>([]);
  const [conditions, setConditions] = useState<DiagnosisSummary[]>([]);
  const [medications, setMedications] = useState<MedicationSummary[]>([]);
  const [screenings, setScreenings] = useState<ScreeningHistory[]>([]);
  const [providers, setProviders] = useState<ProviderDetail[]>([]);
  const [hospitalizations, setHospitalizations] = useState<HospitalizationSummary[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/fhir/data");
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to load health data");
        return;
      }

      setIsConnected(data.connected ?? false);
      setPatient(data.patient ?? null);
      setCoverage(data.coverage ?? []);
      setClaims(data.claims ?? []);
      setLabs(data.labs ?? []);
      setConditions(data.conditions ?? []);
      setMedications(data.medications ?? []);
      setScreenings(data.screenings ?? []);
      setProviders(data.providers ?? []);
      setHospitalizations(data.hospitalizations ?? []);
      setLastSynced(data.lastSynced ? new Date(data.lastSynced) : null);

      // Write-through: cache full health snapshot (fire-and-forget)
      cacheSet(STORES.HEALTH_DATA, "snapshot", {
        connected: data.connected,
        patient: data.patient,
        coverage: data.coverage,
        claims: data.claims,
        labs: data.labs,
        conditions: data.conditions,
        medications: data.medications,
        screenings: data.screenings,
        providers: data.providers,
        hospitalizations: data.hospitalizations,
        lastSynced: data.lastSynced,
      });
    } catch {
      // Offline fallback: try IndexedDB cache
      const cached = await cacheGetIfFresh<{
        connected: boolean;
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
      }>(STORES.HEALTH_DATA, "snapshot", TTL.HEALTH_DATA);

      if (cached) {
        const d = cached.data;
        setIsConnected(d.connected ?? false);
        setPatient(d.patient ?? null);
        setCoverage(d.coverage ?? []);
        setClaims(d.claims ?? []);
        setLabs(d.labs ?? []);
        setConditions(d.conditions ?? []);
        setMedications(d.medications ?? []);
        setScreenings(d.screenings ?? []);
        setProviders(d.providers ?? []);
        setHospitalizations(d.hospitalizations ?? []);
        setLastSynced(d.lastSynced ? new Date(d.lastSynced) : null);
      } else {
        setError("Unable to connect. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const connect = useCallback(() => {
    // Redirect to OAuth flow
    window.location.href = "/api/fhir/authorize";
  }, []);

  const disconnect = useCallback(async () => {
    try {
      const res = await fetch("/api/fhir/disconnect", { method: "POST" });
      if (res.ok) {
        setIsConnected(false);
        setPatient(null);
        setCoverage([]);
        setClaims([]);
        setLabs([]);
        setConditions([]);
        setMedications([]);
        setScreenings([]);
        setProviders([]);
        setHospitalizations([]);
        setLastSynced(null);
      }
    } catch {
      setError("Failed to disconnect. Please try again.");
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const metrics = useMemo(
    () => computeDashboardMetrics(claims, coverage),
    [claims, coverage]
  );

  return {
    patient,
    coverage,
    claims,
    labs,
    conditions,
    medications,
    screenings,
    providers,
    hospitalizations,
    metrics,
    isConnected,
    isLoading,
    lastSynced,
    error,
    connect,
    disconnect,
    refresh,
  };
}
