"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  GENDER_IDENTITY_VALUES,
  GENDER_IDENTITY_LABELS,
  SEX_AT_BIRTH_UI_OPTIONS,
  type SexAtBirth,
  type GenderIdentity,
} from "@/types/user-demographics";

interface Props {
  alreadyAnswered: boolean;
}

// ─── Pure helpers — extracted for testability ───────────────────────────────

/**
 * PATCH /api/profile body shape for the onboarding submission.
 * `gender_identity` is optional — when the user doesn't pick one, it's
 * omitted entirely (additive-PATCH semantics from Step 5, no DB write).
 */
export interface OnboardingPayload {
  is_on_medicare: boolean;
  sex_at_birth: SexAtBirth;
  gender_identity?: GenderIdentity;
}

/**
 * Whether the form can be submitted given the current required-field state.
 * Both required answers must be set; gender_identity is optional.
 */
export function canSubmitOnboarding(
  sexAtBirth: SexAtBirth | null,
  isOnMedicare: boolean | null,
): boolean {
  return sexAtBirth !== null && isOnMedicare !== null;
}

/**
 * Build the PATCH payload from form state. Includes is_on_medicare and
 * sex_at_birth (both required). Includes gender_identity ONLY when the user
 * picked a value — omitting keys leverages additive-PATCH semantics from
 * Step 5, so a field the user didn't answer is left untouched in the DB.
 */
export function buildOnboardingPayload(
  sexAtBirth: SexAtBirth,
  isOnMedicare: boolean,
  genderIdentity: GenderIdentity | null,
): OnboardingPayload {
  const payload: OnboardingPayload = {
    is_on_medicare: isOnMedicare,
    sex_at_birth: sexAtBirth,
  };
  if (genderIdentity !== null) {
    payload.gender_identity = genderIdentity;
  }
  return payload;
}

/**
 * Submit the onboarding payload to PATCH /api/profile.
 * Returns the raw Response so callers can inspect status + parsed body.
 */
export async function submitOnboarding(
  payload: OnboardingPayload,
): Promise<Response> {
  return fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
}

/**
 * Touch /api/profile GET to heal the medicare_status cookie for legacy
 * sessions that never got it set by verify-otp.
 */
export async function healMedicareCookie(): Promise<Response | null> {
  try {
    return await fetch("/api/profile", { credentials: "include" });
  } catch {
    return null;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function MedicareOnboardingForm({ alreadyAnswered }: Props) {
  const router = useRouter();
  const [sexAtBirth, setSexAtBirth] = useState<SexAtBirth | null>(null);
  const [isOnMedicare, setIsOnMedicare] = useState<boolean | null>(null);
  const [genderIdentity, setGenderIdentity] = useState<GenderIdentity | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{
    field: string;
    message: string;
  } | null>(null);

  // When the server-side DB check sees is_on_medicare is already set, the
  // browser may still be missing the medicare_status cookie (pre-gate
  // session). Touch /api/profile so its GET handler heals the cookie, then
  // redirect — subsequent /app navigation skips the gate.
  useEffect(() => {
    if (!alreadyAnswered) return;
    healMedicareCookie().finally(() => router.replace("/app/chat"));
  }, [alreadyAnswered, router]);

  async function handleSubmit() {
    if (submitting) return;
    if (!canSubmitOnboarding(sexAtBirth, isOnMedicare)) return;
    // canSubmitOnboarding guards against null — both are non-null here.
    const payload = buildOnboardingPayload(
      sexAtBirth!,
      isOnMedicare!,
      genderIdentity,
    );
    setSubmitting(true);
    setError(null);
    setFieldError(null);
    try {
      const res = await submitOnboarding(payload);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 400 && typeof data?.field === "string") {
          setFieldError({
            field: data.field,
            message:
              data?.error || "Please re-check this answer and try again.",
          });
          setSubmitting(false);
          return;
        }
        throw new Error(
          data?.error || "Could not save your answers. Please try again.",
        );
      }
      router.replace("/app/chat");
    } catch (e) {
      setSubmitting(false);
      setError(
        e instanceof Error
          ? e.message
          : "Could not save your answers. Please try again.",
      );
    }
  }

  if (alreadyAnswered) return null;

  const submitDisabled =
    submitting || !canSubmitOnboarding(sexAtBirth, isOnMedicare);

  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh] px-4 py-8">
      <div className="max-w-md w-full space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Let&apos;s get you set up
          </h1>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
            These help us personalize Denali for you.
          </p>
        </header>

        {/* Question 1 — Sex at birth (required) */}
        <fieldset className="space-y-2">
          <legend className="block">
            <span className="font-medium text-[var(--text-primary)]">
              Sex at birth
            </span>
            <span className="ml-2 text-xs text-red-600">Required</span>
          </legend>
          <p className="text-sm text-[var(--text-secondary)]">
            Used to interpret lab results accurately — reference ranges for
            things like hemoglobin, creatinine, and cardiac markers differ by
            sex at birth.
          </p>
          <div className="space-y-2 mt-2">
            {SEX_AT_BIRTH_UI_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-3 p-3 border border-[var(--border-primary)] rounded-lg cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <input
                  type="radio"
                  name="sex_at_birth"
                  value={opt.value}
                  checked={sexAtBirth === opt.value}
                  onChange={() => setSexAtBirth(opt.value)}
                  disabled={submitting}
                />
                <span className="text-[var(--text-primary)]">{opt.label}</span>
              </label>
            ))}
          </div>
          {fieldError?.field === "sex_at_birth" && (
            <p role="alert" className="text-sm text-red-600 mt-1">
              {fieldError.message}
            </p>
          )}
        </fieldset>

        {/* Question 2 — Medicare (required, existing wording preserved) */}
        <fieldset className="space-y-2">
          <legend className="block">
            <span className="font-medium text-[var(--text-primary)]">
              Are you enrolled in Medicare?
            </span>
            <span className="ml-2 text-xs text-red-600">Required</span>
          </legend>
          <p className="text-sm text-[var(--text-secondary)]">
            This helps us give you the right information. You can change this
            anytime in Settings.
          </p>
          <div className="space-y-2 mt-2">
            <label className="flex items-center gap-3 p-3 border border-[var(--border-primary)] rounded-lg cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors">
              <input
                type="radio"
                name="is_on_medicare"
                value="true"
                checked={isOnMedicare === true}
                onChange={() => setIsOnMedicare(true)}
                disabled={submitting}
              />
              <span className="text-[var(--text-primary)]">
                Yes, I have Medicare
              </span>
            </label>
            <label className="flex items-center gap-3 p-3 border border-[var(--border-primary)] rounded-lg cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors">
              <input
                type="radio"
                name="is_on_medicare"
                value="false"
                checked={isOnMedicare === false}
                onChange={() => setIsOnMedicare(false)}
                disabled={submitting}
              />
              <span className="text-[var(--text-primary)]">
                No, I don&apos;t have Medicare
              </span>
            </label>
          </div>
          {fieldError?.field === "is_on_medicare" && (
            <p role="alert" className="text-sm text-red-600 mt-1">
              {fieldError.message}
            </p>
          )}
        </fieldset>

        {/* Question 3 — Gender identity (optional) */}
        <div className="space-y-2">
          <label htmlFor="gender_identity" className="block">
            <span className="font-medium text-[var(--text-primary)]">
              Gender identity
            </span>
            <span className="ml-2 text-xs text-[var(--text-secondary)]">
              Optional
            </span>
          </label>
          <p className="text-sm text-[var(--text-secondary)]">
            Optional — helps us address you correctly. You can update this
            anytime in Settings.
          </p>
          <select
            id="gender_identity"
            value={genderIdentity ?? ""}
            onChange={(e) =>
              setGenderIdentity(
                e.target.value === ""
                  ? null
                  : (e.target.value as GenderIdentity),
              )
            }
            disabled={submitting}
            className="w-full mt-1 p-3 border border-[var(--border-primary)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)]"
          >
            <option value="">Select an option</option>
            {GENDER_IDENTITY_VALUES.map((v) => (
              <option key={v} value={v}>
                {GENDER_IDENTITY_LABELS[v]}
              </option>
            ))}
          </select>
          {fieldError?.field === "gender_identity" && (
            <p role="alert" className="text-sm text-red-600 mt-1">
              {fieldError.message}
            </p>
          )}
        </div>

        {error && (
          <div role="alert" className="text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitDisabled}
          className="w-full py-3 px-4 rounded-lg font-medium text-white bg-[var(--accent-primary)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
