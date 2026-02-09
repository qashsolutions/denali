"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { LabResult, DiabetesClassification } from "@/lib/fhir/transforms";

interface ScreeningRemindersProps {
  labs: LabResult[];
  classification: DiabetesClassification | null;
}

interface Reminder {
  severity: "amber" | "red";
  message: string;
  chatMessage: string;
}

function monthsSinceDate(dateStr: string): number | null {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  } catch {
    return null;
  }
}

export function ScreeningReminders({ labs, classification }: ScreeningRemindersProps) {
  const router = useRouter();

  const reminders = useMemo(() => {
    const result: Reminder[] = [];
    const latestA1C = labs.find((l) => l.name.toLowerCase().includes("a1c"));
    const isDiabetic = classification === "diabetic";

    if (latestA1C) {
      const months = monthsSinceDate(latestA1C.date);
      if (months != null) {
        if (months >= 12) {
          result.push({
            severity: "red",
            message: "Overdue for A1C screening",
            chatMessage: "My last A1C test was over a year ago. What should I do?",
          });
        } else if (months >= 6) {
          result.push({
            severity: "amber",
            message: "Time for an A1C check",
            chatMessage: "It's been 6 months since my last A1C. Should I get tested again?",
          });
        } else if (months >= 3 && isDiabetic) {
          result.push({
            severity: "amber",
            message: "A1C check may be due",
            chatMessage: "I'm diabetic and my last A1C was 3 months ago. Should I test again?",
          });
        }
      }
    } else if (isDiabetic) {
      result.push({
        severity: "red",
        message: "Schedule A1C baseline",
        chatMessage: "I have diabetes but no A1C on file. How do I get tested?",
      });
    }

    return result;
  }, [labs, classification]);

  if (reminders.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
        Screening Reminders
      </h2>
      {reminders.map((r, i) => (
        <div
          key={i}
          className={`rounded-xl border p-4 ${
            r.severity === "red"
              ? "bg-red-500/5 border-red-500/20"
              : "bg-amber-500/5 border-amber-500/20"
          }`}
        >
          <div className="flex items-start gap-3">
            <span className={`text-lg ${r.severity === "red" ? "text-red-500" : "text-amber-500"}`}>
              {r.severity === "red" ? "!" : "\u2022"}
            </span>
            <div className="flex-1">
              <p className={`text-sm font-medium ${
                r.severity === "red" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
              }`}>
                {r.message}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Medicare covers this at no cost
              </p>
              <button
                onClick={() => router.push(`/app/chat?message=${encodeURIComponent(r.chatMessage)}`)}
                className="text-xs font-medium text-[var(--accent-primary)] hover:underline mt-1"
              >
                Ask Denali
              </button>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
