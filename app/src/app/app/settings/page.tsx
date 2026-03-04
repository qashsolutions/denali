"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import { useSettings } from "@/hooks/useSettings";
import { useConsent, type ConsentState } from "@/hooks/useConsent";
import { useTopicPreferences } from "@/hooks/useTopicPreferences";
import { HEALTH_TOPICS } from "@/types/cms";
import type { HealthTopic } from "@/types/cms";
import { useAuth } from "@/hooks/useAuth";
import { TOTPEnrollModal } from "@/components/auth";
import { PaywallModal } from "@/components/payment/PaywallModal";
import { PRICING, formatPrice } from "@/config/pricing";

export default function AppSettingsPage() {
  const router = useRouter();
  const { isDark, setTheme } = useTheme();
  const { settings, setTextScale, resetSettings } = useSettings();
  const { consent, isLoading: consentLoading, updateConsent } = useConsent();
  const { topics: selectedTopics, isLoading: topicsLoading, toggleTopic } = useTopicPreferences();
  const { authState, sendEmailOTP, verifyEmailOTP, enrollTOTP, unenrollTOTP, challengeAndVerifyTOTP, confirmTOTPEnrollment, signOut, clearError } = useAuth();
  const [showTOTPEnroll, setShowTOTPEnroll] = useState(false);
  const [showTOTPRemoveConfirm, setShowTOTPRemoveConfirm] = useState(false);
  const [unenrollLoading, setUnenrollLoading] = useState(false);
  const [totpEnrolled, setTotpEnrolled] = useState(authState.isMfaEnrolled);
  const [emailInput, setEmailInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authMessageType, setAuthMessageType] = useState<"success" | "error" | "">("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; description: string; createdAt: string | null; count: number }>>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLimit, setAuditLimit] = useState(50);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [auditExpanded, setAuditExpanded] = useState(false);

  useEffect(() => {
    if (!authState.email) return;
    setAuditLoading(true);
    fetch(`/api/audit-log?limit=${auditLimit}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.logs) {
          setAuditLogs(
            data.logs.map((l: { id: string; description: string; createdAt: string | null; created_at?: string | null; count?: number }) => ({
              id: l.id,
              description: l.description,
              createdAt: l.createdAt || l.created_at || null,
              count: l.count ?? 1,
            }))
          );
          setAuditHasMore(data.hasMore ?? false);
        }
      })
      .catch(() => {})
      .finally(() => setAuditLoading(false));
  }, [authState.email, auditLimit]);

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
                    {authState.isAdmin ? " \u00b7 Admin" : ` \u00b7 ${authState.plan} plan`}
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
              <div className="pt-3 border-t border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Authenticator App</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {totpEnrolled || authState.isMfaEnrolled
                        ? "Enrolled — adds extra protection to your account"
                        : "Recommended if you connect Medicare"}
                    </p>
                  </div>
                  {totpEnrolled || authState.isMfaEnrolled ? (
                    <button
                      onClick={() => setShowTOTPRemoveConfirm(true)}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500/10 text-green-600 hover:bg-red-500/10 hover:text-red-600 transition-colors"
                    >
                      Enrolled
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowTOTPEnroll(true)}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 transition-colors"
                    >
                      Set Up
                    </button>
                  )}
                </div>

                {/* TOTP removal confirmation */}
                {showTOTPRemoveConfirm && (
                  <div className="mt-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                    <p className="text-sm text-[var(--text-primary)] mb-1 font-medium">
                      Remove authenticator?
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mb-3">
                      Your authenticator app helps protect your Medicare health data. Removing it makes your account less secure.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowTOTPRemoveConfirm(false)}
                        className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 transition-colors"
                      >
                        Keep It
                      </button>
                      <button
                        onClick={async () => {
                          setUnenrollLoading(true);
                          const ok = await unenrollTOTP();
                          setUnenrollLoading(false);
                          if (ok) {
                            setTotpEnrolled(false);
                            setShowTOTPRemoveConfirm(false);
                          }
                        }}
                        disabled={unenrollLoading}
                        className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      >
                        {unenrollLoading ? "Removing..." : "Yes, Remove"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="email-input" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Sign in with email
              </label>
              <p className="text-xs text-[var(--text-muted)] mb-3">
                Sign in to save conversations, generate appeal letters, and connect Medicare. By signing in, you agree to our{" "}
                <a href="/terms" className="text-[var(--accent-primary)] hover:underline">Terms of Service</a> and{" "}
                <a href="/privacy" className="text-[var(--accent-primary)] hover:underline">Privacy Policy</a>.
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
                      setAuthMessageType("");
                      const ok = await sendEmailOTP(emailInput);
                      setAuthLoading(false);
                      if (ok) {
                        setOtpSent(true);
                        setAuthMessage("Check your email for a verification code.");
                        setAuthMessageType("success");
                      } else {
                        setAuthMessage("Failed to send code. Try again.");
                        setAuthMessageType("error");
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
                      setAuthMessageType("");
                      const result = await verifyEmailOTP(emailInput, otpInput);
                      setAuthLoading(false);
                      if (result.success) {
                        setAuthMessage("Signed in successfully!");
                        setAuthMessageType("success");
                        setOtpSent(false);
                        setOtpInput("");
                      } else {
                        setAuthMessage("Invalid code. Try again.");
                        setAuthMessageType("error");
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
                <p className={`mt-2 ${authMessageType === "error" ? "text-sm font-medium text-red-500" : "text-xs text-green-600"}`}>{authMessage}</p>
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
                    ? "Monthly Plan"
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
                    ? `${formatPrice(PRICING.MONTHLY.amount)}/month \u00b7 ${authState.appealCredits} appeal credit${authState.appealCredits !== 1 ? "s" : ""}/month \u00b7 Unlimited messages`
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
                  onClick={() => setShowPaywall(true)}
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

      {/* Content Preferences */}
      {authState.email && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
            Content Preferences
          </h2>
          <p className="text-xs text-[var(--text-muted)] mb-4">
            Choose up to 2 health topics. Your blog feed will show articles matching your interests.
          </p>
          <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border)]">
            {topicsLoading ? (
              <div className="flex items-center gap-3 py-2">
                <div className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-[var(--text-muted)]">Loading preferences...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {HEALTH_TOPICS.map((topic) => {
                  const isActive = selectedTopics.includes(topic.value);
                  return (
                    <button
                      key={topic.value}
                      onClick={() => toggleTopic(topic.value)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors text-left ${
                        isActive
                          ? "bg-[var(--accent-primary)]/10 border-2 border-[var(--accent-primary)]"
                          : "bg-[var(--bg-tertiary)] border-2 border-transparent hover:border-[var(--border)]"
                      }`}
                      aria-pressed={isActive}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isActive ? "text-[var(--accent-primary)]" : "text-[var(--text-primary)]"}`}>
                          {topic.label}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">{topic.description}</p>
                      </div>
                      {isActive && (
                        <span className="ml-3 shrink-0 w-5 h-5 rounded-full bg-[var(--accent-primary)] flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
                {selectedTopics.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)] pt-1">
                    No topics selected — you&apos;ll see a mix of all articles.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        onSuccess={() => {
          setShowPaywall(false);
          router.push("/app/chat?payment=success");
        }}
        appealCount={authState.appealCount}
        trialExpired={authState.trialStatus === "expired"}
      />

      <TOTPEnrollModal
        isOpen={showTOTPEnroll}
        onClose={() => setShowTOTPEnroll(false)}
        onEnrolled={() => setTotpEnrolled(true)}
        onSkip={() => setShowTOTPEnroll(false)}
        enrollTOTP={enrollTOTP}
        confirmTOTPEnrollment={confirmTOTPEnrollment}
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
            description="Allow Ask Denali to include your Medicare claims and coverage in AI conversations. This data is sent to Anthropic's Claude AI to generate personalized guidance."
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

      {/* Activity Log */}
      {authState.email && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
            Data Access History
          </h2>
          <p className="text-xs text-[var(--text-muted)] mb-4">
            A record of when your Medicare data was accessed, by whom, and for what purpose.
          </p>
          <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border)]">
            {auditLoading ? (
              <div className="flex items-center gap-3 py-2">
                <div className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-[var(--text-muted)]">Loading activity...</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-2">No activity recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {(auditExpanded ? auditLogs : auditLogs.slice(0, 3)).map((log) => (
                  <div key={log.id} className="flex items-center justify-between gap-4">
                    <p className="text-sm text-[var(--text-primary)]">
                      {log.description}
                      {log.count > 1 && (
                        <span className="text-xs text-[var(--text-muted)] ml-1">
                          ({"\u00d7"}{log.count})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] shrink-0">
                      {formatRelativeTime(log.createdAt)}
                    </p>
                  </div>
                ))}
                {auditLogs.length > 3 && (
                  <button
                    onClick={() => setAuditExpanded(!auditExpanded)}
                    className="mt-1 text-xs text-[var(--accent-primary)] hover:underline"
                  >
                    {auditExpanded
                      ? "Show less \u2191"
                      : `Show ${auditLogs.length - 3} more \u2193`}
                  </button>
                )}
                {auditHasMore && auditExpanded && (
                  <button
                    onClick={() => setAuditLimit(200)}
                    className="mt-1 text-xs text-[var(--text-muted)] hover:underline"
                  >
                    Load all activity &rarr;
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

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

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
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
