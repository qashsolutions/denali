"use client";

/**
 * Lab Results Card
 *
 * Displays diabetes-relevant lab results from FHIR data.
 * Shows value, range indicator (green/amber/red), and date.
 */

import Link from "next/link";
import type { LabResult } from "@/lib/fhir/transforms";

interface LabResultsCardProps {
  labs: LabResult[];
}

export function LabResultsCard({ labs }: LabResultsCardProps) {
  if (labs.length === 0) return null;

  // Group by lab name, most recent first (already sorted by transforms)
  const latestByName = new Map<string, LabResult>();
  for (const lab of labs) {
    if (!latestByName.has(lab.name)) {
      latestByName.set(lab.name, lab);
    }
  }
  const latestLabs = Array.from(latestByName.values());

  // Find A1C trend if multiple values exist
  const a1cLabs = labs.filter(l => l.name.toLowerCase().includes("a1c"));
  const a1cTrend = a1cLabs.length >= 2
    ? getTrend(a1cLabs[0].value, a1cLabs[1].value)
    : null;

  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] p-5">
      <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
        Lab Results
      </h2>

      <div className="space-y-3">
        {latestLabs.map((lab, i) => (
          <LabRow
            key={i}
            lab={lab}
            trend={lab.name.toLowerCase().includes("a1c") ? a1cTrend : null}
          />
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--border)]">
        <Link
          href="/app/chat?message=What do my lab results mean?"
          className="text-sm font-medium text-[var(--accent-primary)] hover:underline"
        >
          Ask Denali about my labs
        </Link>
      </div>
    </div>
  );
}

function LabRow({ lab, trend }: { lab: LabResult; trend: string | null }) {
  const range = interpretRange(lab.name, lab.value);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${range.dotColor}`}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
            {lab.name}
          </p>
          <p className="text-xs text-[var(--text-muted)]">{lab.date}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {trend && (
          <span className="text-xs text-[var(--text-muted)]">{trend}</span>
        )}
        <span className={`text-sm font-semibold ${range.textColor}`}>
          {lab.value}{lab.unit}
        </span>
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${range.badgeBg} ${range.badgeColor}`}>
          {range.label}
        </span>
      </div>
    </div>
  );
}

function interpretRange(name: string, value: number): {
  label: string;
  dotColor: string;
  textColor: string;
  badgeBg: string;
  badgeColor: string;
} {
  const lower = name.toLowerCase();

  if (lower.includes("a1c") || lower.includes("hemoglobin a1c")) {
    if (value < 5.7) return { label: "Normal", dotColor: "bg-green-500", textColor: "text-green-600", badgeBg: "bg-green-500/10", badgeColor: "text-green-600" };
    if (value < 6.5) return { label: "Pre-diabetic", dotColor: "bg-amber-500", textColor: "text-amber-600", badgeBg: "bg-amber-500/10", badgeColor: "text-amber-600" };
    return { label: "Diabetic", dotColor: "bg-red-500", textColor: "text-red-600", badgeBg: "bg-red-500/10", badgeColor: "text-red-600" };
  }

  if (lower.includes("glucose") && lower.includes("fasting")) {
    if (value < 100) return { label: "Normal", dotColor: "bg-green-500", textColor: "text-green-600", badgeBg: "bg-green-500/10", badgeColor: "text-green-600" };
    if (value < 126) return { label: "Pre-diabetic", dotColor: "bg-amber-500", textColor: "text-amber-600", badgeBg: "bg-amber-500/10", badgeColor: "text-amber-600" };
    return { label: "Diabetic", dotColor: "bg-red-500", textColor: "text-red-600", badgeBg: "bg-red-500/10", badgeColor: "text-red-600" };
  }

  if (lower.includes("glucose")) {
    if (value < 140) return { label: "Normal", dotColor: "bg-green-500", textColor: "text-green-600", badgeBg: "bg-green-500/10", badgeColor: "text-green-600" };
    if (value < 200) return { label: "Pre-diabetic", dotColor: "bg-amber-500", textColor: "text-amber-600", badgeBg: "bg-amber-500/10", badgeColor: "text-amber-600" };
    return { label: "Diabetic", dotColor: "bg-red-500", textColor: "text-red-600", badgeBg: "bg-red-500/10", badgeColor: "text-red-600" };
  }

  if (lower.includes("bmi")) {
    if (value < 25) return { label: "Normal", dotColor: "bg-green-500", textColor: "text-green-600", badgeBg: "bg-green-500/10", badgeColor: "text-green-600" };
    if (value < 30) return { label: "Overweight", dotColor: "bg-amber-500", textColor: "text-amber-600", badgeBg: "bg-amber-500/10", badgeColor: "text-amber-600" };
    return { label: "Obese", dotColor: "bg-red-500", textColor: "text-red-600", badgeBg: "bg-red-500/10", badgeColor: "text-red-600" };
  }

  return { label: "", dotColor: "bg-gray-400", textColor: "text-[var(--text-primary)]", badgeBg: "bg-gray-500/10", badgeColor: "text-gray-600" };
}

function getTrend(current: number, previous: number): string {
  const diff = current - previous;
  if (Math.abs(diff) < 0.1) return "stable";
  return diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
}
