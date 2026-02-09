"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase";

export interface SnapshotPoint {
  value: number;
  date: string;       // ISO date "2026-01-15"
  loincCode: string;
  labName: string;
  unit: string;
}

interface UseDiabetesSnapshotsReturn {
  snapshots: SnapshotPoint[];
  a1cHistory: SnapshotPoint[];
  isLoading: boolean;
}

export function useDiabetesSnapshots(): UseDiabetesSnapshotsReturn {
  const [snapshots, setSnapshots] = useState<SnapshotPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSnapshots = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("diabetes_snapshots")
          .select("loinc_code, lab_name, value, unit, observed_date")
          .order("observed_date", { ascending: true });

        if (error) {
          console.warn("[Snapshots] Fetch failed:", error.message);
          return;
        }

        setSnapshots(
          (data ?? []).map((r) => ({
            value: Number(r.value),
            date: r.observed_date,
            loincCode: r.loinc_code,
            labName: r.lab_name,
            unit: r.unit,
          }))
        );
      } catch (err) {
        console.warn("[Snapshots] Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSnapshots();
  }, []);

  const a1cHistory = useMemo(
    () =>
      snapshots
        .filter((s) => s.labName.toLowerCase().includes("a1c"))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [snapshots]
  );

  return { snapshots, a1cHistory, isLoading };
}
