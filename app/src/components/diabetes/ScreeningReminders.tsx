"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ScreeningHistory, DiabetesClassification } from "@/lib/fhir/transforms";

interface ScreeningRemindersProps {
  screenings: ScreeningHistory[];
  classification: DiabetesClassification | null;
}

interface Reminder {
  severity: "amber" | "red";
  message: string;
  detail: string;
  chatMessage: string;
}

export function ScreeningReminders({ screenings, classification }: ScreeningRemindersProps) {
  const router = useRouter();

  const reminders = useMemo(() => {
    const result: Reminder[] = [];
    const isDiabetic = classification === "diabetic";
    const isPreDiabetic = classification === "pre-diabetic";

    // Build a set of screening types we have
    const screeningMap = new Map<string, ScreeningHistory>();
    for (const s of screenings) {
      screeningMap.set(s.screeningType, s);
    }

    // A1C
    const a1c = screeningMap.get("a1c");
    if (a1c) {
      if (a1c.monthsSinceLast >= 12) {
        result.push({
          severity: "red",
          message: "Overdue for A1C screening",
          detail: `Last tested: ${a1c.lastDate}`,
          chatMessage: "My last A1C test was over a year ago. What should I do?",
        });
      } else if (a1c.monthsSinceLast >= 6) {
        result.push({
          severity: "amber",
          message: "Time for an A1C check",
          detail: `Last tested: ${a1c.lastDate}`,
          chatMessage: "It's been 6 months since my last A1C. Should I get tested again?",
        });
      } else if (a1c.monthsSinceLast >= 3 && isDiabetic) {
        result.push({
          severity: "amber",
          message: "A1C check may be due",
          detail: `Last tested: ${a1c.lastDate}`,
          chatMessage: "I'm diabetic and my last A1C was 3 months ago. Should I test again?",
        });
      }
    } else if (isDiabetic || isPreDiabetic) {
      result.push({
        severity: "red",
        message: "Schedule A1C baseline",
        detail: "No A1C test found in your records",
        chatMessage: "I have diabetes but no A1C on file. How do I get tested?",
      });
    }

    // Eye exam
    const eyeExam = screeningMap.get("eye-exam");
    if (isDiabetic) {
      if (eyeExam) {
        if (eyeExam.isOverdue) {
          result.push({
            severity: "amber",
            message: "Diabetic eye exam overdue",
            detail: `Last exam: ${eyeExam.lastDate}`,
            chatMessage: "My last diabetic eye exam was over a year ago. Does Medicare cover this?",
          });
        }
      } else {
        result.push({
          severity: "amber",
          message: "Schedule a diabetic eye exam",
          detail: "No eye exam found in your records",
          chatMessage: "I have diabetes and need a diabetic eye exam. Does Medicare cover it?",
        });
      }
    }

    // Kidney screening
    const kidney = screeningMap.get("kidney");
    if (isDiabetic) {
      if (kidney) {
        if (kidney.isOverdue) {
          result.push({
            severity: "amber",
            message: "Kidney screening overdue",
            detail: `Last screening: ${kidney.lastDate}`,
            chatMessage: "My kidney screening is overdue. Does Medicare cover this annually?",
          });
        }
      } else {
        result.push({
          severity: "amber",
          message: "Schedule kidney screening",
          detail: "No kidney screening found in your records",
          chatMessage: "I have diabetes. Does Medicare cover annual kidney screening?",
        });
      }
    }

    // DSMT
    const dsmt = screeningMap.get("dsmt");
    if ((isDiabetic || isPreDiabetic) && !dsmt) {
      result.push({
        severity: "amber",
        message: "Consider diabetes self-management training",
        detail: "No DSMT found in your records",
        chatMessage: "What is diabetes self-management training and does Medicare cover it?",
      });
    }

    return result;
  }, [screenings, classification]);

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
                {r.detail}
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
