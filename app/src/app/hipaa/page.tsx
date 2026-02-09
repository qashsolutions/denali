import Link from "next/link";
import { BRAND } from "@/config";

const EFFECTIVE_DATE = "February 8, 2026";

export default function HIPAAPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
        HIPAA Compliance Notice
      </h1>
      <p className="text-[var(--text-secondary)] mb-2">
        How {BRAND.NAME} protects your health information under HIPAA.
      </p>
      <p className="text-xs text-[var(--text-muted)] mb-10">
        Effective: {EFFECTIVE_DATE}
      </p>

      {/* Overview */}
      <Section title="Our Commitment">
        <P>
          {BRAND.NAME}, operated by {BRAND.COMPANY_NAME}, is committed to
          protecting the privacy and security of your Protected Health
          Information (PHI) in compliance with the Health Insurance Portability
          and Accountability Act of 1996 (HIPAA), the HITECH Act, and
          applicable state privacy laws.
        </P>
        <P>
          This notice describes how health information about you may be used
          and disclosed, and how you can access this information.
        </P>
      </Section>

      {/* PHI */}
      <Section title="Protected Health Information (PHI)">
        <P>
          When you connect your Medicare account via CMS Blue Button 2.0, we
          may access the following categories of PHI:
        </P>
        <UL>
          <li>Patient demographics (name, date of birth, Medicare ID)</li>
          <li>Medicare enrollment and coverage details</li>
          <li>Claims and Explanation of Benefits (EOBs)</li>
          <li>
            Clinical data including lab results, diagnoses, and medications
          </li>
        </UL>
        <P>
          This data is accessed only with your explicit authorization through
          the CMS Blue Button OAuth process. You control this connection and
          can revoke it at any time.
        </P>
      </Section>

      {/* How we use PHI */}
      <Section title="How We Use and Disclose PHI">
        <SubSection title="Permitted Uses">
          <UL>
            <li>
              <strong>Treatment support:</strong> Providing personalized
              Medicare coverage guidance and diabetes management coaching based
              on your health records
            </li>
            <li>
              <strong>Healthcare operations:</strong> Improving our AI
              models using anonymized, de-identified data that cannot be traced
              back to any individual
            </li>
            <li>
              <strong>At your request:</strong> Generating appeal letters
              that reference your specific diagnoses, procedures, and lab
              results
            </li>
          </UL>
        </SubSection>
        <SubSection title="We Do NOT">
          <UL>
            <li>Sell your PHI to any third party</li>
            <li>Use your PHI for marketing purposes</li>
            <li>Share your PHI with employers or insurers</li>
            <li>
              Disclose your PHI without your consent except as required by law
            </li>
          </UL>
        </SubSection>
      </Section>

      {/* Safeguards */}
      <Section title="Safeguards">
        <SubSection title="Technical Safeguards">
          <UL>
            <li>
              AES-256-GCM encryption for all Blue Button OAuth tokens at rest
            </li>
            <li>TLS 1.2+ for all data in transit</li>
            <li>
              PKCE (Proof Key for Code Exchange) for OAuth authorization to
              prevent code interception
            </li>
            <li>
              Row-Level Security (RLS) in our database ensuring users can only
              access their own records
            </li>
            <li>
              Optional TOTP multi-factor authentication for additional account
              security
            </li>
            <li>
              Automatic token refresh with encrypted storage — we never store
              your Medicare.gov password
            </li>
          </UL>
        </SubSection>
        <SubSection title="Administrative Safeguards">
          <UL>
            <li>
              Comprehensive audit logging of all PHI access (who, what, when,
              why, IP address)
            </li>
            <li>
              Consent-based access control — health data is only used in AI
              conversations if you explicitly opt in
            </li>
            <li>
              Request purpose tagging on all health data queries (per CMS
              Interoperability Framework Criterion 22)
            </li>
            <li>Regular security assessments and vulnerability monitoring</li>
            <li>Incident response procedures for potential breaches</li>
          </UL>
        </SubSection>
        <SubSection title="Physical Safeguards">
          <UL>
            <li>
              Infrastructure hosted on SOC 2 Type II compliant providers
              (Supabase, Vercel)
            </li>
            <li>
              No PHI stored on local devices — all data resides in encrypted
              cloud databases
            </li>
            <li>
              Geographic access controls and network-level security
            </li>
          </UL>
        </SubSection>
      </Section>

      {/* Patient Rights */}
      <Section title="Your Rights Under HIPAA">
        <P>As a patient, you have the right to:</P>
        <UL>
          <li>
            <strong>Access your PHI:</strong> View all health data we hold
            about you through the Health page and Settings
          </li>
          <li>
            <strong>Request amendments:</strong> Ask us to correct inaccurate
            health information
          </li>
          <li>
            <strong>Request restrictions:</strong> Limit how your PHI is used
            via consent toggles in Settings &gt; Privacy &amp; Data
          </li>
          <li>
            <strong>Accounting of disclosures:</strong> Request a record of
            when and why your PHI was accessed (audit logs)
          </li>
          <li>
            <strong>Revoke authorization:</strong> Disconnect your Medicare
            account at any time to stop all PHI access
          </li>
          <li>
            <strong>File a complaint:</strong> If you believe your privacy
            rights have been violated, you may file a complaint with us or
            with the U.S. Department of Health and Human Services (HHS)
            Office for Civil Rights
          </li>
        </UL>
      </Section>

      {/* Breach */}
      <Section title="Breach Notification">
        <P>
          In the event of a breach of unsecured PHI, we will notify affected
          individuals within 60 days of discovery, as required by the HITECH
          Act. Notification will include:
        </P>
        <UL>
          <li>A description of the breach and the data involved</li>
          <li>Steps we have taken to investigate and mitigate the breach</li>
          <li>
            Steps you can take to protect yourself from potential harm
          </li>
          <li>Contact information for further questions</li>
        </UL>
        <P>
          Breaches affecting 500 or more individuals will also be reported to
          HHS and, where required, to the media.
        </P>
      </Section>

      {/* Business Associates */}
      <Section title="Business Associates">
        <P>
          We maintain Business Associate Agreements (BAAs) with service
          providers who may access PHI on our behalf:
        </P>
        <UL>
          <li>
            <strong>Supabase:</strong> Database hosting and authentication
            (stores encrypted health data cache)
          </li>
          <li>
            <strong>Vercel:</strong> Application hosting (processes API
            requests that may contain PHI)
          </li>
          <li>
            <strong>Anthropic:</strong> AI processing (receives conversation
            content; health data only sent when user consents to Health Data
            in AI)
          </li>
        </UL>
        <P>
          Each Business Associate is contractually obligated to protect PHI
          in accordance with HIPAA requirements.
        </P>
      </Section>

      {/* Minimum Necessary */}
      <Section title="Minimum Necessary Standard">
        <P>
          We apply the HIPAA Minimum Necessary standard to all PHI access:
        </P>
        <UL>
          <li>
            Blue Button API requests are scoped to specific FHIR resource
            types (Patient, Coverage, ExplanationOfBenefit, Observation,
            Condition, MedicationRequest)
          </li>
          <li>
            AI context injection includes only clinically relevant
            information (not raw FHIR bundles)
          </li>
          <li>
            Cached health data has a 24-hour TTL — we don&apos;t retain data
            longer than needed for the active session
          </li>
          <li>
            Consent preferences gate which categories of data reach the AI
          </li>
        </UL>
      </Section>

      {/* Data Retention */}
      <Section title="PHI Retention and Disposal">
        <UL>
          <li>
            Cached health data: 24-hour TTL, refreshed on access, deleted on
            disconnect or account deletion
          </li>
          <li>
            OAuth tokens: Encrypted at rest, deleted on disconnect or account
            deletion
          </li>
          <li>
            Audit logs: Retained for minimum 6 years per HIPAA requirements
          </li>
          <li>
            Conversations mentioning health data: Deleted on account deletion
          </li>
          <li>
            Anonymized learning data: Retained indefinitely (contains no PHI
            or PII)
          </li>
        </UL>
        <P>
          Upon account deletion, all PHI is permanently and irreversibly
          removed from our systems through a cascading deletion process.
        </P>
      </Section>

      {/* Contact */}
      <Section title="Privacy Officer Contact">
        <P>
          For questions about our HIPAA practices, to exercise your rights, or
          to file a complaint:
        </P>
        <UL>
          <li>Email: privacy@{BRAND.DOMAIN.replace("www.", "")}</li>
          <li>
            Organization: {BRAND.COMPANY_NAME}, HIPAA Privacy Officer
          </li>
        </UL>
        <P>
          You may also file a complaint with the HHS Office for Civil Rights
          at{" "}
          <a
            href="https://www.hhs.gov/ocr/complaints"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent-primary)] hover:underline"
          >
            hhs.gov/ocr/complaints
          </a>
          . We will not retaliate against you for filing a complaint.
        </P>
      </Section>

      {/* Links */}
      <div className="border-t border-[var(--border)] pt-6 mt-10 flex flex-col gap-3">
        <div className="flex gap-4">
          <Link
            href="/privacy"
            className="text-sm text-[var(--accent-primary)] hover:underline"
          >
            Privacy Policy
          </Link>
          <Link
            href="/faq"
            className="text-sm text-[var(--accent-primary)] hover:underline"
          >
            FAQ
          </Link>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          {BRAND.NAME} is {BRAND.COMPANY_ATTRIBUTION}.{" "}
          {BRAND.COPYRIGHT_TEXT}
        </p>
      </div>
    </div>
  );
}

/* Shared components for cleaner JSX */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-10">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 pb-2 border-b border-[var(--border)]">
        {title}
      </h2>
      {children}
    </div>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
      {children}
    </p>
  );
}

function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc list-outside pl-5 space-y-2 mb-4 text-sm text-[var(--text-secondary)] leading-relaxed">
      {children}
    </ul>
  );
}
