"use client";

/**
 * ReportView — Shared report renderer
 *
 * Used by both the public /report/[token] page and the in-app report detail page.
 * Sections: Hospice notice, Red flags, Diabetes, Obesity, Pre-diabetes resources,
 * Conditions, Medications, DME, Screenings, Care Team, Denials.
 */

import type { HealthReport } from "@/lib/health-report";

interface ReportViewProps {
  report: HealthReport;
  expiresAt?: string;
  isPublic?: boolean;
}

export function ReportView({ report, expiresAt, isPublic }: ReportViewProps) {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <header className="text-center border-b border-[var(--border)] pb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] font-serif">
          Medicare Health Summary Report
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Generated {new Date(report.generatedAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
        {expiresAt && (
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            This report expires on{" "}
            {new Date(expiresAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}
      </header>

      {/* Patient Summary */}
      <section className="flex gap-4 flex-wrap text-sm">
        {report.patientSummary.age && (
          <span className="px-3 py-1 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
            Age: {report.patientSummary.age}
          </span>
        )}
        {report.patientSummary.gender && (
          <span className="px-3 py-1 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
            {report.patientSummary.gender}
          </span>
        )}
        <span className="px-3 py-1 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
          {report.patientSummary.coverageType}
        </span>
      </section>

      {/* Hospice Notice */}
      {report.hospiceStatus && (
        <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-5">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Hospice Status — This report focuses on comfort care and Medicare hospice benefit coverage.
          </p>
        </div>
      )}

      {/* Red Flags */}
      {report.redFlags.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 font-serif">
            Items Needing Attention
          </h2>
          <div className="space-y-3">
            {report.redFlags.map((flag, i) => (
              <div
                key={i}
                className={`rounded-xl border p-4 ${
                  flag.severity === "urgent"
                    ? "bg-red-500/5 border-red-500/20"
                    : "bg-amber-500/5 border-amber-500/20"
                }`}
              >
                <p className={`font-medium text-sm ${
                  flag.severity === "urgent"
                    ? "text-red-700 dark:text-red-400"
                    : "text-amber-700 dark:text-amber-400"
                }`}>
                  {flag.title}
                </p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{flag.detail}</p>
                <p className="text-sm text-[var(--accent-primary)] mt-1 font-medium">
                  {flag.recommendation}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Diabetes Assessment */}
      {report.diabetesSection.classification !== "none" && (
        <ReportSection
          title="Diabetes Assessment"
          badge={report.diabetesSection.classification}
          badgeColor={report.diabetesSection.classification === "diabetic" ? "red" : "amber"}
          findings={report.diabetesSection.findings}
          benefits={report.diabetesSection.medicareBenefits}
          actions={report.diabetesSection.actionItems}
        />
      )}

      {/* Obesity Assessment */}
      {report.obesitySection.classification !== "none" && (
        <ReportSection
          title="Weight Management Assessment"
          badge={report.obesitySection.classification}
          badgeColor={report.obesitySection.classification === "obese" ? "red" : "amber"}
          findings={report.obesitySection.findings}
          benefits={report.obesitySection.medicareBenefits}
          actions={report.obesitySection.actionItems}
        />
      )}

      {/* Pre-Diabetes Resources (CMS criterion #4) */}
      {report.preDiabetesResources?.eligible && (
        <section className="rounded-xl border border-[var(--border)] p-5 bg-[var(--bg-secondary)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 font-serif">
            Pre-Diabetes Prevention Resources
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-3">
            {report.preDiabetesResources.mdppInfo}
          </p>
          <a
            href={report.preDiabetesResources.cdcRiskTestLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm font-medium text-[var(--accent-primary)] hover:underline mb-3"
          >
            Take the CDC Diabetes Risk Test →
          </a>
          {report.preDiabetesResources.lifestyleGuidance.length > 0 && (
            <ul className="space-y-1">
              {report.preDiabetesResources.lifestyleGuidance.map((g, i) => (
                <li key={i} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                  <span className="text-[var(--check-teal)]">→</span> {g}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Conditions Summary */}
      {report.conditionsSummary.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 font-serif">
            Conditions Overview
          </h2>
          <div className="space-y-2">
            {report.conditionsSummary.map((c, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-[var(--border)] p-3">
                <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  c.severity === "red" ? "bg-red-500" :
                  c.severity === "amber" ? "bg-amber-500" : "bg-green-500"
                }`} />
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {c.name}{c.isPrimary ? " (Primary)" : ""}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">{c.note}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Medications */}
      {report.medicationReview.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 font-serif">
            Medication Review
          </h2>
          <div className="space-y-2">
            {report.medicationReview.map((m, i) => (
              <div key={i} className="flex items-start justify-between rounded-lg border border-[var(--border)] p-3">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{m.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{m.status}</p>
                </div>
                {m.concern && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    {m.concern}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* DME Supplies */}
      {report.dmeSupplies && report.dmeSupplies.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 font-serif">
            DME & Supplies
          </h2>
          <div className="space-y-2">
            {report.dmeSupplies.map((d, i) => (
              <div key={i} className="rounded-lg border border-[var(--border)] p-3">
                <p className="text-sm font-medium text-[var(--text-primary)] capitalize">{d.category.replace(/-/g, " ")}</p>
                <p className="text-xs text-[var(--text-secondary)]">{d.relevance}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Screenings */}
      {report.screeningStatus.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 font-serif">
            Screening Status
          </h2>
          <div className="space-y-2">
            {report.screeningStatus.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{s.type}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Last: {s.lastDate ?? "No record"} — {s.medicareCoverage}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  s.isOverdue
                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                    : "bg-green-500/10 text-green-600 dark:text-green-400"
                }`}>
                  {s.isOverdue ? "Overdue" : "Up to date"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Care Team */}
      {report.careTeam.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 font-serif">
            Care Team
          </h2>
          <div className="space-y-2">
            {report.careTeam.map((ct, i) => (
              <div key={i} className="flex items-start justify-between rounded-lg border border-[var(--border)] p-3">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{ct.specialty}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {ct.hasVisited ? "Active" : "Not yet seen"}
                  </p>
                </div>
                {ct.recommendation && (
                  <p className="text-xs text-[var(--accent-primary)]">{ct.recommendation}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Denials */}
      {report.recentDenials.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 font-serif">
            Recent Claim Denials
          </h2>
          <div className="space-y-2">
            {report.recentDenials.map((d, i) => (
              <div key={i} className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <p className="text-sm font-medium text-[var(--text-primary)]">{d.procedure}</p>
                <p className="text-xs text-[var(--text-secondary)]">{d.reason}</p>
                <p className="text-xs text-[var(--accent-primary)] mt-1 font-medium">{d.actionItem}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Disclaimers */}
      <footer className="border-t border-[var(--border)] pt-6 space-y-2 text-xs text-[var(--text-secondary)]">
        <p>
          Generated from Medicare claims data via Blue Button 2.0. Not endorsed or certified by CMS or HHS.
        </p>
        <p>
          This is coverage guidance only, not medical advice. Always consult with your healthcare provider for medical decisions.
        </p>
        {isPublic && (
          <p className="mt-4">
            <a href="https://denali.health" className="text-[var(--accent-primary)] hover:underline">
              denali.health
            </a>{" "}
            — Medicare claims intelligence
          </p>
        )}
      </footer>
    </div>
  );
}

function ReportSection({
  title,
  badge,
  badgeColor,
  findings,
  benefits,
  actions,
}: {
  title: string;
  badge: string;
  badgeColor: "red" | "amber";
  findings: string[];
  benefits: string[];
  actions: string[];
}) {
  return (
    <section className="rounded-xl border border-[var(--border)] p-5">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] font-serif">{title}</h2>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
          badgeColor === "red"
            ? "bg-red-500/10 text-red-600 dark:text-red-400"
            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        }`}>
          {badge}
        </span>
      </div>
      {findings.length > 0 && (
        <ul className="space-y-1 mb-3">
          {findings.map((f, i) => (
            <li key={i} className="text-sm text-[var(--text-secondary)]">• {f}</li>
          ))}
        </ul>
      )}
      {benefits.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-[var(--text-primary)] mb-1">Medicare Benefits Available:</p>
          <ul className="space-y-1">
            {benefits.map((b, i) => (
              <li key={i} className="text-sm text-[var(--check-teal)] flex items-start gap-2">
                <span>✓</span> {b}
              </li>
            ))}
          </ul>
        </div>
      )}
      {actions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[var(--text-primary)] mb-1">Action Items:</p>
          <ul className="space-y-1">
            {actions.map((a, i) => (
              <li key={i} className="text-sm text-[var(--accent-primary)] flex items-start gap-2">
                <span>→</span> {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
