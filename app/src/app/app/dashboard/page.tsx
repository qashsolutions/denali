"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CaseList, OutcomeStats } from "@/components/dashboard";
import type { CaseRow, CounselorStats } from "@/components/dashboard";

export default function AppDashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [stats, setStats] = useState<CounselorStats | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const loadStats = useCallback(async (uid: string) => {
    try {
      const res = await fetch("/api/counselor/stats", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const s = data.stats;
      if (s) {
        setStats({
          openCases: Number(s.open_cases) || 0,
          filedThisMonth: Number(s.filed_this_month) || 0,
          outcomesReported: Number(s.outcomes_reported) || 0,
          approvedCount: Number(s.approved_count) || 0,
          deniedCount: Number(s.denied_count) || 0,
          partialCount: Number(s.partial_count) || 0,
          avgResolutionDays: s.avg_resolution_days ? Number(s.avg_resolution_days) : null,
        });
      }
    } catch (err) {
      console.error("[dashboard] loadStats failed:", err);
    }
    // uid param reserved for future per-user filtering
    void uid;
  }, []);

  useEffect(() => {
    async function init() {
      // Auth + role check via profile API
      const profileRes = await fetch("/api/profile", { credentials: "include" });
      if (!profileRes.ok) { router.push("/app"); return; }
      const profile = await profileRes.json();

      if (!profile.authenticated) { router.push("/app"); return; }
      if (profile.role !== "counselor" && profile.role !== "provider") {
        router.push("/app");
        return;
      }

      setUserId(profile.userId ?? null);
      setRole(profile.role);

      // Load cases
      const casesRes = await fetch("/api/counselor/cases", { credentials: "include" });
      if (casesRes.ok) {
        const data = await casesRes.json();
        setCases(
          (data.cases || []).map((c: {
            id: string;
            case_ref: string;
            client_initials: string | null;
            client_state: string | null;
            denial_code: string | null;
            procedure_description: string | null;
            denial_date: string | null;
            status: string;
            outcome: string | null;
            outcome_date: string | null;
            created_at: string;
          }) => ({
            id: c.id,
            caseRef: c.case_ref,
            clientInitials: c.client_initials,
            clientState: c.client_state,
            denialCode: c.denial_code,
            procedureDescription: c.procedure_description,
            denialDate: c.denial_date,
            status: c.status,
            outcome: c.outcome,
            outcomeDate: c.outcome_date,
            createdAt: c.created_at ?? new Date().toISOString(),
          }))
        );
      }

      await loadStats(profile.userId ?? "");
      setIsLoading(false);
    }

    init();
  }, [router, loadStats]);

  const handleReportOutcome = useCallback(
    async (caseId: string, outcome: string) => {
      const res = await fetch("/api/counselor/cases", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, outcome }),
      });

      if (res.ok) {
        setCases((prev) =>
          prev.map((c) =>
            c.id === caseId
              ? { ...c, outcome, status: "outcome_reported", outcomeDate: new Date().toISOString().split("T")[0] }
              : c
          )
        );
        if (userId) loadStats(userId);
      }
    },
    [userId, loadStats]
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[var(--text-secondary)]">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            {role === "counselor" ? "Counselor Dashboard" : "Provider Dashboard"}
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Case management and outcome tracking
          </p>
        </div>
        <a
          href="/app/claims?mode=new-case"
          className="inline-flex items-center px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:opacity-90 transition-colors font-medium min-h-[44px]"
        >
          + New Case
        </a>
      </div>

      {stats && (
        <div className="mb-8">
          <OutcomeStats stats={stats} />
        </div>
      )}

      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          Cases
        </h2>
        <CaseList cases={cases} onReportOutcome={handleReportOutcome} />
      </div>
    </div>
  );
}
