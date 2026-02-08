"use client";

/**
 * Health Data Hook
 *
 * Client hook for fetching and managing Blue Button health data.
 * Reads from /api/fhir/data (which reads from fhir_cache).
 */

import { useState, useEffect, useCallback } from "react";
import type {
  PatientSummary,
  CoverageSummary,
  ClaimSummary,
  LabResult,
  DiagnosisSummary,
  MedicationSummary,
} from "@/lib/fhir/transforms";

interface UseHealthDataReturn {
  patient: PatientSummary | null;
  coverage: CoverageSummary[];
  claims: ClaimSummary[];
  labs: LabResult[];
  conditions: DiagnosisSummary[];
  medications: MedicationSummary[];
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
      setLastSynced(data.lastSynced ? new Date(data.lastSynced) : null);
    } catch {
      setError("Unable to connect. Please try again.");
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
        setLastSynced(null);
      }
    } catch {
      setError("Failed to disconnect. Please try again.");
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return {
    patient,
    coverage,
    claims,
    labs,
    conditions,
    medications,
    isConnected,
    isLoading,
    lastSynced,
    error,
    connect,
    disconnect,
    refresh,
  };
}
