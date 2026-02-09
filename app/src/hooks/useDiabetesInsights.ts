"use client";

import { useState, useEffect, useCallback } from "react";

export interface StoredInsight {
  id: string;
  summary: string;
  recommendations: string[];
  risk_alerts: Array<{ severity: string; message: string }>;
  screening_reminders: Array<{ message: string }>;
  generated_at: string;
  classification: string;
}

interface UseDiabetesInsightsReturn {
  insight: StoredInsight | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useDiabetesInsights(): UseDiabetesInsightsReturn {
  const [insight, setInsight] = useState<StoredInsight | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInsight = async () => {
      try {
        const res = await fetch("/api/diabetes/insights");
        if (res.ok) {
          const data = await res.json();
          setInsight(data.insight ?? null);
        }
      } catch (err) {
        console.warn("[DiabetesInsights] Fetch failed:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInsight();
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/diabetes/insights", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setInsight(data.insight ?? null);
      }
    } catch (err) {
      console.warn("[DiabetesInsights] Refresh failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { insight, isLoading, refresh };
}
