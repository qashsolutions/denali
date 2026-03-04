import Link from "next/link";
import { MountainIcon } from "../icons";

interface LandingFooterProps {
  settings: Record<string, string>;
}

export function LandingFooter({ settings }: LandingFooterProps) {
  const brandName = settings.brand_name || "DenaliHealth";
  const companyPrefix = settings.company_prefix || "a unit of";
  const companyName = settings.company_name || "Qash Solutions Inc";
  const copyrightYear = settings.copyright_year || new Date().getFullYear();

  const healthIndex = brandName.indexOf("Health");
  const prefix = healthIndex >= 0 ? brandName.slice(0, healthIndex) : brandName;
  const suffix = healthIndex >= 0 ? "Health" : "";

  return (
    <footer className="py-8 bg-[var(--bg-secondary)] border-t border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Row 1: brand left, links right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          {/* Left: Logo + Company */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-1">
              <MountainIcon className="w-7 h-7" />
              <span className="text-xl font-bold text-[var(--text-primary)]">
                {prefix}
                {suffix && (
                  <span className="text-[var(--accent-secondary)]">{suffix}</span>
                )}
              </span>
            </Link>
            <p className="text-sm text-[var(--text-muted)]">
              {companyPrefix} {companyName}
            </p>
          </div>

          {/* Right: Legal links */}
          <div className="flex items-center gap-5">
            <Link
              href="/faq"
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              FAQ
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              href="/hipaa"
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              HIPAA
            </Link>
          </div>
        </div>

        {/* Row 2: HIPAA/BAA notice — full width */}
        <p className="mb-6 text-base font-medium text-[var(--text-primary)]">
          denali.health is built on HIPAA-ready infrastructure, including Claude via AWS Bedrock under a signed Business Associate Agreement with AWS.
        </p>

        {/* Bottom: Disclaimer + Copyright */}
        <div className="pt-4 border-t border-[var(--border)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
            <p>
              Coverage guidance only, not medical advice. Always consult with
              healthcare providers for medical decisions.
              This product is not endorsed or certified by CMS or HHS.
            </p>
            <p className="shrink-0">
              &copy; {copyrightYear} {brandName}. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
