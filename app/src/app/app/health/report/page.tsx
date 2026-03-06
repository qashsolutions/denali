"use client";

/**
 * In-App Report Detail Page
 *
 * /app/health/report — Auth required.
 * Renders ReportView with share/email/regenerate controls.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useHealthReport } from "@/hooks/useHealthReport";
import { ReportView } from "@/components/health/ReportView";

export default function HealthReportPage() {
  const router = useRouter();
  const { authState } = useAuth();
  const { report, isLoading, isGenerating, shareUrl, regenerate, emailReport } =
    useHealthReport();

  const [copied, setCopied] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailName, setEmailName] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Auth gate
  useEffect(() => {
    if (!authState.isLoading && !authState.email) {
      router.push("/app/settings");
    }
  }, [authState.isLoading, authState.email, router]);

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleEmail = async () => {
    if (!emailTo.trim()) return;
    setEmailSending(true);
    const ok = await emailReport(emailTo.trim(), emailName.trim() || undefined);
    setEmailSending(false);
    if (ok) {
      setEmailSent(true);
      setShowEmailForm(false);
      setTimeout(() => setEmailSent(false), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[var(--bg-tertiary)] rounded w-1/2" />
          <div className="h-4 bg-[var(--bg-tertiary)] rounded w-1/3" />
          <div className="h-64 bg-[var(--bg-tertiary)] rounded" />
        </div>
      </div>
    );
  }

  if (!report || report.status === "failed") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 text-center">
        <h1 className="text-xl font-bold text-[var(--text-primary)] mb-4 font-serif">
          Health Summary Report
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          {report?.status === "failed"
            ? "Report generation failed. Please try again."
            : "No report available yet. Generate one from your health data."}
        </p>
        <button
          onClick={regenerate}
          disabled={isGenerating}
          className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {isGenerating ? "Generating..." : "Generate Report"}
        </button>
      </div>
    );
  }

  if (isGenerating || report.status === "generating") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 text-center">
        <h1 className="text-xl font-bold text-[var(--text-primary)] mb-4 font-serif">
          Generating Your Report
        </h1>
        <div className="flex items-center justify-center gap-2 text-sm text-[var(--text-secondary)]">
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
          </svg>
          Analyzing your Medicare data...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/app/health")}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          &larr; Back to Health
        </button>
        <div className="flex-1" />

        {/* Share link */}
        <button
          onClick={handleCopyLink}
          className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
        >
          {copied ? "Copied!" : "Share Link"}
        </button>

        {/* Email */}
        <button
          onClick={() => setShowEmailForm(!showEmailForm)}
          className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
        >
          {emailSent ? "Sent!" : "Email Report"}
        </button>

        {/* Download */}
        {report.id && (
          <a
            href={`/api/health-report/pdf/${report.id}`}
            className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
          >
            Download
          </a>
        )}

        {/* Regenerate */}
        <button
          onClick={regenerate}
          disabled={isGenerating}
          className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
        >
          Regenerate
        </button>
      </div>

      {/* Email form */}
      {showEmailForm && (
        <div className="mb-6 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] space-y-3">
          <input
            type="email"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            placeholder="Recipient email"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)]"
          />
          <input
            type="text"
            value={emailName}
            onChange={(e) => setEmailName(e.target.value)}
            placeholder="Recipient name (optional)"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)]"
          />
          <button
            onClick={handleEmail}
            disabled={emailSending || !emailTo.trim()}
            className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {emailSending ? "Sending..." : "Send Email"}
          </button>
        </div>
      )}

      {/* Expiry notice */}
      {report.expiresAt && (
        <p className="text-xs text-[var(--text-secondary)] mb-4">
          Share link expires{" "}
          {new Date(report.expiresAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      )}

      {/* Report content */}
      {report.reportData && <ReportView report={report.reportData} />}
    </div>
  );
}
