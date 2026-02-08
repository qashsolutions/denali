"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  MountainIcon,
  HeartPulseIcon,
  ChatBubbleIcon,
  DiabetesIcon,
  DocumentTextIcon,
  GearIcon,
} from "@/components/icons";
import { BRAND } from "@/config";
import { createClient } from "@/lib/supabase";

const NAV_ITEMS = [
  { label: "Health", href: "/app/health", Icon: HeartPulseIcon, color: "text-rose-500" },
  { label: "Ask Denali", href: "/app/chat", Icon: ChatBubbleIcon, color: "text-blue-500" },
  { label: "Diabetes", href: "/app/diabetes", Icon: DiabetesIcon, color: "text-emerald-500" },
  { label: "Blog", href: "/blog", Icon: DocumentTextIcon, color: "text-violet-500" },
] as const;

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<{
    displayName: string;
    lastSignIn: string | null;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Check auth state
  useEffect(() => {
    const supabase = createClient();

    function updateUser(session: { user: { email?: string; user_metadata?: Record<string, string>; last_sign_in_at?: string } } | null) {
      if (!session?.user) {
        setUserInfo(null);
        return;
      }
      const u = session.user;
      const name = u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split("@")[0] || "User";
      setUserInfo({
        displayName: name,
        lastSignIn: u.last_sign_in_at || null,
      });
    }

    supabase.auth.getSession().then(({ data: { session } }) => updateUser(session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => updateUser(session));
    return () => subscription.unsubscribe();
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // Split brand name to color "Health" separately
  const brandName = BRAND.NAME;
  const healthIndex = brandName.indexOf("Health");
  const prefix = healthIndex >= 0 ? brandName.slice(0, healthIndex) : brandName;
  const suffix = healthIndex >= 0 ? "Health" : "";

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-[var(--bg-primary)]/90 border-b border-[var(--border)]/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <MountainIcon className="w-8 h-6 transition-transform group-hover:scale-105" />
            <span className="text-lg font-bold text-[var(--text-primary)]">
              {prefix}
              {suffix && (
                <span className="text-[var(--accent-secondary)]">{suffix}</span>
              )}
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {NAV_ITEMS.map(({ label, href, Icon, color }) => {
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
                  <Icon className={cn("w-4 h-4", !isActive && color)} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right side: User info or Sign In + Mobile hamburger */}
          <div className="flex items-center gap-1">
            {userInfo ? (
              <button
                onClick={() => router.push("/app/settings")}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                aria-label="Settings"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-[var(--text-primary)] leading-tight">
                    {userInfo.displayName}
                  </p>
                  {userInfo.lastSignIn && (
                    <p className="text-[10px] italic text-[var(--text-muted)] leading-tight">
                      Last signed in {formatRelativeTime(userInfo.lastSignIn)}
                    </p>
                  )}
                </div>
                <GearIcon className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            ) : (
              <Link
                href="/app/settings"
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 transition-colors"
              >
                Sign In
              </Link>
            )}

            {/* Hamburger — mobile only */}
            <div className="relative md:hidden" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
                aria-label="Menu"
                aria-expanded={menuOpen}
              >
                {menuOpen ? (
                  <XIcon className="w-5 h-5" />
                ) : (
                  <HamburgerIcon className="w-5 h-5" />
                )}
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] shadow-lg overflow-hidden">
                  {NAV_ITEMS.map(({ label, href, Icon, color }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <Icon className={cn("w-4 h-4", color)} />
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function HamburgerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
