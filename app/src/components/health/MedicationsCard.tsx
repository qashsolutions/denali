"use client";

/**
 * Medications Card
 *
 * Displays medications from FHIR MedicationRequest resources.
 * Diabetes medications highlighted at the top.
 */

import type { MedicationSummary } from "@/lib/fhir/transforms";

interface MedicationsCardProps {
  medications: MedicationSummary[];
}

export function MedicationsCard({ medications }: MedicationsCardProps) {
  if (medications.length === 0) return null;

  const diabetesMeds = medications.filter(m => m.isDiabetesMed);
  const otherMeds = medications.filter(m => !m.isDiabetesMed);

  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] p-5">
      <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
        Medications
      </h2>

      {diabetesMeds.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-violet-600 mb-2">Diabetes Medications</p>
          <div className="space-y-2">
            {diabetesMeds.map((med, i) => (
              <MedRow key={i} med={med} highlight />
            ))}
          </div>
        </div>
      )}

      {otherMeds.length > 0 && (
        <div>
          {diabetesMeds.length > 0 && (
            <p className="text-xs font-medium text-[var(--text-muted)] mb-2 mt-3">Other Medications</p>
          )}
          <div className="space-y-2">
            {otherMeds.map((med, i) => (
              <MedRow key={i} med={med} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MedRow({ med, highlight }: { med: MedicationSummary; highlight?: boolean }) {
  const statusColor = med.status === "Active"
    ? "text-green-600"
    : med.status === "Completed"
    ? "text-gray-500"
    : "text-[var(--text-muted)]";

  return (
    <div className={`flex items-start justify-between gap-3 ${highlight ? "pl-3 border-l-2 border-violet-400" : ""}`}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
          {med.name}
        </p>
        {med.dosage && (
          <p className="text-xs text-[var(--text-muted)]">{med.dosage}</p>
        )}
        <p className="text-xs text-[var(--text-muted)]">
          Started {med.startDate}
        </p>
      </div>
      <span className={`text-xs font-medium shrink-0 ${statusColor}`}>
        {med.status}
      </span>
    </div>
  );
}
