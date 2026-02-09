"use client";

import { useState, useCallback, useEffect } from "react";
import { getClient } from "@/lib/supabase";
import { PRICING } from "@/config";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export interface AuthState {
  userId: string | null;
  email: string | null;
  isEmailVerified: boolean;
  isMfaEnrolled: boolean;
  isMfaVerified: boolean;
  currentAAL: string | null;
  plan: "free" | "per_appeal" | "monthly" | "trial";
  role: "patient" | "counselor" | "provider";
  appealCount: number;
  trialStatus: "none" | "active" | "expired" | "converted";
  trialDaysRemaining: number;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
}

export type AppealAccessStatus = "free" | "paywall" | "allowed";

interface UseAuthReturn {
  authState: AuthState;
  sendEmailOTP: (email: string) => Promise<boolean>;
  verifyEmailOTP: (email: string, code: string) => Promise<boolean>;
  enrollTOTP: () => Promise<{ qrCode: string; secret: string } | null>;
  challengeAndVerifyTOTP: (code: string) => Promise<boolean>;
  checkAppealAccess: () => Promise<AppealAccessStatus>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const DEFAULT_AUTH_STATE: AuthState = {
  userId: null,
  email: null,
  isEmailVerified: false,
  isMfaEnrolled: false,
  isMfaVerified: false,
  currentAAL: null,
  plan: "free",
  role: "patient",
  appealCount: 0,
  trialStatus: "none",
  trialDaysRemaining: 0,
  isAdmin: false,
  isLoading: true,
  error: null,
};

// Module-level cache: survives SPA navigations so settings page
// doesn't flash a spinner every time the user clicks the gear icon.
let _cachedAuthState: AuthState | null = null;

export function useAuth(): UseAuthReturn {
  const [authState, setAuthState] = useState<AuthState>(
    _cachedAuthState ?? DEFAULT_AUTH_STATE
  );
  const supabase = getClient();

  // Sync module-level cache when auth state settles
  useEffect(() => {
    if (!authState.isLoading) {
      _cachedAuthState = authState;
    }
  }, [authState]);

  // Check for existing session on mount + auth state changes
  useEffect(() => {
    // Set basic auth state immediately from session (no DB wait)
    function setBasicAuth(user: { id: string; email?: string; email_confirmed_at?: string | null }) {
      const email = user.email || null;
      setAuthState((prev) => ({
        ...prev,
        userId: user.id,
        email,
        isEmailVerified: !!email && user.email_confirmed_at !== null,
        isLoading: false,
        error: null,
      }));
    }

    // Fetch profile, MFA, usage, trial — non-blocking enhancement
    async function loadProfileData(userId: string, _email: string | null) {
      try {
        // MFA status
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const totpFactors = factorsData?.totp?.filter((f) => f.status === "verified") ?? [];
        const isMfaEnrolled = totpFactors.length > 0;
        const isMfaVerified =
          aalData?.currentLevel === "aal2" ||
          aalData?.currentAuthenticationMethods?.some(
            (m) => typeof m === "object" && "method" in m && m.method === "totp"
          ) || false;

        // Profile + appeal count from server route (cookie-authenticated).
        // Browser Supabase .from("users").select() is unreliable with stale tokens.
        const res = await fetch("/api/profile");
        const profileData = res.ok ? await res.json() : null;

        // Validate plan type
        const validPlans = ["free", "per_appeal", "monthly", "trial"] as const;
        const rawPlan = profileData?.plan || "free";
        const userPlan = validPlans.includes(rawPlan as (typeof validPlans)[number])
          ? (rawPlan as "free" | "per_appeal" | "monthly" | "trial")
          : "free";

        // Validate role
        const validRoles = ["patient", "counselor", "provider"] as const;
        const rawRole = profileData?.role || "patient";
        const userRole = validRoles.includes(rawRole as (typeof validRoles)[number])
          ? (rawRole as "patient" | "counselor" | "provider")
          : "patient";

        const appealCount = profileData?.appealCount || 0;
        const isAdmin = profileData?.isAdmin || false;

        // Trial status
        let trialStatus: "none" | "active" | "expired" | "converted" = "none";
        let trialDaysRemaining = 0;
        if (userPlan === "trial") {
          const { data: sub } = await supabase
            .from("subscriptions")
            .select("trial_start, trial_end, trial_converted")
            .eq("user_id", userId)
            .single();
          if (sub?.trial_end) {
            const now = new Date();
            const end = new Date(sub.trial_end);
            if (sub.trial_converted) {
              trialStatus = "converted";
            } else if (end > now) {
              trialStatus = "active";
              trialDaysRemaining = Math.ceil(
                (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
              );
            } else {
              trialStatus = "expired";
            }
          }
        }

        setAuthState((prev) => ({
          ...prev,
          isMfaEnrolled,
          isMfaVerified,
          currentAAL: aalData?.currentLevel ?? null,
          plan: userPlan,
          role: userRole,
          appealCount,
          trialStatus,
          trialDaysRemaining,
          isAdmin,
        }));
      } catch (error) {
        console.error("Error loading profile data:", error);
        // Basic auth already set — profile fetch failure is non-fatal
      }
    }

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setBasicAuth(session.user);
        loadProfileData(session.user.id, session.user.email || null);
      } else {
        setAuthState((prev) => ({ ...prev, isLoading: false }));
      }
    }).catch(() => {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
    });

    // Listen for auth changes (including INITIAL_SESSION which fires on subscribe)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session) => {
        if (session?.user) {
          setBasicAuth(session.user);
          loadProfileData(session.user.id, session.user.email || null);
        } else {
          setAuthState({ ...DEFAULT_AUTH_STATE, isLoading: false });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Send OTP to email
  const sendEmailOTP = useCallback(
    async (email: string): Promise<boolean> => {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const { error } = await supabase.auth.signInWithOtp({ email });

        if (error) {
          setAuthState((prev) => ({
            ...prev,
            isLoading: false,
            error: error.message,
          }));
          return false;
        }

        setAuthState((prev) => ({
          ...prev,
          // Don't set email here — only after OTP verification.
          // Setting it prematurely makes Settings show "Signed in" and hides the OTP input.
          isLoading: false,
        }));
        return true;
      } catch (error) {
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to send verification code",
        }));
        return false;
      }
    },
    [supabase]
  );

  // Verify email OTP code
  const verifyEmailOTP = useCallback(
    async (email: string, code: string): Promise<boolean> => {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const { error, data } = await supabase.auth.verifyOtp({
          email,
          token: code,
          type: "email",
        });

        if (error) {
          setAuthState((prev) => ({
            ...prev,
            isLoading: false,
            error: error.message,
          }));
          return false;
        }

        if (data.user) {
          // Create or update user in database
          const { error: upsertError } = await supabase.from("users").upsert(
            {
              id: data.user.id,
              email,
              plan: "free",
            },
            { onConflict: "id" }
          );

          if (upsertError) {
            console.error("Error upserting user:", upsertError);
          }

          // Initialize usage record if not exists
          const { error: usageError } = await supabase.from("usage").upsert(
            {
              email,
              appeal_count: 0,
            },
            { onConflict: "email", ignoreDuplicates: true }
          );

          if (usageError) {
            console.error("Error initializing usage:", usageError);
          }

          // Check MFA factors
          const { data: factorsData } =
            await supabase.auth.mfa.listFactors();
          const totpFactors =
            factorsData?.totp?.filter((f) => f.status === "verified") ?? [];

          setAuthState((prev) => ({
            ...prev,
            email,
            isEmailVerified: true,
            isMfaEnrolled: totpFactors.length > 0,
            isLoading: false,
          }));
          return true;
        }

        return false;
      } catch (error) {
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to verify code",
        }));
        return false;
      }
    },
    [supabase]
  );

  // Enroll TOTP factor
  const enrollTOTP = useCallback(async (): Promise<{
    qrCode: string;
    secret: string;
  } | null> => {
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
      });

      if (error) {
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message,
        }));
        return null;
      }

      setAuthState((prev) => ({ ...prev, isLoading: false }));
      return {
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      };
    } catch (error) {
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to set up authenticator",
      }));
      return null;
    }
  }, [supabase]);

  // Challenge and verify TOTP
  const challengeAndVerifyTOTP = useCallback(
    async (code: string): Promise<boolean> => {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const { data: factorsData } =
          await supabase.auth.mfa.listFactors();
        const totpFactor = factorsData?.totp?.find(
          (f) => f.status === "verified"
        );

        if (!totpFactor) {
          // If no verified factor, this is enrollment verification
          const unverified = factorsData?.totp?.find(
            (f) => (f.status as string) === "unverified"
          );
          if (!unverified) {
            setAuthState((prev) => ({
              ...prev,
              isLoading: false,
              error: "No authenticator found. Please set up again.",
            }));
            return false;
          }

          const { data: challengeData, error: challengeError } =
            await supabase.auth.mfa.challenge({ factorId: unverified.id });

          if (challengeError) {
            setAuthState((prev) => ({
              ...prev,
              isLoading: false,
              error: challengeError.message,
            }));
            return false;
          }

          const { error: verifyError } = await supabase.auth.mfa.verify({
            factorId: unverified.id,
            challengeId: challengeData.id,
            code,
          });

          if (verifyError) {
            setAuthState((prev) => ({
              ...prev,
              isLoading: false,
              error: verifyError.message,
            }));
            return false;
          }

          setAuthState((prev) => ({
            ...prev,
            isMfaEnrolled: true,
            isMfaVerified: true,
            isLoading: false,
          }));
          return true;
        }

        // Challenge existing verified factor
        const { data: challengeData, error: challengeError } =
          await supabase.auth.mfa.challenge({ factorId: totpFactor.id });

        if (challengeError) {
          setAuthState((prev) => ({
            ...prev,
            isLoading: false,
            error: challengeError.message,
          }));
          return false;
        }

        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId: totpFactor.id,
          challengeId: challengeData.id,
          code,
        });

        if (verifyError) {
          setAuthState((prev) => ({
            ...prev,
            isLoading: false,
            error: verifyError.message,
          }));
          return false;
        }

        setAuthState((prev) => ({
          ...prev,
          isMfaVerified: true,
          isLoading: false,
        }));
        return true;
      } catch (error) {
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to verify authenticator code",
        }));
        return false;
      }
    },
    [supabase]
  );

  // Check appeal access based on email and plan
  const checkAppealAccess =
    useCallback(async (): Promise<AppealAccessStatus> => {
      // Admins always get unlimited access
      if (authState.isAdmin) {
        return "allowed";
      }

      // Counselors and providers always get free access
      if (authState.role === "counselor" || authState.role === "provider") {
        return "allowed";
      }

      if (!authState.isEmailVerified || !authState.email) {
        return "paywall";
      }

      try {
        const { data: usage, error: usageError } = await supabase
          .from("usage")
          .select("appeal_count")
          .eq("email", authState.email)
          .single();

        // No usage record yet = new user = free
        if (usageError || !usage) {
          return "free";
        }

        const appealCount = usage.appeal_count || 0;

        if (appealCount < PRICING.FREE_APPEAL_LIMIT) {
          return "free";
        }

        if (authState.plan === "monthly" || authState.plan === "per_appeal") {
          return "allowed";
        }

        // Trial plan: allowed if trial is still active
        if (authState.plan === "trial" && authState.trialStatus === "active") {
          return "allowed";
        }

        return "paywall";
      } catch (error) {
        console.error("Error checking appeal access:", error);
        return "free";
      }
    }, [authState, supabase]);

  // Sign out
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setAuthState(DEFAULT_AUTH_STATE);
  }, [supabase]);

  // Clear error
  const clearError = useCallback(() => {
    setAuthState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    authState,
    sendEmailOTP,
    verifyEmailOTP,
    enrollTOTP,
    challengeAndVerifyTOTP,
    checkAppealAccess,
    signOut,
    clearError,
  };
}
