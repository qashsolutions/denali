import Link from "next/link";
import { BRAND } from "@/config";
import { LandingFooter } from "@/components/landing";

const EFFECTIVE_DATE = "March 5, 2026";

export default function HIPAAPage() {
  return (
    <>
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
          When you connect your Medicare account via the official Medicare claims API, we
          may access the following categories of PHI:
        </P>
        <UL>
          <li>Patient demographics (age and gender only — we do not store full names, dates of birth, addresses, or Medicare beneficiary IDs)</li>
          <li>Medicare enrollment and coverage details</li>
          <li>Claims and Explanation of Benefits (EOBs)</li>
          <li>
            Conditions, medications, and screenings (extracted from claims data — lab values are not directly available from Medicare)
          </li>
        </UL>
        <P>
          This data is accessed only with your explicit authorization through
          the Medicare OAuth process. You control this connection and
          can revoke it at any time.
        </P>
      </Section>

      {/* How we use PHI */}
      <Section title="How We Use and Disclose PHI">
        <SubSection title="Permitted Uses">
          <UL>
            <li>
              <strong>Treatment support:</strong> Providing personalized
              Medicare coverage guidance, diabetes management coaching, and
              weight management guidance based on your health records
            </li>
            <li>
              <strong>Healthcare operations:</strong> Improving our service
              using anonymized, de-identified learning patterns (such as
              symptom-to-code mappings) that cannot be traced back to any
              individual. We do not train AI models on your data.
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
              AES-256-GCM encryption for all Medicare OAuth tokens at rest
            </li>
            <li>TLS 1.2+ for all data in transit</li>
            <li>
              PKCE (Proof Key for Code Exchange) for OAuth authorization to
              prevent code interception
            </li>
            <li>
              Application-level access controls ensuring users can only
              access their own records through authenticated API routes
            </li>
            <li>
              Optional TOTP multi-factor authentication for additional account
              security
            </li>
            <li>
              Automatic token refresh with encrypted storage — we never store
              your Medicare password
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
              Infrastructure hosted on AWS (HIPAA-eligible: RDS PostgreSQL,
              ECS/Fargate, Bedrock) — Business Associate Agreement executed
              February 25, 2026
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
          the FTC and HHS as required by law, and where required, to the media.
        </P>
        <P>
          As a personal health record vendor, we also comply with the FTC Health
          Breach Notification Rule (16 CFR Part 318), which requires notification
          to affected individuals and, for breaches affecting 500 or more
          individuals, notification to the FTC.
        </P>
      </Section>

      {/* Incident Response Plan */}
      <Section title="Incident Response Plan">
        <P>
          Our incident response procedures follow the NIST SP 800-61
          (Computer Security Incident Handling Guide) framework, adapted for
          healthcare data. The plan covers five phases:
        </P>
        <SubSection title="1. Detection and Identification">
          <UL>
            <li>
              Automated monitoring of authentication failures, unusual data
              access patterns, and unauthorized API calls via audit logging
            </li>
            <li>
              Database-level alerts for bulk data exports, privilege
              escalation, and access control bypass attempts
            </li>
            <li>
              User-reported incidents via admin@denali.health or in-app
              reporting
            </li>
          </UL>
        </SubSection>
        <SubSection title="2. Containment">
          <UL>
            <li>
              Immediate revocation of compromised credentials and OAuth tokens
            </li>
            <li>
              Isolation of affected systems and suspension of impacted user
              sessions
            </li>
            <li>
              Preservation of audit logs and system state for forensic analysis
            </li>
          </UL>
        </SubSection>
        <SubSection title="3. Investigation">
          <UL>
            <li>
              Review of audit logs to determine scope of unauthorized access
              (who, what, when, from where)
            </li>
            <li>
              Assessment of whether PHI was accessed, exfiltrated, or modified
            </li>
            <li>
              Engagement of third-party forensic specialists if warranted
            </li>
          </UL>
        </SubSection>
        <SubSection title="4. Notification">
          <UL>
            <li>
              Affected individuals notified within 60 days of discovery via
              email, as required by the HITECH Act
            </li>
            <li>
              HHS Office for Civil Rights notified for breaches affecting 500
              or more individuals
            </li>
            <li>
              FTC notified per the Health Breach Notification Rule (16 CFR Part
              318) where applicable
            </li>
            <li>
              Notification includes: description of the incident, types of
              data involved, steps taken, and recommended user actions
            </li>
          </UL>
        </SubSection>
        <SubSection title="5. Post-Incident Review">
          <UL>
            <li>
              Root cause analysis and documentation of lessons learned
            </li>
            <li>
              Updates to security controls, monitoring rules, and incident
              response procedures based on findings
            </li>
            <li>
              Review of Business Associate compliance for any third-party
              involvement
            </li>
          </UL>
        </SubSection>
      </Section>

      {/* Business Associates */}
      <Section title="Business Associates">
        <P>
          We work with the following service providers who may process health
          data on our behalf. We require Business Associate Agreements (BAAs)
          with all service providers who process protected health information.
        </P>
        <UL>
          <li>
            <strong>AWS (Amazon Web Services):</strong> Database (RDS
            PostgreSQL), application hosting (ECS/Fargate), and AI processing
            (Bedrock — runs Claude; health data only sent when user consents
            to Health Data in AI). AWS is HIPAA-eligible. Our BAA with AWS
            was <strong>executed on February 25, 2026</strong>. AWS Bedrock
            does not store or log prompts and completions by default and does
            not train models on your data.
          </li>
          <li>
            <strong>Stripe:</strong> Payment processing only — does not
            process or store any health information. PCI DSS certified.
          </li>
          <li>
            <strong>Resend:</strong> Email delivery for authentication
            codes and account communications — receives only email
            addresses. Does not process or store any health information.
            SOC 2 Type II certified.
          </li>
        </UL>
        <P>
          All providers handling protected health information operate under a
          fully executed Business Associate Agreement. Our AWS BAA covers all
          services that may come into contact with PHI (database, hosting,
          and AI processing).
        </P>
      </Section>

      {/* Minimum Necessary */}
      <Section title="Minimum Necessary Standard">
        <P>
          We apply the HIPAA Minimum Necessary standard to all PHI access:
        </P>
        <UL>
          <li>
            Medicare API requests are scoped to specific FHIR resource
            types (Patient, Coverage, ExplanationOfBenefit)
          </li>
          <li>
            AI context injection includes only clinically relevant
            information (not raw FHIR bundles)
          </li>
          <li>
            Cached health data has a 24-hour TTL — data is refreshed on access
            and deleted immediately on disconnect or account deletion
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
          removed from our systems through a cascading deletion process —
          except audit logs, which are subject to a minimum 6-year HIPAA
          retention requirement that applies even after account deletion.
        </P>
      </Section>

      {/* Policy Change Notification */}
      <Section title="Policy Change Notification">
        <P>
          We will notify registered users via email at least 30 days before
          material changes to this HIPAA Compliance Notice take effect.
          Notifications will include a summary of what changed and why.
        </P>
        <P>
          If changes are driven by CMS regulatory updates or modifications to
          the CMS Interoperability Framework, we will specifically identify
          those changes and explain how they affect your Medicare data handling.
        </P>
        <P>
          If you disagree with the changes, you may delete your account and
          all associated data before the effective date (Settings &gt; Danger
          Zone). Continued use of the Service after the effective date
          constitutes acceptance of the updated notice.
        </P>
      </Section>

      {/* Contact */}
      <Section title="Privacy Officer Contact">
        <P>
          For questions about our HIPAA practices, to exercise your rights, or
          to file a complaint:
        </P>
        <UL>
          <li>Email: admin@denali.health</li>
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

    </div>
    <LandingFooter />
  </>
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
