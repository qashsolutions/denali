"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  HomeIcon,
  HeartPulseIcon,
  ChatBubbleIcon,
  GearIcon,
} from "@/components/icons";

const TABS = [
  {
    label: "Home",
    href: "/app",
    Icon: HomeIcon,
    exact: true,
  },
  {
    label: "MyHealth",
    href: "/app/health",
    Icon: HeartPulseIcon,
  },
  {
    label: "Ask Denali",
    href: "/app/chat",
    Icon: ChatBubbleIcon,
  },
  {
    label: "Settings",
    href: "/app/settings",
    Icon: GearIcon,
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
        {TABS.map(({ label, href, Icon, ...rest }) => {
          const exact = "exact" in rest && rest.exact;
          const isActive = exact
            ? pathname === href
            : pathname === href || pathname?.startsWith(href + "/");

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
