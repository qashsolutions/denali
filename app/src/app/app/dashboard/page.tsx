"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { CaseList, OutcomeStats } from "@/components/dashboard";
import type { CaseRow, CounselorStats } from "@/components/dashboard";

export default function AppDashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [stats, setStats] = useState<CounselorStats | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.push("/app");
        return;
      }

      const uid = session.user.id;
      setUserId(uid);

      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", uid)
        .single();

      if (
        !profile ||
        (profile.role !== "counselor" && profile.role !== "provider")
      ) {
        router.push("/app");
        return;
      }

      setRole(profile.role);

      const { data: statsData } = await supabase.rpc("get_counselor_stats", {
        p_counselor_id: uid,
      });

      if (statsData && statsData.length > 0) {
        const s = statsData[0];
        setStats({
          openCases: Number(s.open_cases) || 0,
          filedThisMonth: Number(s.filed_this_month) || 0,
          outcomesReported: Number(s.outcomes_reported) || 0,
          approvedCount: Number(s.approved_count) || 0,
          deniedCount: Number(s.denied_count) || 0,
          partialCount: Number(s.partial_count) || 0,
          avgResolutionDays: s.avg_resolution_days
            ? Number(s.avg_resolution_days)
            : null,
        });
      }

      const { data: casesData } = await supabase
        .from("counselor_cases")
        .select("*")
        .eq("counselor_id", uid)
        .order("created_at", { ascending: false })
        .limit(100);

      if (casesData) {
        setCases(
          casesData.map((c) => ({
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

      setIsLoading(false);
    }

    init();
  }, [supabase, router]);

  const handleReportOutcome = useCallback(
    async (caseId: string, outcome: string) => {
      const { error } = await supabase
        .from("counselor_cases")
        .update({
          outcome,
          outcome_date: new Date().toISOString().split("T")[0],
          status: "outcome_reported",
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseId);

      if (!error) {
        setCases((prev) =>
          prev.map((c) =>
            c.id === caseId
              ? {
                  ...c,
                  outcome,
                  status: "outcome_reported",
                  outcomeDate: new Date().toISOString().split("T")[0],
                }
              : c
          )
        );

        if (userId) {
          const { data: statsData } = await supabase.rpc(
            "get_counselor_stats",
            { p_counselor_id: userId }
          );
          if (statsData && statsData.length > 0) {
            const s = statsData[0];
            setStats({
              openCases: Number(s.open_cases) || 0,
              filedThisMonth: Number(s.filed_this_month) || 0,
              outcomesReported: Number(s.outcomes_reported) || 0,
              approvedCount: Number(s.approved_count) || 0,
              deniedCount: Number(s.denied_count) || 0,
              partialCount: Number(s.partial_count) || 0,
              avgResolutionDays: s.avg_resolution_days
                ? Number(s.avg_resolution_days)
                : null,
            });
          }
        }
      }
    },
    [supabase, userId]
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
