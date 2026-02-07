"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";

type Outcome = "approved" | "denied" | "partial" | "pending";

function OutcomeFormInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const outcomeParam = searchParams.get("outcome") as Outcome | null;

  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [earnedCredit, setEarnedCredit] = useState(false);

  const submitOutcome = useCallback(async (outcome: Outcome) => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Invalid or missing token.");
      return;
    }

    setStatus("submitting");

    try {
      const res = await fetch("/api/outcome-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, outcome }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(data.error || "Something went wrong.");
        return;
      }

      setEarnedCredit(data.earnedCredit ?? false);
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage("Network error. Please try again.");
    }
  }, [token]);

  // Auto-submit if outcome is in query string
  useEffect(() => {
    if (outcomeParam && ["approved", "denied", "partial", "pending"].includes(outcomeParam)) {
      submitOutcome(outcomeParam);
    }
  }, [outcomeParam, submitOutcome]);

  if (!token) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-600">This link appears to be invalid or expired.</p>
        <a href="https://denali.health" className="text-blue-600 hover:underline mt-4 inline-block">
          Go to denali.health
        </a>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <div className="text-4xl mb-4">🙏</div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Thank you!</h2>
        <p className="text-slate-600 mb-4">
          Your response helps other Medicare patients get fair decisions.
        </p>
        {earnedCredit && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-green-800 font-medium">
              You&apos;ve earned a free appeal credit!
            </p>
            <p className="text-green-700 text-sm mt-1">
              Use it anytime on denali.health.
            </p>
          </div>
        )}
        <a
          href="https://denali.health"
          className="inline-block mt-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to denali.health
        </a>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <div className="text-4xl mb-4">😟</div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Something went wrong</h2>
        <p className="text-slate-600 mb-4">{errorMessage}</p>
        <button
          onClick={() => setStatus("idle")}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (status === "submitting") {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <div className="animate-spin text-4xl mb-4">⏳</div>
        <p className="text-slate-600">Recording your response...</p>
      </div>
    );
  }

  // Idle state: show 3-button form
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
      <h2 className="text-xl font-semibold text-slate-900 mb-2 text-center">
        How did your appeal turn out?
      </h2>
      <p className="text-slate-500 text-sm text-center mb-6">
        One tap is all it takes. Your answer helps other patients.
      </p>
      <div className="space-y-3">
        <button
          onClick={() => submitOutcome("approved")}
          className="w-full py-4 px-6 bg-green-50 border-2 border-green-200 rounded-xl text-green-800 font-medium text-lg hover:bg-green-100 hover:border-green-300 transition-all min-h-[56px]"
        >
          ✓ Approved
        </button>
        <button
          onClick={() => submitOutcome("denied")}
          className="w-full py-4 px-6 bg-red-50 border-2 border-red-200 rounded-xl text-red-800 font-medium text-lg hover:bg-red-100 hover:border-red-300 transition-all min-h-[56px]"
        >
          ✗ Denied
        </button>
        <button
          onClick={() => submitOutcome("pending")}
          className="w-full py-4 px-6 bg-amber-50 border-2 border-amber-200 rounded-xl text-amber-800 font-medium text-lg hover:bg-amber-100 hover:border-amber-300 transition-all min-h-[56px]"
        >
          ⏳ Still Waiting
        </button>
      </div>
      <p className="text-slate-400 text-xs text-center mt-6">
        As a thank you, reporting your outcome earns you a free appeal.
      </p>
    </div>
  );
}

export default function OutcomeForm() {
  return (
    <Suspense fallback={
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    }>
      <OutcomeFormInner />
    </Suspense>
  );
}
