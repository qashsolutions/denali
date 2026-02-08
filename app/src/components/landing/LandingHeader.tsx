"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  MountainIcon,
  ChatBubbleIcon,
  HeartPulseIcon,
  DiabetesIcon,
  DocumentTextIcon,
} from "../icons";

interface LandingHeaderProps {
  settings: Record<string, string>;
}

const NAV_ITEMS = [
  { label: "Health Records", href: "/app/health", Icon: HeartPulseIcon },
  { label: "Ask Denali", href: "/app/chat", Icon: ChatBubbleIcon },
  { label: "Diabetes", href: "/app/diabetes", Icon: DiabetesIcon },
  { label: "Blog", href: "/blog", Icon: DocumentTextIcon },
] as const;

export function LandingHeader({ settings }: LandingHeaderProps) {
  const brandName = settings.brand_name || "DenaliHealth";
  const tagline = settings.tagline || "Your Medicare companion for rural America";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Split brand name to color "Health" separately
  const healthIndex = brandName.indexOf("Health");
  const prefix = healthIndex >= 0 ? brandName.slice(0, healthIndex) : brandName;
  const suffix = healthIndex >= 0 ? "Health" : "";

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

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[var(--bg-primary)]/90 border-b border-[var(--border)]/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo + Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <MountainIcon className="w-10 h-8 sm:w-12 sm:h-10 transition-transform group-hover:scale-105" />
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
                {prefix}
                {suffix && (
                  <span className="text-[var(--accent-secondary)]">{suffix}</span>
                )}
              </span>
              <span className="hidden sm:block text-xs text-[var(--text-muted)] leading-tight">
                {tagline}
              </span>
            </div>
          </Link>

          {/* Feature Nav — desktop icons with tooltips above */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Features">
            {NAV_ITEMS.map(({ label, href, Icon }) => (
              <Link
                key={href}
                href={href}
                className="relative group flex items-center justify-center w-10 h-10 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
                aria-label={label}
              >
                <Icon className="w-5 h-5" />
                {/* Tooltip above */}
                <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs font-medium whitespace-nowrap opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-150">
                  {label}
                </span>
              </Link>
            ))}
          </nav>

          {/* Hamburger — mobile/tablet only */}
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

            {/* Dropdown menu */}
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] shadow-lg overflow-hidden">
                {NAV_ITEMS.map(({ label, href, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
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
