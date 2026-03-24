"use client";

/**
 * useHealthReport — Client hook for health report management
 *
 * Returns: { report, isLoading, isGenerating, shareUrl, regenerate, emailReport }
 * Polls status while generating (3s interval, max 60s).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { HealthReport } from "@/lib/health-report";

interface ReportData {
  id: string;
  status: "pending" | "generating" | "ready" | "failed";
  shareToken: string;
  data: HealthReport | null;
  expiresAt: string | null;
  createdAt: string;
}

interface UseHealthReportReturn {
  report: ReportData | null;
  isLoading: boolean;
  isGenerating: boolean;
  shareUrl: string | null;
  regenerate: () => Promise<void>;
  emailReport: (recipientEmail: string, recipientName?: string) => Promise<boolean>;
}

export function useHealthReport(): UseHealthReportReturn {
  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  // Fetch latest report
  const fetchReport = useCallback(async () => {
    try {
      const res = await fetch("/api/health-report", {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) return;
        return;
      }
      const data = await res.json();
      if (data.report) {
        setReport(data.report);
        if (data.report.status === "generating") {
          setIsGenerating(true);
        } else {
          setIsGenerating(false);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Poll while generating
  useEffect(() => {
    if (!isGenerating) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      pollCountRef.current = 0;
      return;
    }

    pollCountRef.current = 0;
    pollRef.current = setInterval(async () => {
      pollCountRef.current++;
      if (pollCountRef.current > 20) {
        // Max 60s (20 * 3s)
        setIsGenerating(false);
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }
      await fetchReport();
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isGenerating, fetchReport]);

  // Initial fetch
  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Generate / regenerate report
  const regenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/health-report/generate", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setReport((prev) =>
          prev
            ? { ...prev, id: data.id, status: "generating", shareToken: data.shareToken }
            : {
                id: data.id,
                status: "generating",
                shareToken: data.shareToken,
                data: null,
                expiresAt: null,
                createdAt: new Date().toISOString(),
              }
        );
      } else {
        setIsGenerating(false);
      }
    } catch {
      setIsGenerating(false);
    }
  }, []);

  // Email report
  const emailReport = useCallback(
    async (recipientEmail: string, recipientName?: string): Promise<boolean> => {
      if (!report?.id) return false;
      try {
        const res = await fetch("/api/health-report/email", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportId: report.id,
            recipientEmail,
            recipientName,
          }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [report?.id]
  );

  // Build share URL
  const shareUrl = report?.shareToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/report/${report.shareToken}`
    : null;

  return {
    report,
    isLoading,
    isGenerating,
    shareUrl,
    regenerate,
    emailReport,
  };
}
