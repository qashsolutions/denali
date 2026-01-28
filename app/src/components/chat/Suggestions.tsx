"use client";

import { cn } from "@/lib/utils";

export interface SuggestionsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  disabled?: boolean;
}

export function Suggestions({
  suggestions,
  onSelect,
  disabled = false,
}: SuggestionsProps) {
  if (!suggestions.length) return null;

  return (
    <div className="suggestions flex flex-wrap gap-2 px-1">
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          onClick={() => onSelect(suggestion)}
          disabled={disabled}
          className={cn(
            "px-4 py-2.5 rounded-full",
            "text-sm font-bold",
            "text-white",
            "bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/50",
            "transition-all duration-[var(--transition-fast)]",
            "hover:bg-[var(--accent-primary)]/40 hover:border-[var(--accent-primary)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "whitespace-nowrap"
          )}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}

export interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
  disabled?: boolean;
}

export function QuickAction({
  icon,
  label,
  description,
  onClick,
  disabled = false,
}: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-3 w-full p-4 rounded-xl",
        "bg-[var(--bg-secondary)] border border-[var(--border)]",
        "text-left transition-colors duration-[var(--transition-fast)]",
        "hover:bg-[var(--bg-tertiary)] hover:border-[var(--accent-primary)]",
        "focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]",
        "disabled:opacity-50 disabled:cursor-not-allowed"
      )}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--accent-primary)]">
        {icon}
      </div>
      <div>
        <div className="font-medium text-[var(--text-primary)]">{label}</div>
        {description && (
          <div className="text-sm text-[var(--text-muted)]">{description}</div>
        )}
      </div>
    </button>
  );
}
