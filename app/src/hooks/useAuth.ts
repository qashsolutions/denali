"use client";

import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { PRICING } from "@/config";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export interface AuthState {
  userId: string | null;
  email: string | null;
  isEmailVerified: boolean;
  isMfaEnrolled: boolean;
  isMfaVerified: boolean;
  isPasskeyEnrolled: boolean;
  currentAAL: string | null;
  plan: "free" | "per_appeal" | "monthly" | "trial";
  role: "patient" | "counselor" | "provider";
  appealCount: number;
  trialStatus: "none" | "active" | "expired" | "converted";
  trialDaysRemaining: number;
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
  isPasskeyEnrolled: false,
  currentAAL: null,
  plan: "free",
  role: "patient",
  appealCount: 0,
  trialStatus: "none",
  trialDaysRemaining: 0,
  isLoading: false,
  error: null,
};

export function useAuth(): UseAuthReturn {
  const [authState, setAuthState] = useState<AuthState>(DEFAULT_AUTH_STATE);
  const supabase = createClient();

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const email = session.user.email || null;

          // Check MFA status
          const { data: aalData } =
            await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          const { data: factorsData } =
            await supabase.auth.mfa.listFactors();

          const totpFactors =
            factorsData?.totp?.filter((f) => f.status === "verified") ?? [];
          const isMfaEnrolled = totpFactors.length > 0;
          const isMfaVerified =
            aalData?.currentLevel === "aal2" ||
            aalData?.currentAuthenticationMethods?.some(
              (m) => typeof m === "object" && "method" in m && m.method === "totp"
            ) ||
            false;

          // Check for WebAuthn (passkey) factors
          const webauthnFactors =
            factorsData?.all?.filter(
              (f) => f.factor_type === "webauthn" && f.status === "verified"
            ) ?? [];
          const isPasskeyEnrolled = webauthnFactors.length > 0;

          // Fetch user profile from database
          const { data: profile } = await supabase
            .from("users")
            .select("plan, role")
            .eq("id", session.user.id)
            .single();

          // Fetch appeal count by email
          let appealCount = 0;
          if (email) {
            const { data: usage } = await supabase
              .from("usage")
              .select("appeal_count")
              .eq("email", email)
              .single();
            appealCount = usage?.appeal_count || 0;
          }

          // Validate plan type
          const validPlans = ["free", "per_appeal", "monthly", "trial"] as const;
          const userPlan = validPlans.includes(
            profile?.plan as (typeof validPlans)[number]
          )
            ? (profile?.plan as "free" | "per_appeal" | "monthly" | "trial")
            : "free";

          // Validate role
          const validRoles = ["patient", "counselor", "provider"] as const;
          const userRole = validRoles.includes(
            profile?.role as (typeof validRoles)[number]
          )
            ? (profile?.role as "patient" | "counselor" | "provider")
            : "patient";

          // Check trial status from subscriptions table
          let trialStatus: "none" | "active" | "expired" | "converted" = "none";
          let trialDaysRemaining = 0;

          if (userPlan === "trial") {
            const { data: sub } = await supabase
              .from("subscriptions")
              .select("trial_start, trial_end, trial_converted")
              .eq("user_id", session.user.id)
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

          setAuthState({
            userId: session.user.id,
            email,
            isEmailVerified:
              !!email && session.user.email_confirmed_at !== null,
            isMfaEnrolled,
            isMfaVerified,
            isPasskeyEnrolled,
            currentAAL: aalData?.currentLevel ?? null,
            plan: userPlan,
            role: userRole,
            appealCount,
            trialStatus,
            trialDaysRemaining,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        console.error("Error checking session:", error);
      }
    };

    checkSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (event === "SIGNED_IN" && session?.user) {
          const email = session.user.email || null;
          setAuthState((prev) => ({
            ...prev,
            userId: session.user.id,
            email,
            isEmailVerified:
              !!email && session.user.email_confirmed_at !== null,
          }));
        } else if (event === "SIGNED_OUT") {
          setAuthState(DEFAULT_AUTH_STATE);
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
          email,
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

        if (authState.plan === "monthly") {
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
