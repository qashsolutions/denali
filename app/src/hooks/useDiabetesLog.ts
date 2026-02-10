"use client";

import { useState, useEffect, useCallback } from "react";
import { cacheSet, cacheGetIfFresh, queueOfflineRequest, STORES, TTL } from "@/lib/offline-cache";

export interface LogEntry {
  id: string;
  logged_at: string;
  entry_type: "glucose" | "activity" | "meal" | "note";
  glucose_value?: number | null;
  glucose_context?: string | null;
  activity_minutes?: number | null;
  activity_type?: string | null;
  note?: string | null;
}

export interface NewLogEntry {
  entry_type: LogEntry["entry_type"];
  logged_at?: string;
  glucose_value?: number;
  glucose_context?: string;
  activity_minutes?: number;
  activity_type?: string;
  note?: string;
}

interface UseDiabetesLogReturn {
  entries: LogEntry[];
  isLoading: boolean;
  addEntry: (entry: NewLogEntry) => Promise<boolean>;
  deleteEntry: (id: string) => Promise<boolean>;
}

export function useDiabetesLog(): UseDiabetesLogReturn {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/diabetes/log");
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries ?? []);
        // Write-through cache (fire-and-forget)
        cacheSet(STORES.DIABETES_LOG, "entries", data.entries ?? []);
      }
    } catch (err) {
      console.warn("[DiabetesLog] Fetch failed:", err);
      // Offline fallback
      const cached = await cacheGetIfFresh<LogEntry[]>(
        STORES.DIABETES_LOG,
        "entries",
        TTL.DIABETES_LOG
      );
      if (cached) {
        setEntries(cached.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const addEntry = useCallback(
    async (entry: NewLogEntry): Promise<boolean> => {
      const body = JSON.stringify(entry);
      try {
        const res = await fetch("/api/diabetes/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        if (res.ok) {
          const data = await res.json();
          setEntries((prev) => [data.entry, ...prev].slice(0, 30));
          return true;
        }
        return false;
      } catch {
        // Offline: optimistic local add + queue for sync
        const optimisticEntry: LogEntry = {
          id: `offline-${Date.now()}`,
          logged_at: entry.logged_at || new Date().toISOString(),
          entry_type: entry.entry_type,
          glucose_value: entry.glucose_value ?? null,
          glucose_context: entry.glucose_context ?? null,
          activity_minutes: entry.activity_minutes ?? null,
          activity_type: entry.activity_type ?? null,
          note: entry.note ?? null,
        };
        setEntries((prev) => [optimisticEntry, ...prev].slice(0, 30));
        queueOfflineRequest({
          url: "/api/diabetes/log",
          method: "POST",
          body,
        });
        return true;
      }
    },
    []
  );

  const deleteEntry = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/diabetes/log?id=${id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setEntries((prev) => prev.filter((e) => e.id !== id));
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    []
  );

  return { entries, isLoading, addEntry, deleteEntry };
}
