"use client";

import { useState } from "react";
import type { NewLogEntry, LogEntry } from "@/hooks/useDiabetesLog";

interface QuickLogProps {
  entries: LogEntry[];
  onAdd: (entry: NewLogEntry) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

type Tab = "glucose" | "activity" | "meal" | "note";

const TABS: { key: Tab; label: string }[] = [
  { key: "glucose", label: "Glucose" },
  { key: "activity", label: "Activity" },
  { key: "meal", label: "Meal" },
  { key: "note", label: "Note" },
];

const CONTEXT_OPTIONS = [
  { value: "fasting", label: "Fasting" },
  { value: "before_meal", label: "Before meal" },
  { value: "after_meal", label: "After meal" },
  { value: "bedtime", label: "Bedtime" },
  { value: "other", label: "Other" },
];

function formatLogDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function entryIcon(type: string): string {
  switch (type) {
    case "glucose": return "\u{1F4C9}";
    case "activity": return "\u{1F3C3}";
    case "meal": return "\u{1F37D}";
    case "note": return "\u{1F4DD}";
    default: return "\u2022";
  }
}

function entryLabel(e: LogEntry): string {
  switch (e.entry_type) {
    case "glucose":
      return `${e.glucose_value} mg/dL${e.glucose_context ? ` (${e.glucose_context.replace("_", " ")})` : ""}`;
    case "activity":
      return `${e.activity_minutes} min${e.activity_type ? ` ${e.activity_type}` : ""}`;
    case "meal":
      return e.note ?? "Meal logged";
    case "note":
      return e.note ?? "Note";
    default:
      return "";
  }
}

export function QuickLog({ entries, onAdd, onDelete }: QuickLogProps) {
  const [tab, setTab] = useState<Tab>("glucose");
  const [saving, setSaving] = useState(false);

  // Form state
  const [glucoseValue, setGlucoseValue] = useState("");
  const [glucoseContext, setGlucoseContext] = useState("fasting");
  const [activityMinutes, setActivityMinutes] = useState("");
  const [activityType, setActivityType] = useState("");
  const [noteText, setNoteText] = useState("");

  const resetForm = () => {
    setGlucoseValue("");
    setGlucoseContext("fasting");
    setActivityMinutes("");
    setActivityType("");
    setNoteText("");
  };

  const handleSubmit = async () => {
    setSaving(true);
    let entry: NewLogEntry;

    switch (tab) {
      case "glucose":
        if (!glucoseValue) { setSaving(false); return; }
        entry = { entry_type: "glucose", glucose_value: Number(glucoseValue), glucose_context: glucoseContext };
        break;
      case "activity":
        if (!activityMinutes) { setSaving(false); return; }
        entry = { entry_type: "activity", activity_minutes: Number(activityMinutes), activity_type: activityType || undefined };
        break;
      case "meal":
        if (!noteText) { setSaving(false); return; }
        entry = { entry_type: "meal", note: noteText };
        break;
      case "note":
        if (!noteText) { setSaving(false); return; }
        entry = { entry_type: "note", note: noteText };
        break;
    }

    const ok = await onAdd(entry);
    if (ok) resetForm();
    setSaving(false);
  };

  const recent = entries.slice(0, 5);

  return (
    <section>
      <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
        Daily Log
      </h2>
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] p-4 space-y-4">
        {/* Tab buttons */}
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                tab === t.key
                  ? "bg-[var(--accent-primary)] text-white"
                  : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="space-y-3">
          {tab === "glucose" && (
            <>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="mg/dL"
                  value={glucoseValue}
                  onChange={(e) => setGlucoseValue(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                />
                <select
                  value={glucoseContext}
                  onChange={(e) => setGlucoseContext(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-sm text-[var(--text-primary)]"
                >
                  {CONTEXT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {tab === "activity" && (
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Minutes"
                value={activityMinutes}
                onChange={(e) => setActivityMinutes(e.target.value)}
                className="w-24 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
              <input
                type="text"
                placeholder="Type (e.g. walking)"
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
            </div>
          )}

          {(tab === "meal" || tab === "note") && (
            <input
              type="text"
              placeholder={tab === "meal" ? "What did you eat?" : "Add a note..."}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          )}

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-2.5 rounded-lg text-sm font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Log Entry"}
          </button>
        </div>

        {/* Recent entries */}
        {recent.length > 0 && (
          <div className="border-t border-[var(--border)] pt-3 space-y-2">
            <p className="text-xs font-medium text-[var(--text-muted)]">Recent</p>
            {recent.map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-sm">
                <span className="text-xs">{entryIcon(e.entry_type)}</span>
                <span className="flex-1 text-[var(--text-secondary)] truncate">{entryLabel(e)}</span>
                <span className="text-xs text-[var(--text-muted)]">{formatLogDate(e.logged_at)}</span>
                <button
                  onClick={() => onDelete(e.id)}
                  className="text-xs text-[var(--text-muted)] hover:text-red-500 transition-colors p-1"
                  title="Delete"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
