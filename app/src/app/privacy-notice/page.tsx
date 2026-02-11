import Link from "next/link";
import { BRAND } from "@/config";

const EFFECTIVE_DATE = "February 11, 2026";

const SECTIONS = [
  {
    id: "what-we-collect",
    title: "1. What Health Data We Collect",
    paragraphs: [
      "When you connect your Medicare account, we access the following data through the official Medicare claims API:",
    ],
    items: [
      "Patient demographics (name, date of birth, Medicare beneficiary ID)",
      "Medicare coverage details (Part A, Part B enrollment and plan information)",
      "Claims and Explanation of Benefits (EOBs), including denied claims",
      "Conditions, medications, and screening history extracted from your claims data",
    ],
    afterItems:
      "We also collect your email address (for authentication), conversation content (your questions and our AI responses), and appeal letters generated on your behalf. We do NOT collect Social Security Numbers, mailing addresses, bank information, or medical records beyond what Medicare provides.",
  },
  {
    id: "how-we-use",
    title: "2. How We Use Your Data",
    items: [
      "Provide personalized Medicare coverage guidance based on your claims and coverage",
      "Generate appeal letters when Medicare denies a claim",
      "Detect potential claim denial risks before they happen",
      "Personalize AI conversations with your health context (only if you consent)",
      "Maintain audit logs for CMS compliance",
      "Improve our service through anonymized, de-identified patterns that cannot be traced to any individual",
    ],
  },
  {
    id: "who-we-share-with",
    title: "3. Who We Share Data With",
    paragraphs: [
      "We do not sell your personal information. Data is shared only with the following service providers under Business Associate Agreements (BAAs):",
    ],
    subsections: [
      {
        title: "Service Providers",
        items: [
          "Anthropic (Claude AI): Processes your conversation content to generate responses. Does not train on API data. Retains inputs up to 30 days for safety monitoring only. Health data is only sent if you enable the 'Health Data in AI' consent toggle.",
          "Supabase: Hosts your account data, conversations, and cached health data with encryption at rest. SOC 2 Type II certified.",
          "Stripe: Processes payments. We never see or store your credit card number.",
          "CMS (Medicare API): We exchange data with Medicare only when you explicitly authorize the connection via OAuth.",
          "Vercel: Hosts our application. Server-side logs may contain request metadata.",
        ],
      },
    ],
    afterItems:
      "We may also disclose information if required by law, court order, or government regulation.",
  },
  {
    id: "how-we-protect",
    title: "4. How We Protect Your Data",
    items: [
      "AES-256-GCM encryption for all Medicare OAuth tokens at rest",
      "TLS 1.2+ encryption for all data in transit",
      "Row-Level Security (RLS) in our database ensures you can only access your own data",
      "PKCE (Proof Key for Code Exchange) for Medicare OAuth authorization",
      "Email-based one-time passcode (OTP) authentication with optional TOTP multi-factor authentication",
      "Comprehensive audit logging of all sensitive data access (who, what, when, why)",
      "Infrastructure hosted on SOC 2 Type II compliant providers",
      "Incident response procedures aligned with NIST SP 800-61 (see our HIPAA Compliance page for details)",
    ],
  },
  {
    id: "your-choices",
    title: "5. Your Choices and Controls",
    paragraphs: [
      "You control how your data is used through consent toggles in Settings > Privacy & Data:",
    ],
    items: [
      "Health Data in AI: Choose whether your lab results, diagnoses, and medications are used to personalize AI conversations (default: off)",
      "Health Data Storage: Choose whether your Medicare data is cached for faster access (default: off)",
      "Analytics: Choose whether anonymized usage data helps us improve the service (default: off)",
      "Disconnect Medicare: Revoke your Medicare data connection at any time in Settings",
      "Delete Account: Permanently delete your account and all associated data in Settings > Danger Zone",
    ],
  },
  {
    id: "access-and-correct",
    title: "6. How to Access and Correct Your Data",
    items: [
      "View your health data on the Health page after connecting your Medicare account",
      "View your conversation history in the chat sidebar",
      "View your activity log in Settings",
      "Request correction of inaccurate data by contacting admin@denali.health",
      "Export your data in a readable format upon request",
    ],
  },
  {
    id: "retention",
    title: "7. How Long We Keep Your Data",
    items: [
      "Account data, conversations, and appeal letters: Retained until you delete your account",
      "Cached health data: Refreshed every 24 hours; deleted when you disconnect Medicare or delete your account",
      "OAuth tokens: Encrypted at rest; deleted when you disconnect Medicare or delete your account",
      "Audit logs: Retained for minimum 6 years per HIPAA requirements",
      "Anonymized learning data: Retained indefinitely (contains no personally identifiable information)",
    ],
    afterItems:
      "Upon account deletion, all personal data is permanently and irreversibly removed through a cascading deletion process.",
  },
  {
    id: "breach-notification",
    title: "8. Breach Notification",
    paragraphs: [
      "In the event of a breach of unsecured health data, we will:",
    ],
    items: [
      "Notify affected individuals within 60 days of discovery via email",
      "Include a description of the breach, types of data involved, steps taken, and recommended actions",
      "Report to HHS and the FTC for breaches affecting 500 or more individuals",
      "Follow our Incident Response Plan (NIST SP 800-61) for detection, containment, investigation, notification, and post-incident review",
    ],
    afterItems:
      "See our HIPAA Compliance page for the full Incident Response Plan.",
  },
  {
    id: "contact",
    title: "9. Contact Us",
    paragraphs: [
      "If you have questions about this Privacy Notice, your data, or your rights:",
    ],
    items: [
      "Ask Denali directly in the chat for privacy-related questions",
      "Email us at admin@denali.health",
      `Write to: ${BRAND.COMPANY_NAME}, Privacy Inquiries`,
    ],
  },
];

interface Section {
  id: string;
  title: string;
  content?: string;
  paragraphs?: string[];
  items?: string[];
  afterItems?: string;
  afterLink?: { href: string; text: string };
  subsections?: {
    title: string;
    items: string[];
  }[];
}

function SectionBlock({ section }: { section: Section }) {
  return (
    <div id={section.id} className="mb-10">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 pb-2 border-b border-[var(--border)]">
        {section.title}
      </h2>

      {section.content && (
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
          {section.content}
        </p>
      )}

      {section.paragraphs?.map((p, i) => (
        <p
          key={i}
          className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4"
        >
          {p}
        </p>
      ))}

      {section.items && (
        <ul className="list-disc list-outside pl-5 space-y-2 mb-4">
          {section.items.map((item, i) => (
            <li
              key={i}
              className="text-sm text-[var(--text-secondary)] leading-relaxed"
            >
              {item}
            </li>
          ))}
        </ul>
      )}

      {section.afterItems && (
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-2">
          {section.afterItems}
        </p>
      )}

      {section.afterLink && (
        <Link
          href={section.afterLink.href}
          className="text-sm text-[var(--accent-primary)] hover:underline"
        >
          {section.afterLink.text}
        </Link>
      )}

      {section.subsections?.map((sub, i) => (
        <div key={i} className="mt-4">
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">
            {sub.title}
          </h3>
          <ul className="list-disc list-outside pl-5 space-y-2">
            {sub.items.map((item, j) => (
              <li
                key={j}
                className="text-sm text-[var(--text-secondary)] leading-relaxed"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function PrivacyNoticePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
        Model Privacy Notice
      </h1>
      <p className="text-[var(--text-secondary)] mb-2">
        A plain-language summary of how {BRAND.NAME} handles your health data,
        following the ONC Model Privacy Notice format.
      </p>
      <p className="text-xs text-[var(--text-muted)] mb-10">
        Effective: {EFFECTIVE_DATE}
      </p>

      {/* Table of Contents */}
      <nav className="mb-10 p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
          Contents
        </h2>
        <ol className="list-decimal list-inside space-y-1">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="text-sm text-[var(--accent-primary)] hover:underline"
              >
                {section.title.replace(/^\d+\.\s/, "")}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {SECTIONS.map((section) => (
        <SectionBlock key={section.id} section={section} />
      ))}

      {/* Cross-references */}
      <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] mb-10">
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">
          Related Documents
        </h3>
        <div className="flex flex-col gap-2">
          <Link
            href="/privacy"
            className="text-sm text-[var(--accent-primary)] hover:underline"
          >
            Full Privacy Policy
          </Link>
          <Link
            href="/hipaa"
            className="text-sm text-[var(--accent-primary)] hover:underline"
          >
            HIPAA Compliance Notice
          </Link>
        </div>
      </div>

      <div className="border-t border-[var(--border)] pt-6 mt-10">
        <p className="text-xs text-[var(--text-muted)]">
          {BRAND.NAME} is {BRAND.COMPANY_ATTRIBUTION}.{" "}
          {BRAND.COPYRIGHT_TEXT}
        </p>
      </div>
    </div>
  );
}
