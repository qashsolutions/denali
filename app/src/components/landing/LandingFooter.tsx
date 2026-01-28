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

  return (
    <footer className="py-12 bg-[var(--bg-secondary)] border-t border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          {/* Logo + Brand */}
          <Link href="/" className="flex items-center gap-3 mb-4">
            <MountainIcon className="w-10 h-8" />
            <span className="text-xl font-bold text-[var(--text-primary)]">
              {brandName}
            </span>
          </Link>

          {/* Company Info */}
          <p className="text-sm text-[var(--text-muted)] mb-6">
            {companyPrefix} {companyName}
          </p>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm mb-8">
            <Link
              href="/chat"
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Get Started
            </Link>
            <Link
              href="#how-it-works"
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              How It Works
            </Link>
            <Link
              href="/settings"
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Settings
            </Link>
          </div>

          {/* Divider */}
          <div className="w-full max-w-md h-px bg-[var(--border)] mb-6" />

          {/* Copyright */}
          <p className="text-sm text-[var(--text-muted)]">
            &copy; {copyrightYear} {brandName}. All rights reserved.
          </p>

          {/* Disclaimer */}
          <p className="text-xs text-[var(--text-muted)] mt-4 max-w-xl leading-relaxed">
            This service provides Medicare coverage guidance only and does not
            constitute medical or legal advice. Always consult with healthcare
            providers for medical decisions.
          </p>
        </div>
      </div>
    </footer>
  );
}
