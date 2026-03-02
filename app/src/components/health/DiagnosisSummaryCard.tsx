"use client";

import type { DiagnosisAggregate } from "@/lib/health-analytics";
import type { DiagnosisSummary } from "@/lib/fhir/transforms";

interface DiagnosisSummaryCardProps {
  diagnoses: DiagnosisAggregate[];
  conditions?: DiagnosisSummary[];
}

/** Strip U+25CC (dotted circle) and other combining mark artifacts from FHIR names */
export function cleanDiagnosisName(name: string): string {
  return name.replace(/\u25CC/g, "").replace(/\s{2,}/g, " ").trim();
}

/** Check if a diagnosis name is garbage (numeric codes, too short, etc.) */
function isGarbageEntry(name: string): boolean {
  const trimmed = cleanDiagnosisName(name);
  if (trimmed.length < 3) return true;
  if (/^\d+$/.test(trimmed)) return true;
  if (trimmed.toLowerCase() === "unknown") return true;
  return false;
}

const RED_KEYWORDS = [
  "neoplasm", "malignant", "tumor", "cancer", "carcinoma", "lymphoma", "melanoma",
  "hemorrhage", "haemorrhage",
  "elevated prostate",
  "acute kidney", "renal failure",
  "pulmonary embolism", "embolism",
  "stroke", "cerebrovascular",
  "heart failure", "cardiac arrest",
  "sepsis", "septicemia",
  "morbid obesity", "severe obesity", "obesity class iii",
];

const AMBER_KEYWORDS = [
  "hypertension", "high blood pressure", "hypertensive",
  "impaired.*glucose", "glucose.*intolerance", "hyperglycemia",
  "pre-diabet", "obesity", "overweight",
  "hypothyroid", "hyperthyroid", "thyroid",
  "anemia", "anaemia",
  "hyperlipidemia", "cholesterol", "hypercholesterolemia",
  "chronic kidney", "renal insufficiency",
  "atrial fibrillation", "arrhythmia",
  "neuropathy", "retinopathy", "nephropathy",
  "impotence", "erectile",
  "osteoporosis", "osteopenia",
  "copd", "chronic obstructive",
  "depression", "anxiety", "bipolar",
];

const RED = { border: "border-l-red-500", dot: "bg-red-500", level: "red" } as const;
const AMBER = { border: "border-l-amber-500", dot: "bg-amber-500", level: "amber" } as const;
const GRAY = { border: "border-l-[var(--border)]", dot: "bg-[var(--text-muted)]", level: "gray" } as const;

export type SeverityLevel = "red" | "amber" | "gray";

/** Get severity color config based on condition category */
export function getSeverityConfig(
  name: string,
  conditions: DiagnosisSummary[]
): { border: string; dot: string; level: SeverityLevel } {
  const lower = cleanDiagnosisName(name).toLowerCase();

  // Priority 1: match against structured DiagnosisSummary conditions
  const match = conditions.find(
    (c) => cleanDiagnosisName(c.name).toLowerCase() === lower
  );

  if (match) {
    switch (match.category) {
      case "type1":
      case "type2":
        return RED;
      case "pre-diabetic":
      case "other-diabetes":
      case "obesity":
        return AMBER;
      default:
        break;
    }
  }

  // Priority 2: keyword-based classification
  // Diabetes-specific (red for confirmed, amber for pre-diabetic)
  if (lower.includes("diabetes") && !lower.includes("pre-diabet")) {
    return RED;
  }

  if (RED_KEYWORDS.some((kw) => lower.includes(kw))) return RED;
  if (AMBER_KEYWORDS.some((kw) =>
    kw.includes(".*") ? new RegExp(kw).test(lower) : lower.includes(kw)
  )) return AMBER;

  return GRAY;
}

export function DiagnosisSummaryCard({ diagnoses, conditions = [] }: DiagnosisSummaryCardProps) {
  const filtered = diagnoses.filter((dx) => !isGarbageEntry(dx.name));

  if (filtered.length === 0) return null;

  return (
    <div id="conditions-section">
      <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
        Conditions in Your Claims
      </h3>
      <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] divide-y divide-[var(--border)]">
        {filtered.map((dx, i) => {
          const severity = getSeverityConfig(dx.name, conditions);
          return (
            <div
              key={i}
              className={`px-4 py-3 flex items-center gap-3 border-l-[3px] ${severity.border}`}
            >
              <div className={`w-2 h-2 rounded-full ${severity.dot} shrink-0`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {cleanDiagnosisName(dx.name)}
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
