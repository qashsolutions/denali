"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  MountainIcon,
  HeartPulseIcon,
  ChatBubbleIcon,
  DiabetesIcon,
  ClaimsIcon,
} from "@/components/icons";
import { BRAND } from "@/config";

const NAV_ITEMS = [
  { label: "Health", href: "/app/health", Icon: HeartPulseIcon },
  { label: "Chat", href: "/app/chat", Icon: ChatBubbleIcon },
  { label: "Diabetes", href: "/app/diabetes", Icon: DiabetesIcon },
  { label: "Claims", href: "/app/claims", Icon: ClaimsIcon },
] as const;

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();

  // Split brand name to color "Health" separately
  const brandName = BRAND.NAME;
  const healthIndex = brandName.indexOf("Health");
  const prefix = healthIndex >= 0 ? brandName.slice(0, healthIndex) : brandName;
  const suffix = healthIndex >= 0 ? "Health" : "";

  return (
    <header className="hidden md:block sticky top-0 z-40 backdrop-blur-md bg-[var(--bg-primary)]/90 border-b border-[var(--border)]/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/app" className="flex items-center gap-2 group">
            <MountainIcon className="w-8 h-6 transition-transform group-hover:scale-105" />
            <span className="text-lg font-bold text-[var(--text-primary)]">
              {prefix}
              {suffix && (
                <span className="text-[var(--accent-secondary)]">{suffix}</span>
              )}
            </span>
          </Link>

          {/* Feature Nav */}
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            {NAV_ITEMS.map(({ label, href, Icon }) => {
              const isActive =
                pathname === href || pathname?.startsWith(href + "/");

              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Settings */}
          <button
            onClick={() => router.push("/app/settings")}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}
