"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  MountainIcon,
  HeartPulseIcon,
  ChatBubbleIcon,
  DocumentTextIcon,
  GearIcon,
} from "@/components/icons";
import { BRAND } from "@/config";

const NAV_ITEMS = [
  { label: "Health", href: "/app/health", Icon: HeartPulseIcon, color: "text-rose-500" },
  { label: "Ask Denali", href: "/app/chat", Icon: ChatBubbleIcon, color: "text-blue-500" },
  { label: "Blog", href: "/blog", Icon: DocumentTextIcon, color: "text-violet-500" },
] as const;

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<{
    displayName: string;
    email: string;
    initial: string;
    lastSignIn: string | null;
    planLabel: string;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  // Check auth state
  useEffect(() => {
    const planLabels: Record<string, string> = {
      monthly: "Monthly Plan",
      per_appeal: "Pay Per Appeal",
      trial: "Trial",
    };

    async function loadUser() {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) { setUserInfo(null); return; }
        const data = await res.json();
        if (!data.authenticated || !data.email) { setUserInfo(null); return; }

        const email: string = data.email;
        const name = email.split("@")[0] || "User";
        const label = data.isAdmin ? "Admin" : (planLabels[data.plan] || "Trial");
        setUserInfo({
          displayName: name,
          email,
          initial: name.charAt(0).toUpperCase(),
          lastSignIn: null,
          planLabel: label,
        });
      } catch {
        setUserInfo(null);
      }
    }

    loadUser();

    // Listen for sign-in / sign-out from useAuth
    function handleAuthChange(e: Event) {
      const user = (e as CustomEvent<{ email: string; userId: string } | null>).detail;
      if (user) {
        loadUser(); // Reload to get plan label
      } else {
        setUserInfo(null);
      }
    }

    window.addEventListener("auth-state-change", handleAuthChange);
    return () => window.removeEventListener("auth-state-change", handleAuthChange);
  }, []);

  // Close menus on outside click
  useEffect(() => {
    if (!menuOpen && !accountOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (accountOpen && accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen, accountOpen]);

  async function handleSignOut() {
    setAccountOpen(false);
    await fetch("/api/auth/signout", { method: "POST" });
    setUserInfo(null);
    window.dispatchEvent(new CustomEvent("auth-state-change", { detail: null }));
    router.push("/");
  }

  // Split brand name to color "Health" separately
  const brandName = BRAND.NAME;
  const healthIndex = brandName.indexOf("Health");
  const prefix = healthIndex >= 0 ? brandName.slice(0, healthIndex) : brandName;
  const suffix = healthIndex >= 0 ? "Health" : "";

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-[var(--bg-primary)]/90 border-b border-[var(--border)]/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center h-14 sm:h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group mr-auto">
            <MountainIcon className="w-8 h-8 sm:w-10 sm:h-10 transition-transform group-hover:scale-105" />
            <div className="flex flex-col">
              <span className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-tight">
                {prefix}
                {suffix && (
                  <span className="text-[var(--brand-purple)]">{suffix}</span>
                )}
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 mr-2" aria-label="Main navigation">
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

          {/* Right side: Account avatar or Sign In + Mobile hamburger */}
          <div className="flex items-center gap-1">
            {userInfo ? (
              <div className="relative" ref={accountRef}>
                {/* Avatar trigger */}
                <button
                  onClick={() => setAccountOpen(!accountOpen)}
                  className="w-9 h-9 rounded-full bg-[var(--accent-primary)] text-white text-sm font-semibold flex items-center justify-center hover:opacity-90 transition-opacity"
                  aria-label="Account menu"
                  aria-expanded={accountOpen}
                >
                  {userInfo.initial}
                </button>

                {/* Account popover */}
                {accountOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] shadow-xl overflow-hidden z-50 animate-popover-in">
                    {/* Header */}
                    <div className="px-5 pt-5 pb-4 text-center">
                      <p className="text-xs text-[var(--text-muted)] mb-3">
                        {userInfo.email}
                      </p>
                      <div className="w-16 h-16 rounded-full bg-[var(--accent-primary)] text-white text-2xl font-bold flex items-center justify-center mx-auto mb-3">
                        {userInfo.initial}
                      </div>
                      <p className="text-lg font-semibold text-[var(--text-primary)]">
                        Hi, {userInfo.displayName}!
                      </p>
                      <span className="inline-block mt-2 px-3 py-0.5 rounded-full text-xs font-medium bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                        {userInfo.planLabel}
                      </span>
                      {userInfo.lastSignIn && (
                        <p className="text-xs italic text-[var(--text-muted)] mt-2">
                          Last signed in {formatRelativeTime(userInfo.lastSignIn)}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="border-t border-[var(--border)] px-2 py-2">
                      <Link
                        href="/app/settings"
                        onClick={() => setAccountOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <GearIcon className="w-4 h-4" />
                        Settings
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <SignOutIcon className="w-4 h-4" />
                        Sign out
                      </button>
                    </div>

                    {/* Footer links */}
                    <div className="border-t border-[var(--border)] px-5 py-3 flex items-center justify-center gap-3 text-xs text-[var(--text-muted)]">
                      <Link href="/privacy" onClick={() => setAccountOpen(false)} className="hover:text-[var(--text-secondary)] transition-colors">
                        Privacy Policy
                      </Link>
                      <span>·</span>
                      <Link href="/faq" onClick={() => setAccountOpen(false)} className="hover:text-[var(--text-secondary)] transition-colors">
                        FAQ
                      </Link>
                    </div>
                  </div>
                )}
              </div>
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
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] shadow-lg overflow-hidden animate-popover-in">
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

function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3-3l3-3m0 0l-3-3m3 3H9" />
    </svg>
  );
}
