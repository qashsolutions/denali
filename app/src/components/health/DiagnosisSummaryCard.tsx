"use client";

import type { DiagnosisAggregate } from "@/lib/health-analytics";
import type { DiagnosisSummary } from "@/lib/fhir/transforms";

interface DiagnosisSummaryCardProps {
  diagnoses: DiagnosisAggregate[];
  conditions?: DiagnosisSummary[];
}

/** Check if a diagnosis name is garbage (numeric codes, too short, etc.) */
function isGarbageEntry(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 3) return true;
  if (/^\d+$/.test(trimmed)) return true;
  if (trimmed.toLowerCase() === "unknown") return true;
  return false;
}

/** Get severity color config based on condition category */
function getSeverityConfig(
  name: string,
  conditions: DiagnosisSummary[]
): { border: string; dot: string } {
  // Try to match by case-insensitive name comparison
  const lower = name.toLowerCase();
  const match = conditions.find(
    (c) => c.name.toLowerCase() === lower
  );

  if (match) {
    switch (match.category) {
      case "type1":
      case "type2":
        return { border: "border-l-red-500", dot: "bg-red-500" };
      case "pre-diabetic":
      case "other-diabetes":
      case "obesity":
        return { border: "border-l-amber-500", dot: "bg-amber-500" };
      default:
        return { border: "border-l-[var(--border)]", dot: "bg-[var(--text-muted)]" };
    }
  }

  // Keyword-based fallback for unmatched entries
  if (lower.includes("diabetes") && !lower.includes("pre-diabet")) {
    return { border: "border-l-red-500", dot: "bg-red-500" };
  }
  if (lower.includes("pre-diabet") || lower.includes("obesity") || lower.includes("overweight")) {
    return { border: "border-l-amber-500", dot: "bg-amber-500" };
  }

  return { border: "border-l-[var(--border)]", dot: "bg-[var(--text-muted)]" };
}

export function DiagnosisSummaryCard({ diagnoses, conditions = [] }: DiagnosisSummaryCardProps) {
  const filtered = diagnoses.filter((dx) => !isGarbageEntry(dx.name));

  if (filtered.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
        Conditions in Your Claims
      </h3>
      <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] divide-y divide-[var(--border)]">
        {filtered.map((dx, i) => {
          const severity = getSeverityConfig(dx.name, conditions);
          return (
            <div
              key={i}
              className={`px-4 py-3 flex items-center gap-3 border-l-3 ${severity.border}`}
            >
              <div className={`w-2 h-2 rounded-full ${severity.dot} shrink-0`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {dx.name}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-[var(--text-muted)]">
                  Seen {dx.count} time{dx.count !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Last: {dx.lastSeen}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
