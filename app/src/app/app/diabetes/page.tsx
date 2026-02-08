"use client";

import { useRouter } from "next/navigation";
import { DiabetesIcon } from "@/components/icons";
import { CmsPledge } from "@/components/ui";

export default function DiabetesPage() {
  const router = useRouter();

  const askAbout = (topic: string) => {
    router.push(`/app/chat?q=${encodeURIComponent(topic)}`);
  };

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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        <QuickAction
          label="Ask about my A1C"
          description="Get personalized guidance based on your lab results"
          onClick={() => askAbout("What does my A1C level mean for Medicare coverage?")}
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
          label="Prevention program"
          description="Medicare Diabetes Prevention Program (MDPP)"
          onClick={() => askAbout("Am I eligible for the Medicare Diabetes Prevention Program?")}
        />
      </div>

      {/* Coverage Quick Reference */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
          Medicare Diabetes Coverage
        </h2>
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
          <CoverageItem
            title="Diabetes Screening"
            description="Annual blood glucose tests for at-risk patients"
            covered
          />
          <CoverageItem
            title="Self-Management Training"
            description="10 hours first year, 2 hours each year after"
            covered
          />
          <CoverageItem
            title="Prevention Program (MDPP)"
            description="Lifestyle coaching for pre-diabetic patients"
            covered
          />
          <CoverageItem
            title="Supplies (Part B)"
            description="Glucose monitors, test strips, lancets"
            covered
          />
          <CoverageItem
            title="Insulin (Part D)"
            description="$35/month cap under Part D plans"
            covered
          />
          <CoverageItem
            title="Medical Nutrition Therapy"
            description="Dietitian visits with physician referral"
            covered
          />
        </div>
      </section>

      {/* A1C Guide */}
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
          />
          <A1CRange
            range="5.7% — 6.4%"
            label="Pre-diabetic"
            color="text-amber-600"
            bg="bg-amber-500/10"
          />
          <A1CRange
            range="6.5% or above"
            label="Diabetic"
            color="text-red-600"
            bg="bg-red-500/10"
          />
          <p className="text-xs text-[var(--text-muted)] pt-1">
            Connect your Medicare account to see your actual A1C values and get
            personalized coaching.
          </p>
        </div>
      </section>

      <div className="mt-6">
        <CmsPledge type="diabetes" />
      </div>
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
}: {
  range: string;
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={`text-xs font-medium px-2 py-1 rounded ${bg} ${color}`}>
        {label}
      </span>
      <span className="text-sm text-[var(--text-secondary)]">{range}</span>
    </div>
  );
}
