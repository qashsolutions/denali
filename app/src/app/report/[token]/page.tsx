/**
 * Public Report Page (SSR)
 *
 * /report/[token] — No auth required.
 * SHIP counselors and caregivers open this link to view the patient's report.
 */

import { notFound } from "next/navigation";
import { ReportView } from "@/components/health/ReportView";
import type { HealthReport } from "@/lib/health-report";
import { getBaseUrl } from "@/config";

interface PageProps {
  params: Promise<{ token: string }>;
}

async function fetchReport(token: string) {
  // Use internal API call (server-side)
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/api/health-report/share/${token}`, {
    cache: "no-store",
  });

  if (!res.ok) return null;

  const data = await res.json();
  return data.report as {
    data: HealthReport;
    expiresAt: string;
    createdAt: string;
  } | null;
}

export default async function PublicReportPage({ params }: PageProps) {
  const { token } = await params;
  const report = await fetchReport(token);

  if (!report?.data) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="px-4 py-8 sm:py-12">
        <ReportView
          report={report.data}
          expiresAt={report.expiresAt}
          isPublic
        />
      </div>

      {/* Print-friendly styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

export function generateMetadata() {
  return {
    title: "Medicare Health Summary Report — Denali Health",
    description:
      "A personalized Medicare health summary generated from claims data.",
    robots: "noindex, nofollow",
  };
}
