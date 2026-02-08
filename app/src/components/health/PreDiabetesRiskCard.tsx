"use client";

/**
 * Pre-Diabetes Risk Assessment Card
 *
 * CDC-based 7-question pre-diabetes risk test (public domain).
 * Shown on diabetes page when no FHIR data is available.
 */

import { useState, useCallback } from "react";
import Link from "next/link";

interface RiskQuestion {
  id: string;
  question: string;
  options: Array<{ label: string; points: number }>;
}

const RISK_QUESTIONS: RiskQuestion[] = [
  {
    id: "age",
    question: "How old are you?",
    options: [
      { label: "Under 40", points: 0 },
      { label: "40–49", points: 1 },
      { label: "50–59", points: 2 },
      { label: "60 or older", points: 3 },
    ],
  },
  {
    id: "gender",
    question: "Are you a man or a woman?",
    options: [
      { label: "Woman", points: 0 },
      { label: "Man", points: 1 },
    ],
  },
  {
    id: "family",
    question: "Does a parent or sibling have diabetes?",
    options: [
      { label: "No", points: 0 },
      { label: "Yes", points: 1 },
    ],
  },
  {
    id: "bp",
    question: "Have you been told you have high blood pressure?",
    options: [
      { label: "No", points: 0 },
      { label: "Yes", points: 1 },
    ],
  },
  {
    id: "activity",
    question: "Are you physically active?",
    options: [
      { label: "Yes", points: 0 },
      { label: "No", points: 1 },
    ],
  },
  {
    id: "weight",
    question: "What is your weight status?",
    options: [
      { label: "Normal weight", points: 0 },
      { label: "Overweight", points: 1 },
      { label: "Obese", points: 2 },
      { label: "Very obese", points: 3 },
    ],
  },
  {
    id: "gestational",
    question: "Have you ever been diagnosed with gestational diabetes?",
    options: [
      { label: "No / Not applicable", points: 0 },
      { label: "Yes", points: 1 },
    ],
  },
];

export function PreDiabetesRiskCard() {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showResult, setShowResult] = useState(false);

  const totalScore = Object.values(answers).reduce((sum, pts) => sum + pts, 0);
  const allAnswered = Object.keys(answers).length === RISK_QUESTIONS.length;

  const handleSelect = useCallback((questionId: string, points: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: points }));
    setShowResult(false);
  }, []);

  const handleSubmit = useCallback(() => {
    if (allAnswered) setShowResult(true);
  }, [allAnswered]);

  const handleReset = useCallback(() => {
    setAnswers({});
    setShowResult(false);
  }, []);

  return (
    <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] p-5">
      <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
        Pre-Diabetes Risk Assessment
      </h2>
      <p className="text-xs text-[var(--text-muted)] mb-4">
        Based on the CDC risk test. Answer these 7 questions to check your risk.
      </p>

      {!showResult ? (
        <>
          <div className="space-y-4">
            {RISK_QUESTIONS.map((q) => (
              <div key={q.id}>
                <p className="text-sm font-medium text-[var(--text-primary)] mb-2">
                  {q.question}
                </p>
                <div className="flex flex-wrap gap-2">
                  {q.options.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => handleSelect(q.id, opt.points)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        answers[q.id] === opt.points
                          ? "bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]"
                          : "bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/30"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="mt-4 w-full py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[var(--accent-primary)] text-white hover:opacity-90"
          >
            Check My Risk
          </button>
        </>
      ) : (
        <RiskResult score={totalScore} onReset={handleReset} />
      )}
    </div>
  );
}

function RiskResult({ score, onReset }: { score: number; onReset: () => void }) {
  const isHighRisk = score >= 5;

  return (
    <div className="text-center space-y-3">
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${
        isHighRisk
          ? "bg-red-500/10 text-red-600"
          : "bg-green-500/10 text-green-600"
      }`}>
        Score: {score} / 11
      </div>

      <p className="text-sm text-[var(--text-primary)]">
        {isHighRisk
          ? "Your score suggests you may be at higher risk for pre-diabetes. Ask your doctor about an A1C or fasting glucose test."
          : "Your score suggests lower risk, but regular screening is still recommended, especially after age 45."}
      </p>

      {isHighRisk && (
        <p className="text-sm text-[var(--text-secondary)]">
          Medicare covers annual diabetes screening for at-risk patients at no cost.
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Link
          href={`/app/chat?message=${encodeURIComponent(
            isHighRisk
              ? "I may be at risk for diabetes. What screening does Medicare cover?"
              : "What diabetes prevention does Medicare cover?"
          )}`}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium text-center bg-[var(--accent-primary)] text-white hover:opacity-90 transition-colors"
        >
          Ask Denali
        </Link>
        <button
          onClick={onReset}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium text-center bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          Retake
        </button>
      </div>

      <p className="text-xs text-[var(--text-muted)] pt-1">
        This is a screening tool, not a diagnosis. Only a doctor can diagnose diabetes.
      </p>
    </div>
  );
}
