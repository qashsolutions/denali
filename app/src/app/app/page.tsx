"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  type DashboardContext,
  type Badge,
  type Nudge,
  type TimeOfDay,
  getTimeOfDay,
  getPersonalizedGreeting,
  buildStatusSummary,
  selectNudge,
  getCoverageBadge,
  getDashboardBadge,
  getDiabetesBadge,
  getAppealsBadge,
  getMockDashboardContext,
} from "@/lib/dashboard-context";

// ---------------------------------------------------------------------------
// Feature card definitions
// ---------------------------------------------------------------------------

interface FeatureConfig {
  id: string;
  href: string;
  title: string;
  description: string;
  accentColor: string;
  illustration: React.ReactNode;
  getBadge: (ctx: DashboardContext) => Badge | null;
}

// SVG Illustrations — professional, minimal, stroke-based
function CoverageIllustration() {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className="w-12 h-12"
      aria-hidden="true"
    >
      {/* Magnifying glass body */}
      <circle
        cx="22"
        cy="22"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      {/* Glass handle */}
      <line
        x1="29.5"
        y1="29.5"
        x2="38"
        y2="38"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="animate-sway"
        style={{ transformOrigin: "29.5px 29.5px" }}
      />
      {/* Check mark inside glass */}
      <path
        d="M17 22l3 3 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  );
}

function DashboardIllustration() {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className="w-12 h-12"
      aria-hidden="true"
    >
      {/* EKG pulse line */}
      <polyline
        points="4,26 12,26 16,18 20,34 24,22 28,28 32,26 36,26 40,20 44,26"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className="animate-pulse-line"
      />
      {/* Small heart */}
      <path
        d="M24 14c-1.5-2.5-5-3-7-1s-1 5 1 7l6 5 6-5c2-2 3-5 1-7s-5.5-1.5-7 1z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.5"
      />
    </svg>
  );
}

function DiabetesIllustration() {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className="w-12 h-12"
      aria-hidden="true"
    >
      {/* Bar chart */}
      <rect x="8" y="28" width="6" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" className="animate-shimmer" style={{ animationDelay: "0s" }} />
      <rect x="18" y="20" width="6" height="20" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" className="animate-shimmer" style={{ animationDelay: "0.3s" }} />
      <rect x="28" y="14" width="6" height="26" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" className="animate-shimmer" style={{ animationDelay: "0.6s" }} />
      {/* Trend arrow */}
      <path d="M38 12l-2 4h4l-2-4z" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.6" />
      <line x1="38" y1="16" x2="38" y2="22" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
}

function AppealsIllustration() {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className="w-12 h-12"
      aria-hidden="true"
    >
      {/* Document */}
      <rect x="10" y="6" width="22" height="30" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      {/* Lines on document */}
      <line x1="16" y1="14" x2="26" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <line x1="16" y1="20" x2="26" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <line x1="16" y1="26" x2="22" y2="26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      {/* Arrow flowing out */}
      <path
        d="M34 20l6 0M37 17l3 3-3 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animate-flow-move"
      />
    </svg>
  );
}

const FEATURES: FeatureConfig[] = [
  {
    id: "coverage",
    href: "/app/chat?topic=coverage",
    title: "Coverage Check",
    description: "Verify if Medicare covers your procedure before you go",
    accentColor: "#2ECC71",
    illustration: <CoverageIllustration />,
    getBadge: (ctx) => getCoverageBadge(ctx.coverage),
  },
  {
    id: "dashboard",
    href: "/app/health",
    title: "Medicare Dashboard",
    description: "Your claims, medications, and screening schedule",
    accentColor: "#E74C5A",
    illustration: <DashboardIllustration />,
    getBadge: (ctx) => getDashboardBadge(ctx.dashboard),
  },
  {
    id: "diabetes",
    href: "/app/chat?topic=diabetes",
    title: "Diabetes Care",
    description: "Personalized coaching from your own lab results",
    accentColor: "#3B82F6",
    illustration: <DiabetesIllustration />,
    getBadge: (ctx) => getDiabetesBadge(ctx.diabetes),
  },
  {
    id: "appeals",
    href: "/app/chat?topic=appeal",
    title: "Appeals",
    description: "Fight denied claims with auto-generated appeal letters",
    accentColor: "#7C5CFC",
    illustration: <AppealsIllustration />,
    getBadge: (ctx) => getAppealsBadge(ctx.appeals),
  },
];

// ---------------------------------------------------------------------------
// Enhancement 2: StatusBadge component
// ---------------------------------------------------------------------------

function StatusBadge({ badge }: { badge: Badge }) {
  const isSolid = badge.variant === "solid";
  return (
    <span
      className="absolute -top-2 right-4 z-10 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.05em] whitespace-nowrap"
      style={{
        color: isSolid ? "#ffffff" : badge.color,
        backgroundColor: isSolid ? badge.color : "transparent",
        border: isSolid ? "none" : `1.5px solid ${badge.color}`,
        boxShadow: isSolid
          ? `0 2px 8px ${badge.color}40`
          : "none",
      }}
      role="status"
      aria-label={badge.label}
    >
      {badge.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Enhancement 5: Animated Feature Card
// ---------------------------------------------------------------------------

function AnimatedFeatureCard({
  feature,
  badge,
  index,
}: {
  feature: FeatureConfig;
  badge: Badge | null;
  index: number;
}) {
  return (
    <div
      className="opacity-0"
      style={{
        animation: `card-enter 500ms cubic-bezier(0.4, 0, 0.2, 1) forwards`,
        animationDelay: `${600 + index * 120}ms`,
      }}
    >
      <Link
        href={feature.href}
        className={cn(
          "group relative flex flex-col items-start",
          "p-6 rounded-2xl",
          "border border-[var(--border)]",
          "transition-all duration-[400ms] cubic-bezier(0.4, 0, 0.2, 1)",
          "hover:-translate-y-1",
          "min-h-[168px]",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
        )}
        style={{
          backgroundColor: "var(--bg-secondary)",
          // @ts-expect-error -- CSS custom property for hover shadow
          "--card-accent": feature.accentColor,
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.boxShadow = `0 8px 24px ${feature.accentColor}20, 0 2px 8px ${feature.accentColor}10`;
          el.style.borderColor = `${feature.accentColor}40`;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.boxShadow = "";
          el.style.borderColor = "";
        }}
      >
        {badge && <StatusBadge badge={badge} />}

        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
          style={{
            backgroundColor: `${feature.accentColor}15`,
            color: feature.accentColor,
          }}
        >
          {feature.illustration}
        </div>

        <h3
          className="text-[15px] font-semibold mb-1"
          style={{
            fontFamily: "var(--font-serif)",
            color: "var(--text-primary)",
          }}
        >
          {feature.title}
        </h3>
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
          {feature.description}
        </p>
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Enhancement 3: Nudge Strip
// ---------------------------------------------------------------------------

function NudgeStrip({ nudge }: { nudge: Nudge }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className="opacity-0 mx-auto max-w-2xl mb-6"
      style={{
        animation: "fade-up 400ms ease-out 600ms forwards",
      }}
    >
      <div
        className="relative flex items-center gap-3 px-4 py-3 rounded-xl border"
        style={{
          backgroundColor: "var(--nudge-bg, #FFFDF5)",
          borderColor: "var(--nudge-border, #F5E6C8)",
        }}
        role="status"
        aria-live="polite"
      >
        {/* Bell icon */}
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "#FEF3C7" }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 20 20" className="w-4 h-4" fill="#92400E">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-2.83-2h5.66A3 3 0 0110 18z" />
          </svg>
        </div>

        {/* Message text */}
        <p
          className="flex-1 text-[13px] leading-snug"
          style={{ color: "#92400E" }}
        >
          {nudge.message}
        </p>

        {/* CTA */}
        <Link
          href={nudge.href}
          className="flex-shrink-0 text-[13px] font-semibold whitespace-nowrap px-3 py-1.5 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          style={{
            color: "#92400E",
            backgroundColor: "#FDE68A40",
          }}
        >
          {nudge.cta} <span aria-hidden="true">&nbsp;&rarr;</span>
        </Link>

        {/* Dismiss */}
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors min-w-[44px] min-h-[44px]"
          style={{ color: "#92400E" }}
          aria-label="Dismiss notification"
        >
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
            <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Enhancement 4: Walkthrough Bar
// ---------------------------------------------------------------------------

const WALKTHROUGH_STEPS = [
  {
    title: "Check your coverage first",
    description: "Verify if Medicare covers a procedure before your visit.",
    feature: "Coverage Check",
  },
  {
    title: "Explore your Medicare data",
    description: "Connect Blue Button to see your claims and medications.",
    feature: "Medicare Dashboard",
  },
  {
    title: "Start tracking your A1C",
    description: "Get personalized diabetes coaching from your own lab results.",
    feature: "Diabetes Care",
  },
  {
    title: "Set up appeal alerts",
    description: "Never miss a deadline to fight a denied Medicare claim.",
    feature: "Appeals",
  },
];

function WalkthroughBar({
  onComplete,
  onSkip,
}: {
  onComplete: () => void;
  onSkip: () => void;
}) {
  const [step, setStep] = useState(0);
  const current = WALKTHROUGH_STEPS[step];
  const isLast = step === WALKTHROUGH_STEPS.length - 1;

  return (
    <div
      className="opacity-0 mx-auto max-w-2xl mb-6"
      style={{
        animation: "slide-down-fade 400ms ease-out 400ms forwards",
      }}
      role="region"
      aria-label="Getting started walkthrough"
    >
      <div
        className="relative rounded-2xl px-6 py-5 overflow-hidden"
        style={{ backgroundColor: "#1A1F2E" }}
      >
        {/* Step content */}
        <div className="flex items-start gap-4" role="group" aria-label={`Step ${step + 1} of ${WALKTHROUGH_STEPS.length}`}>
          {/* Step number circle */}
          <div
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{
              backgroundColor: "rgba(255,255,255,0.12)",
              color: "#ffffff",
            }}
            aria-hidden="true"
          >
            {step + 1}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-white mb-0.5" style={{ fontFamily: "var(--font-serif)" }}>
              {current.title}
            </p>
            <p className="text-[12px] text-gray-400 leading-snug">
              {current.description}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={onSkip}
              className="text-[12px] text-gray-500 hover:text-gray-300 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              Skip tour
            </button>
            <button
              onClick={() => {
                if (isLast) {
                  onComplete();
                } else {
                  setStep((s) => s + 1);
                }
              }}
              className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              style={{
                backgroundColor: "rgba(255,255,255,0.15)",
                color: "#ffffff",
              }}
            >
              {isLast ? (
                <>Get Started<span aria-hidden="true">&nbsp;&#10003;</span></>
              ) : (
                <>Next<span aria-hidden="true">&nbsp;&rarr;</span></>
              )}
            </button>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mt-4" role="tablist" aria-label="Walkthrough progress">
          {WALKTHROUGH_STEPS.map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-all duration-200"
              style={{
                backgroundColor:
                  i === step
                    ? "#ffffff"
                    : i < step
                      ? "rgba(255,255,255,0.4)"
                      : "rgba(255,255,255,0.15)",
              }}
              role="tab"
              aria-selected={i === step}
              aria-label={`Step ${i + 1}: ${WALKTHROUGH_STEPS[i].title}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Enhancement 1: Hero Section
// ---------------------------------------------------------------------------

function HeroSection({
  ctx,
  timeOfDay,
}: {
  ctx: DashboardContext;
  timeOfDay: TimeOfDay;
}) {
  const greeting = getPersonalizedGreeting(ctx.user.firstName);
  const summary = buildStatusSummary(ctx);

  // Time-based gradient: warm peach (morning) → soft blue (afternoon) → muted lavender (evening)
  const gradientMap: Record<TimeOfDay, string> = {
    morning:
      "linear-gradient(135deg, rgba(255,237,213,0.08) 0%, rgba(254,215,170,0.04) 100%)",
    afternoon:
      "linear-gradient(135deg, rgba(191,219,254,0.08) 0%, rgba(147,197,253,0.04) 100%)",
    evening:
      "linear-gradient(135deg, rgba(221,214,254,0.08) 0%, rgba(196,181,253,0.04) 100%)",
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl px-6 py-8 mb-6"
      style={{ background: gradientMap[timeOfDay] }}
    >
      <div
        className="opacity-0"
        style={{
          animation: "fade-up 300ms ease-out 200ms forwards",
        }}
      >
        <h1
          className="text-[28px] font-normal leading-tight mb-2"
          style={{
            fontFamily: "var(--font-serif)",
            color: "var(--text-primary)",
          }}
        >
          {greeting}
        </h1>

        {summary ? (
          <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
            {summary}
          </p>
        ) : (
          <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
            Welcome to Denali. Let&rsquo;s get your Medicare working for you.
          </p>
        )}
      </div>

      {/* Subtle decorative gradient orb */}
      <div
        className="absolute -right-12 -top-12 w-40 h-40 rounded-full opacity-[0.03]"
        style={{
          background:
            timeOfDay === "morning"
              ? "radial-gradient(circle, #F59E0B, transparent)"
              : timeOfDay === "afternoon"
                ? "radial-gradient(circle, #3B82F6, transparent)"
                : "radial-gradient(circle, #8B5CF6, transparent)",
        }}
        aria-hidden="true"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AppHomePage() {
  // In production, populate from useAuth + useHealthData + useConversationHistory.
  // For prototype, use mock data.
  const [ctx] = useState<DashboardContext>(() => getMockDashboardContext());
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [timeOfDay] = useState<TimeOfDay>(() => getTimeOfDay());
  const walkthroughChecked = useRef(false);

  // Check walkthrough flag
  useEffect(() => {
    if (walkthroughChecked.current) return;
    walkthroughChecked.current = true;

    // In production, read from user profile/API.
    // For prototype, use sessionStorage so it only appears once per browser session.
    const completed = sessionStorage.getItem("denali_walkthrough_done");
    if (!completed && !ctx.user.hasCompletedWalkthrough) {
      setShowWalkthrough(true);
    }
  }, [ctx.user.hasCompletedWalkthrough]);

  const dismissWalkthrough = useCallback(() => {
    setShowWalkthrough(false);
    sessionStorage.setItem("denali_walkthrough_done", "1");
    // In production: PATCH /api/profile { hasCompletedWalkthrough: true }
  }, []);

  const nudge = selectNudge(ctx);

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8">
      {/* Enhancement 1: Personalized Hero */}
      <HeroSection ctx={ctx} timeOfDay={timeOfDay} />

      {/* Enhancement 3: Nudge Strip */}
      {nudge && <NudgeStrip nudge={nudge} />}

      {/* Enhancement 4: First-visit Walkthrough */}
      {showWalkthrough && (
        <WalkthroughBar
          onComplete={dismissWalkthrough}
          onSkip={dismissWalkthrough}
        />
      )}

      {/* Enhancement 2 + 5: Feature Cards with badges + animations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {FEATURES.map((feature, i) => (
          <AnimatedFeatureCard
            key={feature.id}
            feature={feature}
            badge={feature.getBadge(ctx)}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}
