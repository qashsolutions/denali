"use client";

import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export interface AuthState {
  email: string | null;
  isEmailVerified: boolean;
  isMfaEnrolled: boolean;
  isMfaVerified: boolean;
  plan: "free" | "per_appeal" | "unlimited";
  appealCount: number;
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
  email: null,
  isEmailVerified: false,
  isMfaEnrolled: false,
  isMfaVerified: false,
  plan: "free",
  appealCount: 0,
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

          // Fetch user profile from database
          const { data: profile } = await supabase
            .from("users")
            .select("plan")
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
          const validPlans = ["free", "per_appeal", "unlimited"] as const;
          const userPlan = validPlans.includes(
            profile?.plan as (typeof validPlans)[number]
          )
            ? (profile?.plan as "free" | "per_appeal" | "unlimited")
            : "free";

          setAuthState({
            email,
            isEmailVerified:
              !!email && session.user.email_confirmed_at !== null,
            isMfaEnrolled,
            isMfaVerified,
            plan: userPlan,
            appealCount,
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
      if (!authState.isEmailVerified || !authState.email) {
        return "paywall";
      }

      try {
        if (authState.plan === "unlimited") {
          return "allowed";
        }

        const { data: usage } = await supabase
          .from("usage")
          .select("appeal_count")
          .eq("email", authState.email)
          .single();

        const appealCount = usage?.appeal_count || 0;

        if (appealCount === 0) {
          return "free";
        }

        return "paywall";
      } catch (error) {
        console.error("Error checking appeal access:", error);
        return "paywall";
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
