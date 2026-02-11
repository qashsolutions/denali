"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import { useSettings } from "@/hooks/useSettings";
import { useConsent, type ConsentState } from "@/hooks/useConsent";
import { useAuth } from "@/hooks/useAuth";
import { TOTPEnrollModal } from "@/components/auth";
import { PRICING, formatPrice } from "@/config/pricing";

export default function AppSettingsPage() {
  const router = useRouter();
  const { isDark, setTheme } = useTheme();
  const { settings, setTextScale, resetSettings } = useSettings();
  const { consent, isLoading: consentLoading, updateConsent } = useConsent();
  const { authState, sendEmailOTP, verifyEmailOTP, enrollTOTP, challengeAndVerifyTOTP, signOut, clearError } = useAuth();
  const [showTOTPEnroll, setShowTOTPEnroll] = useState(false);
  const [totpEnrolled, setTotpEnrolled] = useState(authState.isMfaEnrolled);
  const [emailInput, setEmailInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

      {/* Account */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
          Account
        </h2>
        <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border)] space-y-4">
          {authState.isLoading ? (
            <div className="flex items-center gap-3 py-2">
              <div className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[var(--text-muted)]">Checking account...</p>
            </div>
          ) : authState.email ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {authState.email}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Signed in
                    {` \u00b7 ${authState.plan} plan`}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    await signOut();
                    router.push("/app");
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  Sign Out
                </button>
              </div>

              {/* Authenticator status — inline in Account section */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">Authenticator App</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {totpEnrolled || authState.isMfaEnrolled
                      ? "Enrolled — adds extra protection to your account"
                      : "Recommended if you connect Medicare"}
                  </p>
                </div>
                <button
                  onClick={() => setShowTOTPEnroll(true)}
                  disabled={totpEnrolled || authState.isMfaEnrolled}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    totpEnrolled || authState.isMfaEnrolled
                      ? "bg-green-500/10 text-green-600 cursor-default"
                      : "bg-[var(--accent-primary)] text-white hover:opacity-90"
                  }`}
                >
                  {totpEnrolled || authState.isMfaEnrolled ? "Enrolled" : "Set Up"}
                </button>
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="email-input" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Sign in with email
              </label>
              <p className="text-xs text-[var(--text-muted)] mb-3">
                Sign in to save conversations, generate appeal letters, and connect Medicare.
              </p>
              {!otpSent ? (
                <div className="flex gap-2">
                  <input
                    id="email-input"
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="you@example.com"
                    autoFocus
                    className="flex-1 px-3 py-3 rounded-lg text-sm bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-colors"
                  />
                  <button
                    onClick={async () => {
                      if (!emailInput) return;
                      setAuthLoading(true);
                      setAuthMessage("");
                      const ok = await sendEmailOTP(emailInput);
                      setAuthLoading(false);
                      if (ok) {
                        setOtpSent(true);
                        setAuthMessage("Check your email for a verification code.");
                      } else {
                        setAuthMessage("Failed to send code. Try again.");
                      }
                    }}
                    disabled={authLoading || !emailInput}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 transition-colors disabled:opacity-50"
                  >
                    {authLoading ? "Sending..." : "Send Code"}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    id="otp-input"
                    type="text"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    autoFocus
                    className="flex-1 px-3 py-3 rounded-lg text-sm bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-colors"
                  />
                  <button
                    onClick={async () => {
                      if (!otpInput) return;
                      setAuthLoading(true);
                      setAuthMessage("");
                      const ok = await verifyEmailOTP(emailInput, otpInput);
                      setAuthLoading(false);
                      if (ok) {
                        setAuthMessage("Signed in successfully!");
                        setOtpSent(false);
                        setOtpInput("");
                      } else {
                        setAuthMessage("Invalid code. Try again.");
                      }
                    }}
                    disabled={authLoading || !otpInput}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 transition-colors disabled:opacity-50"
                  >
                    {authLoading ? "Verifying..." : "Verify"}
                  </button>
                </div>
              )}
              {authMessage && (
                <p className="text-xs text-[var(--text-muted)] mt-2">{authMessage}</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Subscription */}
      {authState.email && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
            Subscription
          </h2>
          <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {authState.isAdmin
                    ? "Admin"
                    : authState.plan === "monthly"
                    ? "Unlimited Plan"
                    : authState.plan === "trial"
                    ? "Free Trial"
                    : authState.plan === "per_appeal"
                    ? "Pay Per Appeal"
                    : "Trial"}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {authState.isAdmin
                    ? "Unlimited access"
                    : authState.plan === "monthly"
                    ? `${formatPrice(PRICING.MONTHLY.amount)}/month \u00b7 ${authState.appealCredits} appeal credit${authState.appealCredits !== 1 ? "s" : ""} \u00b7 Unlimited messages`
                    : authState.plan === "per_appeal"
                    ? `${authState.appealCredits} appeal credit${authState.appealCredits !== 1 ? "s" : ""} \u00b7 5 messages/day`
                    : authState.plan === "trial" && authState.trialStatus === "active"
                    ? `${authState.trialDaysRemaining} days remaining \u00b7 ${authState.appealCredits} appeal credit${authState.appealCredits !== 1 ? "s" : ""}`
                    : authState.plan === "trial" && authState.trialStatus === "expired"
                    ? "Trial ended \u2014 upgrade to continue"
                    : "No active plan"}
                </p>
              </div>
              {authState.plan !== "monthly" && !authState.isAdmin && (
                <button
                  onClick={() => router.push("/app/chat")}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 transition-colors"
                >
                  Upgrade
                </button>
              )}
            </div>
          </div>
        </section>
      )}

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

      <TOTPEnrollModal
        isOpen={showTOTPEnroll}
        onClose={() => setShowTOTPEnroll(false)}
        onEnrolled={() => setTotpEnrolled(true)}
        onSkip={() => setShowTOTPEnroll(false)}
        enrollTOTP={enrollTOTP}
        challengeAndVerifyTOTP={challengeAndVerifyTOTP}
        isLoading={authState.isLoading}
        error={authState.error}
        clearError={clearError}
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
            description="Cache your Medicare data for faster access. Cached data refreshes every 24 hours."
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
      </section>

      {/* Delete Account */}
      {authState.email && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
            Danger Zone
          </h2>
          <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-red-500/20">
            {!showDeleteConfirm ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    Delete Account
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Permanently delete your account and all data. This cannot be undone.
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                >
                  Delete
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-red-600 mb-2">
                  Are you sure? This will permanently delete:
                </p>
                <ul className="text-xs text-[var(--text-muted)] mb-4 space-y-1 list-disc list-inside">
                  <li>All conversations and messages</li>
                  <li>Appeal letters and outcomes</li>
                  <li>Medicare health data connections</li>
                  <li>Subscription and payment history</li>
                </ul>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setDeleteLoading(true);
                      try {
                        const res = await fetch("/api/account/delete", {
                          method: "DELETE",
                          headers: { Authorization: "Bearer session" },
                        });
                        if (res.ok) {
                          await signOut();
                          router.push("/");
                        } else {
                          const data = await res.json();
                          alert(data.error || "Failed to delete account");
                        }
                      } catch {
                        alert("Failed to delete account. Please try again.");
                      } finally {
                        setDeleteLoading(false);
                        setShowDeleteConfirm(false);
                      }
                    }}
                    disabled={deleteLoading}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {deleteLoading ? "Deleting..." : "Yes, Delete Everything"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

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
