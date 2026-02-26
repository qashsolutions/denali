"use client";

import { useState, useEffect, useMemo } from "react";

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
    let cancelled = false;

    const fetchSnapshots = async () => {
      try {
        const res = await fetch("/api/diabetes/snapshots", {
          credentials: "include",
        });

        if (cancelled) return;

        if (!res.ok) {
          if (res.status !== 401) {
            console.warn("[Snapshots] Fetch failed:", res.status);
          }
          return;
        }

        const data = await res.json();
        if (!cancelled) {
          setSnapshots(data.snapshots || []);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.warn("[Snapshots] Error:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchSnapshots();
    return () => { cancelled = true; };
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
