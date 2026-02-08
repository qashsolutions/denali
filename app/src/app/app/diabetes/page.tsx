"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { DiabetesIcon } from "@/components/icons";
import { CmsPledge } from "@/components/ui";
import { useHealthData } from "@/hooks/useHealthData";
import { PreDiabetesRiskCard } from "@/components/health";
import { classifyDiabetesStatus, type DiabetesClassification } from "@/lib/fhir/transforms";

export default function DiabetesPage() {
  const router = useRouter();
  const { labs, conditions, medications, isConnected, isLoading } = useHealthData();

  const askAbout = (topic: string) => {
    router.push(`/app/chat?message=${encodeURIComponent(topic)}`);
  };

  // Classify diabetes status from FHIR data
  const classification = useMemo((): DiabetesClassification | null => {
    if (!isConnected) return null;
    return classifyDiabetesStatus(conditions, labs, medications).classification;
  }, [isConnected, conditions, labs, medications]);

  const latestA1C = labs.find(l => l.name.toLowerCase().includes("a1c"));
  const diabetesMeds = medications.filter(m => m.isDiabetesMed);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-violet-500/15 flex items-center justify-center shrink-0">
          <DiabetesIcon className="w-7 h-7 text-violet-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Diabetes Care
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Medicare coverage for diabetes prevention &amp; management
          </p>
        </div>
      </div>

      {/* Section 1: Personal Status (only when connected) */}
      {isConnected && !isLoading && classification && classification !== "none" && (
        <section className="mb-8">
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Your Status
              </h2>
              <ClassificationBadge classification={classification} />
            </div>

            {/* Latest A1C */}
            {latestA1C && (
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {latestA1C.value}{latestA1C.unit}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    A1C &mdash; {latestA1C.date}
                  </p>
                </div>
                <A1CRangeBar value={latestA1C.value} />
              </div>
            )}

            {/* Active diabetes diagnosis */}
            {conditions.filter(c => ["type1", "type2", "pre-diabetic", "other-diabetes"].includes(c.category)).map((c, i) => (
              <p key={i} className="text-sm text-[var(--text-secondary)]">
                Diagnosis: {c.name}
              </p>
            ))}

            {/* Active diabetes medications */}
            {diabetesMeds.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Active Medications</p>
                <div className="flex flex-wrap gap-1.5">
                  {diabetesMeds.map((m, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded bg-violet-500/10 text-violet-600">
                      {m.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => askAbout(
                latestA1C
                  ? `My A1C is ${latestA1C.value}%. What should I do?`
                  : "Tell me about my diabetes care options"
              )}
              className="w-full py-2.5 rounded-xl text-sm font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 transition-colors"
            >
              Discuss with Denali
            </button>
          </div>
        </section>
      )}

      {/* Connected but no diabetes indicators */}
      {isConnected && !isLoading && classification === "none" && (
        <section className="mb-8">
          <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 text-center">
            <p className="text-sm text-green-700 dark:text-green-400">
              No diabetes indicators found in your Medicare records. Keep up the good work!
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Medicare covers annual diabetes screening for at-risk patients.
            </p>
          </div>
        </section>
      )}

      {/* Connected but no labs at all */}
      {isConnected && !isLoading && labs.length === 0 && conditions.length === 0 && (
        <section className="mb-8">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4 text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              No diabetes labs found in your Medicare records.
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Ask your doctor about A1C screening — Medicare covers it annually.
            </p>
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickAction
            label={isConnected && latestA1C ? `My A1C is ${latestA1C.value}%` : "Ask about my A1C"}
            description="Get personalized guidance based on your lab results"
            onClick={() => askAbout(
              isConnected && latestA1C
                ? `My A1C is ${latestA1C.value}%. What does this mean and what should I do?`
                : "What does my A1C level mean for Medicare coverage?"
            )}
          />
          <QuickAction
            label="Diabetes screening"
            description="Check if Medicare covers diabetes screening"
            onClick={() => askAbout("Does Medicare cover diabetes screening tests?")}
          />
          <QuickAction
            label="Diabetes supplies"
            description="Glucose monitors, test strips, lancets"
            onClick={() => askAbout("What diabetes supplies does Medicare cover?")}
          />
          <QuickAction
            label={classification === "pre-diabetic" ? "MDPP for me" : "Prevention program"}
            description={classification === "pre-diabetic" ? "You may qualify — learn more" : "Medicare Diabetes Prevention Program (MDPP)"}
            onClick={() => askAbout(
              classification === "pre-diabetic"
                ? "I'm pre-diabetic. Am I eligible for the Medicare Diabetes Prevention Program?"
                : "Am I eligible for the Medicare Diabetes Prevention Program?"
            )}
          />
        </div>
      </section>

      {/* Coverage Quick Reference */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
          Medicare Diabetes Coverage
        </h2>
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
          <CoverageItem title="Diabetes Screening" description="Annual blood glucose tests for at-risk patients" covered />
          <CoverageItem title="Self-Management Training" description="10 hours first year, 2 hours each year after" covered />
          <CoverageItem title="Prevention Program (MDPP)" description="Lifestyle coaching for pre-diabetic patients" covered />
          <CoverageItem title="Supplies (Part B)" description="Glucose monitors, test strips, lancets" covered />
          <CoverageItem title="Insulin (Part D)" description="$35/month cap under Part D plans" covered />
          <CoverageItem title="Medical Nutrition Therapy" description="Dietitian visits with physician referral" covered />
        </div>
      </section>

      {/* A1C Guide — highlight user's range when available */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
          Understanding A1C
        </h2>
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] p-4 space-y-3">
          <A1CRange
            range="Below 5.7%"
            label="Normal"
            color="text-green-600"
            bg="bg-green-500/10"
            highlighted={latestA1C ? latestA1C.value < 5.7 : false}
          />
          <A1CRange
            range="5.7% — 6.4%"
            label="Pre-diabetic"
            color="text-amber-600"
            bg="bg-amber-500/10"
            highlighted={latestA1C ? latestA1C.value >= 5.7 && latestA1C.value < 6.5 : false}
          />
          <A1CRange
            range="6.5% or above"
            label="Diabetic"
            color="text-red-600"
            bg="bg-red-500/10"
            highlighted={latestA1C ? latestA1C.value >= 6.5 : false}
          />
          {latestA1C ? (
            <p className="text-xs text-[var(--text-muted)] pt-1">
              Your latest A1C: <strong>{latestA1C.value}{latestA1C.unit}</strong> ({latestA1C.date})
            </p>
          ) : (
            <p className="text-xs text-[var(--text-muted)] pt-1">
              Connect your Medicare account to see your actual A1C values and get
              personalized coaching.
            </p>
          )}
        </div>
      </section>

      {/* MDPP section for pre-diabetic users */}
      {(classification === "pre-diabetic" || classification === "at-risk") && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Medicare Diabetes Prevention Program
          </h2>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-2">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              You may be eligible for MDPP
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              MDPP covers up to 22 lifestyle coaching sessions over 12 months. Eligibility includes:
            </p>
            <ul className="text-sm text-[var(--text-secondary)] space-y-1 ml-4 list-disc">
              <li>A1C between 5.7% and 6.4%</li>
              <li>Fasting glucose 110–125 mg/dL</li>
              <li>BMI of 25 or higher</li>
            </ul>
            <button
              onClick={() => askAbout("Am I eligible for the Medicare Diabetes Prevention Program? How do I enroll?")}
              className="mt-2 text-sm font-medium text-[var(--accent-primary)] hover:underline"
            >
              Ask Denali about MDPP eligibility
            </button>
          </div>
        </section>
      )}

      {/* Pre-diabetes risk test — shown when NOT connected */}
      {!isConnected && !isLoading && (
        <section className="mb-8">
          <PreDiabetesRiskCard />
        </section>
      )}

      <div className="mt-6">
        <CmsPledge type="diabetes" />
      </div>
    </div>
  );
}

function ClassificationBadge({ classification }: { classification: DiabetesClassification }) {
  const config = {
    "diabetic": { label: "Diabetic", bg: "bg-red-500/10", color: "text-red-600" },
    "pre-diabetic": { label: "Pre-Diabetic", bg: "bg-amber-500/10", color: "text-amber-600" },
    "at-risk": { label: "At Risk", bg: "bg-amber-500/10", color: "text-amber-600" },
    "none": { label: "Normal", bg: "bg-green-500/10", color: "text-green-600" },
  }[classification];

  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${config.bg} ${config.color}`}>
      {config.label}
    </span>
  );
}

function A1CRangeBar({ value }: { value: number }) {
  // Visual range bar: 4% to 10%
  const min = 4;
  const max = 10;
  const clamped = Math.min(Math.max(value, min), max);
  const pct = ((clamped - min) / (max - min)) * 100;

  return (
    <div className="flex-1 relative h-3 rounded-full overflow-hidden bg-gradient-to-r from-green-400 via-amber-400 to-red-500">
      <div
        className="absolute top-0 w-1 h-3 bg-white border border-gray-600 rounded-full"
        style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
      />
    </div>
  );
}

function QuickAction({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--accent-primary)]/30 transition-colors"
    >
      <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
      <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>
    </button>
  );
}

function CoverageItem({
  title,
  description,
  covered,
}: {
  title: string;
  description: string;
  covered: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className={`text-sm mt-0.5 ${covered ? "text-green-600" : "text-[var(--text-muted)]"}`}>
        {covered ? "✓" : "—"}
      </span>
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
        <p className="text-xs text-[var(--text-muted)]">{description}</p>
      </div>
    </div>
  );
}

function A1CRange({
  range,
  label,
  color,
  bg,
  highlighted,
}: {
  range: string;
  label: string;
  color: string;
  bg: string;
  highlighted: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 ${highlighted ? "p-2 -mx-2 rounded-lg ring-2 ring-[var(--accent-primary)]/30" : ""}`}>
      <span className={`text-xs font-medium px-2 py-1 rounded ${bg} ${color}`}>
        {label}
      </span>
      <span className="text-sm text-[var(--text-secondary)]">{range}</span>
      {highlighted && (
        <span className="text-xs font-medium text-[var(--accent-primary)] ml-auto">You</span>
      )}
    </div>
  );
}
