"use client";

import { useState } from "react";

export interface CaseRow {
  id: string;
  caseRef: string;
  clientInitials: string | null;
  clientState: string | null;
  denialCode: string | null;
  procedureDescription: string | null;
  denialDate: string | null;
  status: string;
  outcome: string | null;
  outcomeDate: string | null;
  createdAt: string;
}

interface CaseListProps {
  cases: CaseRow[];
  onReportOutcome?: (caseId: string, outcome: string) => void;
}

type StatusFilter = "all" | "open" | "appeal_filed" | "outcome_reported" | "closed";

export default function CaseList({ cases, onReportOutcome }: CaseListProps) {
  const [filter, setFilter] = useState<StatusFilter>("all");

  const filteredCases = filter === "all"
    ? cases
    : cases.filter((c) => c.status === filter);

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      open: "bg-blue-100 text-blue-700",
      appeal_filed: "bg-violet-100 text-violet-700",
      outcome_reported: "bg-green-100 text-green-700",
      closed: "bg-slate-100 text-slate-600",
    };
    const labels: Record<string, string> = {
      open: "Open",
      appeal_filed: "Filed",
      outcome_reported: "Reported",
      closed: "Closed",
    };
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.open}`}>
        {labels[status] || status}
      </span>
    );
  };

  const outcomeBadge = (outcome: string | null) => {
    if (!outcome) return null;
    const styles: Record<string, string> = {
      approved: "text-green-600",
      denied: "text-red-600",
      partial: "text-amber-600",
    };
    return (
      <span className={`font-medium ${styles[outcome] || ""}`}>
        {outcome.charAt(0).toUpperCase() + outcome.slice(1)}
      </span>
    );
  };

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {(["all", "open", "appeal_filed", "outcome_reported", "closed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors min-h-[36px] ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f === "all" ? "All" : f === "appeal_filed" ? "Filed" : f === "outcome_reported" ? "Reported" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Case table */}
      {filteredCases.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          No cases found.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-4 font-medium">Case</th>
                <th className="pb-2 pr-4 font-medium">Denial</th>
                <th className="pb-2 pr-4 font-medium">Procedure</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Outcome</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 pr-4">
                    <span className="font-mono font-medium text-slate-900">{c.caseRef}</span>
                    {c.clientState && (
                      <span className="ml-1 text-slate-400 text-xs">{c.clientState}</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 font-mono text-slate-600">{c.denialCode || "--"}</td>
                  <td className="py-3 pr-4 text-slate-700 max-w-[200px] truncate">
                    {c.procedureDescription || "--"}
                  </td>
                  <td className="py-3 pr-4">{statusBadge(c.status)}</td>
                  <td className="py-3 pr-4">{outcomeBadge(c.outcome) || "--"}</td>
                  <td className="py-3">
                    {c.status === "appeal_filed" && !c.outcome && onReportOutcome && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => onReportOutcome(c.id, "approved")}
                          className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 min-h-[28px]"
                        >
                          Approved
                        </button>
                        <button
                          onClick={() => onReportOutcome(c.id, "denied")}
                          className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 min-h-[28px]"
                        >
                          Denied
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
