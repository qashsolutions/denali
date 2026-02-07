/**
 * Outcome Reporting Page
 *
 * Token-based one-click outcome reporting. No login required.
 * GET /outcome?token=xxx&outcome=approved
 *
 * If outcome is in the query string, auto-submits.
 * Otherwise shows a 3-button form.
 */

import { Metadata } from "next";
import OutcomeForm from "./OutcomeForm";

export const metadata: Metadata = {
  title: "Report Your Appeal Outcome | denali.health",
  description: "Let us know how your Medicare appeal turned out. Your response helps other patients.",
  robots: "noindex",
};

export default function OutcomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">denali.health</h1>
          <p className="text-slate-500 mt-1">Medicare Appeal Outcome</p>
        </div>
        <OutcomeForm />
      </div>
    </div>
  );
}
