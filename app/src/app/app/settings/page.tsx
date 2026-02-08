"use client";

import { useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { useSettings } from "@/hooks/useSettings";
import { useConsent, type ConsentState } from "@/hooks/useConsent";
import { PasskeyEnrollModal } from "@/components/auth";

export default function AppSettingsPage() {
  const { isDark, setTheme } = useTheme();
  const { settings, setTextScale, resetSettings } = useSettings();
  const { consent, isLoading: consentLoading, updateConsent } = useConsent();
  const [showPasskeyEnroll, setShowPasskeyEnroll] = useState(false);
  const [passkeyEnrolled, setPasskeyEnrolled] = useState(false);

  const textScaleOptions = [
    { value: 0.9, label: "Small" },
    { value: 1, label: "Default" },
    { value: 1.1, label: "Large" },
    { value: 1.2, label: "X-Large" },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-6">
        Settings
      </h1>

      {/* Appearance */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
          Appearance
        </h2>
        <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border)]">
          <label className="block text-[var(--text-primary)] font-medium mb-3">
            Theme
          </label>
          <div className="flex gap-3">
            <ThemeButton
              label="Light"
              icon={<SunIcon className="w-6 h-6" />}
              active={!isDark}
              onClick={() => setTheme("light")}
            />
            <ThemeButton
              label="Dark"
              icon={<MoonIcon className="w-6 h-6" />}
              active={isDark}
              onClick={() => setTheme("dark")}
            />
          </div>
        </div>
      </section>

      {/* Text Size */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
          Accessibility
        </h2>
        <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border)]">
          <label className="block text-[var(--text-primary)] font-medium mb-3">
            Text Size
          </label>
          <div className="flex gap-2 flex-wrap">
            {textScaleOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setTextScale(option.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  settings.textScale === option.value
                    ? "bg-[var(--accent-primary)] text-white"
                    : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/80"
                }`}
                aria-pressed={settings.textScale === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p
            className="text-[var(--text-muted)] mt-3"
            style={{ fontSize: `${settings.textScale}rem` }}
          >
            Preview: The quick brown fox jumps over the lazy dog.
          </p>
        </div>
      </section>

      {/* Security */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
          Security
        </h2>
        <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Passkey</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {passkeyEnrolled
                  ? "Passkey enrolled — used for sensitive operations"
                  : "Add a passkey for stronger identity verification"}
              </p>
            </div>
            <button
              onClick={() => setShowPasskeyEnroll(true)}
              disabled={passkeyEnrolled}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                passkeyEnrolled
                  ? "bg-green-500/10 text-green-600 cursor-default"
                  : "bg-[var(--accent-primary)] text-white hover:opacity-90"
              }`}
            >
              {passkeyEnrolled ? "Enrolled" : "Set Up"}
            </button>
          </div>
        </div>
      </section>

      <PasskeyEnrollModal
        open={showPasskeyEnroll}
        onClose={() => setShowPasskeyEnroll(false)}
        onSuccess={() => setPasskeyEnrolled(true)}
      />

      {/* Privacy & Data */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
          Privacy &amp; Data
        </h2>
        <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border)] space-y-4">
          <ConsentToggle
            label="Use health data in AI conversations"
            description="Allow Ask Denali to reference your Medicare claims and coverage when giving guidance."
            checked={consent.health_data_ai}
            loading={consentLoading}
            onChange={(v) => updateConsent("health_data_ai", v)}
          />
          <ConsentToggle
            label="Store health data locally"
            description="Cache your Blue Button data for faster access. Cached data refreshes every 24 hours."
            checked={consent.health_data_storage}
            loading={consentLoading}
            onChange={(v) => updateConsent("health_data_storage", v)}
          />
          <ConsentToggle
            label="Usage analytics"
            description="Help us improve Denali by sharing anonymous usage patterns."
            checked={consent.analytics}
            loading={consentLoading}
            onChange={(v) => updateConsent("analytics", v)}
          />
        </div>
        <a
          href="/faq"
          className="inline-block mt-3 text-sm text-[var(--accent-primary)] hover:underline"
        >
          Privacy FAQ &amp; data practices
        </a>
      </section>

      {/* Reset */}
      <section>
        <button
          onClick={() => {
            resetSettings();
            setTheme("dark");
          }}
          className="w-full py-3 px-4 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors font-medium"
        >
          Reset to Defaults
        </button>
      </section>
    </div>
  );
}

function ThemeButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-4 px-4 rounded-xl flex flex-col items-center gap-2 transition-colors border-2 ${
        active
          ? "bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] text-[var(--accent-primary)]"
          : "bg-[var(--bg-tertiary)] border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/80"
      }`}
      aria-pressed={active}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function ConsentToggle({
  label,
  description,
  checked,
  loading,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  loading: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        disabled={loading}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
          checked ? "bg-[var(--accent-primary)]" : "bg-[var(--bg-tertiary)]"
        } ${loading ? "opacity-50" : ""}`}
      >
        <span
          className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-[2px]"
          }`}
        />
      </button>
    </div>
  );
}
