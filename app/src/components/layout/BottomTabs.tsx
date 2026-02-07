"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  HeartPulseIcon,
  ChatBubbleIcon,
  DiabetesIcon,
  ClaimsIcon,
} from "@/components/icons";

const TABS = [
  {
    label: "Health",
    href: "/app/health",
    Icon: HeartPulseIcon,
  },
  {
    label: "Chat",
    href: "/app/chat",
    Icon: ChatBubbleIcon,
  },
  {
    label: "Diabetes",
    href: "/app/diabetes",
    Icon: DiabetesIcon,
  },
  {
    label: "Claims",
    href: "/app/claims",
    Icon: ClaimsIcon,
  },
] as const;

export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-primary)] border-t border-[var(--border)] md:hidden"
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {TABS.map(({ label, href, Icon }) => {
          const isActive =
            pathname === href || pathname?.startsWith(href + "/");

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[48px] rounded-lg px-2 py-1 transition-colors",
                isActive
                  ? "text-[var(--accent-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "w-6 h-6",
                  isActive && "stroke-[2]"
                )}
              />
              <span className="text-[10px] font-medium leading-none">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
