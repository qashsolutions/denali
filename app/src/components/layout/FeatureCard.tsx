"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  accentColor?: string;
  badge?: string;
}

export function FeatureCard({
  href,
  icon,
  title,
  description,
  accentColor = "var(--accent-primary)",
  badge,
}: FeatureCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col items-start p-6 rounded-2xl",
        "bg-[var(--bg-secondary)] border border-[var(--border)]",
        "hover:border-[var(--accent-primary)] hover:shadow-lg",
        "transition-all duration-200",
        "min-h-[140px]"
      )}
    >
      {badge && (
        <span
          className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{
            color: accentColor,
            backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
          }}
        >
          {badge}
        </span>
      )}

      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
        style={{
          backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
          color: accentColor,
        }}
      >
        {icon}
      </div>

      <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
        {title}
      </h3>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
        {description}
      </p>
    </Link>
  );
}
