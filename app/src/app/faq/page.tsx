"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { MagnifyingGlassIcon } from "@/components/icons";

const FAQ_SECTIONS = [
  {
    title: "Data Privacy & Security",
    items: [
      {
        q: "What data does Denali collect?",
        a: "We store only what's needed: your email (for login), conversation history, and appeal letters. If you connect Medicare via the official Medicare API, we also cache your claims and coverage data (encrypted, refreshed every 24 hours), along with basic demographics (age and gender only). We never store your full name, date of birth, address, Social Security Number, Medicare beneficiary ID, or bank details.",
      },
      {
        q: "Is my health data encrypted?",
        a: "Yes. All Medicare API tokens are encrypted with AES-256-GCM before storage. Data in transit uses TLS 1.2+. Your cached health data is only accessible to your authenticated account.",
      },
      {
        q: "Who can see my data?",
        a: "We share data only with the service providers needed to run the app: AWS (database, hosting, and AI via Bedrock), Stripe (payments), and Resend (email delivery — receives only your email address). We never share data for marketing or advertising. Each provider is contractually required to protect your data. See our Privacy Policy for details on what each provider receives and for how long.",
      },
      {
        q: "What happens if there's a data breach?",
        a: "We will notify affected users within 60 days via email, explaining what happened, what data was involved, and what steps to take. For breaches affecting 500 or more users, we also notify the FTC and HHS as required by law.",
      },
    ],
  },
  {
    title: "How We Use Your Health Data",
    items: [
      {
        q: "What happens when I connect Medicare?",
        a: "We use the official Medicare claims API to fetch your coverage status, recent claims, and any denied claims. This lets our AI personalize guidance — for example, referencing your actual coverage instead of asking you to look it up.",
      },
      {
        q: "Can I control how my health data is used?",
        a: "Yes. In Settings > Privacy & Data, you can toggle whether your health data is used in AI conversations, whether it's cached locally, and whether you share anonymous usage analytics.",
      },
    ],
  },
  {
    title: "Consent & Preferences",
    items: [
      {
        q: "What consents do I need to give?",
        a: "Using Denali for coverage guidance requires no consent or account. For appeals, we need your email. For health data features, we ask for explicit consent before accessing or using your Medicare records in conversations.",
      },
      {
        q: "Can I revoke consent?",
        a: "Anytime. Go to Settings > Privacy & Data and toggle off any consent. If you revoke health data consent, we stop using it in conversations immediately. You can also disconnect Medicare entirely.",
      },
    ],
  },
  {
    title: "Medicare Connection",
    items: [
      {
        q: "Is this connected to Medicare?",
        a: "We use the official Medicare claims API to access your claims and coverage data with your permission. We're working toward deeper Medicare integration as part of the CMS Health Technology Ecosystem.",
      },
    ],
  },
  {
    title: "Trial & Pricing",
    items: [
      {
        q: "Is Denali free?",
        a: "Yes — sign up with your email to get a 14-day free trial with 10 messages per day, 1 day per week. After the trial, chat access is locked until you subscribe: Starter ($10/month, 20 msgs/day, 1 day/week, 1 appeal credit), Plus ($20/month, 20 msgs/day, every day, 2 appeal credits), or Unlimited ($60/month, unlimited everything).",
      },
      {
        q: "Is there a free trial?",
        a: "Yes. Every new account gets a 14-day trial with 10 messages/day, 1 day per week. After the trial period, chat access is locked — choose Starter ($10/month), Plus ($20/month), or Unlimited ($60/month) to continue. Trial does not include appeal letters.",
      },
      {
        q: "How many free messages do I get?",
        a: "Free trial: 10 messages per day, 1 day per week for 14 days. Starter plan: 20 messages/day, 1 day/week. Plus plan: 20 messages/day, every day. Unlimited plan: unlimited messages every day.",
      },
    ],
  },
  {
    title: "Features",
    items: [
      {
        q: "What is MyHealth?",
        a: "MyHealth is your personalized Medicare health dashboard. After you sign in and connect your Medicare account, it shows your coverage status, recent claims, health conditions, active medications, screening reminders, care team providers, and any denied claims — all extracted from your Medicare data. You can also connect and disconnect your Medicare account from this page.",
      },
      {
        q: "What is Ask Denali?",
        a: "Ask Denali is the chat feature where you can ask questions about Medicare coverage in plain English. You can check if a procedure is covered, understand a denial, get help with an appeal letter, or ask about diabetes and weight management coverage. It uses AI to look up real Medicare policies and give you personalized guidance. One free message per day without an account.",
      },
      {
        q: "What is in the Blog?",
        a: "The Blog has articles about Medicare topics like understanding denial codes, navigating coverage rules, filing appeals, prior authorization tips, diabetes care, and weight management. If you're signed in and have set topic preferences, you'll see personalized article recommendations. Otherwise, you'll see a weekly-rotating selection of articles.",
      },
      {
        q: "How do I find my diabetes information?",
        a: "Go to the Diabetes Care page from your dashboard. If you've connected your Medicare account, you'll see your A1C history, screening reminders, medication tracking, and personalized coaching. If you haven't connected Medicare, you can still use the quick actions and coverage reference guides.",
      },
      {
        q: "How do I check my Medicare coverage?",
        a: "Tap 'Ask Denali' and describe the procedure or service you need. Denali will look up the relevant Medicare coverage policies (LCD/NCD), check requirements, and tell you what's covered — including any prior authorization needed.",
      },
      {
        q: "What is the weight management feature?",
        a: "The Weight Management page shows your obesity-related conditions, medications, and screening history from Medicare claims. It includes Medicare coverage info for intensive behavioral therapy (IBT), medical nutrition therapy, bariatric surgery, and GLP-1 medications like Wegovy.",
      },
      {
        q: "How do appeal letters work?",
        a: "When a Medicare claim is denied, tell Denali about it. The AI will look up the denial reason, gather your details, and generate a formal appeal letter citing real LCD/NCD policy numbers, ICD-10/CPT codes, and clinical evidence from PubMed. Appeal letters require an account and use 1 appeal credit.",
      },
    ],
  },
  {
    title: "Appeal Letters",
    items: [
      {
        q: "How accurate are the appeal letters?",
        a: "Our letters cite real LCD/NCD policy numbers, use correct ICD-10 and CPT codes, and include relevant clinical evidence from PubMed. However, they should be reviewed by you and your healthcare provider before submission.",
      },
      {
        q: "Does Denali guarantee my appeal will be approved?",
        a: "No. We provide the strongest possible letter based on Medicare policy, but approval depends on your specific medical situation, documentation, and the reviewer. Our guidance helps maximize your chances.",
      },
    ],
  },
  {
    title: "AI Disclosure",
    items: [
      {
        q: "Is this AI-generated content?",
        a: "Yes. All responses are generated by AI (Claude via AWS Bedrock). Every message is clearly marked as AI-generated. Our guidance is based on real Medicare policies but does not replace clinical judgment.",
      },
      {
        q: "What are the limitations?",
        a: "Denali provides Medicare coverage guidance only — not medical advice, legal advice, or billing services. We support both Original Medicare and Medicare Advantage, though coverage rules differ between them. Always verify with your healthcare provider.",
      },
    ],
  },
  {
    title: "Account & Deletion",
    items: [
      {
        q: "Can I delete my account?",
        a: "Yes. Go to Settings > Danger Zone and request account deletion. We permanently delete your conversations, appeal letters, cached health data, Medicare connection, consent preferences, diabetes tracking data (logs, snapshots, and AI insights), and authentication credentials. Your Stripe subscription is cancelled. This action cannot be undone.",
      },
      {
        q: "What data is retained after deletion?",
        a: "Two categories survive deletion: (1) Anonymized, de-identified learning data (e.g., 'symptom X maps to code Y with Z% confidence') — no names, Medicare IDs, or account identifiers; and (2) Audit logs, which are retained for a minimum of 6 years as required by HIPAA. Audit logs record data access events (who accessed what, when, and why) and cannot be deleted on demand due to this regulatory obligation.",
      },
    ],
  },
  {
    title: "Accessibility",
    items: [
      {
        q: "Is Denali accessible?",
        a: "We follow WCAG guidelines: minimum 16px font size, adjustable text scaling, high contrast support, screen reader compatibility, and 44x44px minimum touch targets. Adjust text size in Settings > Accessibility.",
      },
    ],
  },
];

export default function FAQPage() {
  const [search, setSearch] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );

  // Filter sections by search query (matches against question + answer text)
  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return FAQ_SECTIONS;

    return FAQ_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.q.toLowerCase().includes(q) ||
          item.a.toLowerCase().includes(q) ||
          section.title.toLowerCase().includes(q)
      ),
    })).filter((section) => section.items.length > 0);
  }, [search]);

  // Auto-expand all sections when searching
  const visibleSections = search.trim()
    ? filteredSections
    : FAQ_SECTIONS;
  const isSearching = search.trim().length > 0;

  function toggleSection(title: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  }

  function isSectionExpanded(title: string) {
    // When searching, all matching sections are expanded
    if (isSearching) return true;
    return expandedSections.has(title);
  }

  return (
    <>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-[var(--font-serif)] text-3xl sm:text-4xl font-normal text-[var(--text-primary)] mb-2">
          Frequently Asked Questions
        </h1>
        <p className="text-[var(--text-secondary)] mb-2">
          How Denali works — features, pricing, privacy, and more.
        </p>
        <p className="text-xs text-[var(--text-muted)] mb-8">
          Effective: March 5, 2026
        </p>

        {/* Search bar — filters FAQ content in-page */}
        <div className="relative mb-8">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search FAQs — e.g. pricing, diabetes, appeals, privacy..."
            className="w-full pl-12 pr-5 py-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-base placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/30 transition-colors"
            aria-label="Search frequently asked questions"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              aria-label="Clear search"
            >
              <XIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Accordion sections */}
        {visibleSections.length > 0 ? (
          <div className="space-y-2">
            {visibleSections.map((section) => {
              const isExpanded = isSectionExpanded(section.title);
              return (
                <div
                  key={section.title}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden"
                >
                  <button
                    onClick={() => toggleSection(section.title)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[var(--bg-tertiary)] transition-colors"
                    aria-expanded={isExpanded}
                  >
                    <span className="text-base font-semibold text-[var(--text-primary)]">
                      {section.title}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--text-muted)]">
                        {section.items.length}
                      </span>
                      <ChevronIcon
                        className={`w-5 h-5 text-[var(--text-muted)] transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-5 border-t border-[var(--border)]">
                      {section.items.map((item) => (
                        <div key={item.q} className="pt-4">
                          <h3 className="text-base font-medium text-[var(--text-primary)] mb-1.5">
                            {item.q}
                          </h3>
                          <p className="text-base text-[var(--text-primary)] leading-relaxed">
                            {item.a}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-[var(--text-secondary)] mb-3">
              No matching questions found.
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              For Medicare coverage, diabetes, or obesity questions,{" "}
              <Link
                href="/app/chat"
                className="text-[var(--accent-primary)] hover:underline"
              >
                Ask Denali
              </Link>{" "}
              directly.
            </p>
          </div>
        )}

        <p className="text-sm text-[var(--text-muted)] mt-10">
          Have a question about Medicare coverage?{" "}
          <Link
            href="/app/chat"
            className="text-[var(--accent-primary)] hover:underline"
          >
            Ask Denali
          </Link>{" "}
          — no signup required.
        </p>
      </div>
      <LandingFooter />
    </>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
