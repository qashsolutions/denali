"use client";

import { useState, useCallback, useEffect } from "react";
import {
  cacheSet,
  cacheGetIfFresh,
  clearAllCaches,
  STORES,
  TTL,
} from "@/lib/offline-cache";
import { AUTH } from "@/config/messages";

export interface AuthState {
  userId: string | null;
  email: string | null;
  firstName: string | null; // From ID.me identity verification (personalizes AI chat)
  gender: string | null; // From ID.me identity verification (clinical context)
  isEmailVerified: boolean;
  isIdmeVerified: boolean;
  isMfaEnrolled: boolean;
  isMfaVerified: boolean;
  currentAAL: string | null;
  plan: "trial" | "starter" | "plus" | "unlimited";
  role: "patient" | "counselor" | "provider";
  appealCount: number;
  appealCredits: number;
  hasStripeCustomer: boolean; // True if user has an active subscription row with stripe_customer_id
  trialStatus: "none" | "active" | "expired" | "converted";
  trialDaysRemaining: number;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  requireIdentityVerification: boolean; // Feature flag: true = Medicare App Library (ID.me required), false = Connected Apps Directory
  birthYear: number | null; // Foundation Stage 1 — null until captured via ProfileCompletionModal
  isOnMedicare: boolean; // Foundation Stage 1 — gates Medicare-specific features
  birthYearModalDismissedAt: string | null; // Stage 1.C — ISO timestamp of last "Not now" click
  birthYearModalDisabled: boolean; // Stage 1.C — true after "Don't show again" or Settings toggle off
}

export type AppealAccessStatus = "available" | "paywall" | "allowed";

interface UseAuthReturn {
  authState: AuthState;
  sendEmailOTP: (email: string) => Promise<boolean>;
  verifyEmailOTP: (
    email: string,
    code: string,
  ) => Promise<{ success: boolean; mfaRequired?: boolean }>;
  enrollTOTP: () => Promise<{ qrCode: string; secret: string } | null>;
  unenrollTOTP: () => Promise<boolean>;
  challengeAndVerifyTOTP: (code: string) => Promise<boolean>;
  confirmTOTPEnrollment: (code: string) => Promise<boolean>;
  checkAppealAccess: () => Promise<AppealAccessStatus>;
  signOut: () => Promise<void>;
  clearError: () => void;
  refetchProfile: () => Promise<void>;
}

const DEFAULT_AUTH_STATE: AuthState = {
  userId: null,
  email: null,
  firstName: null,
  gender: null,
  isEmailVerified: false,
  isIdmeVerified: false,
  isMfaEnrolled: false,
  isMfaVerified: false,
  currentAAL: null,
  plan: "trial",
  role: "patient",
  appealCount: 0,
  appealCredits: 0,
  hasStripeCustomer: false,
  trialStatus: "none",
  trialDaysRemaining: 0,
  isAdmin: false,
  isLoading: true,
  error: null,
  requireIdentityVerification: false,
  birthYear: null,
  isOnMedicare: false,
  birthYearModalDismissedAt: null,
  birthYearModalDisabled: false,
};

// Module-level cache: survives SPA navigations
let _cachedAuthState: AuthState | null = null;

// Dispatch auth state change to other hooks (AppHeader, useConversationHistory, etc.)
function dispatchAuthChange(user: { email: string; userId: string } | null) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("auth-state-change", { detail: user }),
    );
  }
}

export function useAuth(): UseAuthReturn {
  const [authState, setAuthState] = useState<AuthState>(
    _cachedAuthState ?? DEFAULT_AUTH_STATE,
  );

  // Sync module-level cache when auth state settles
  useEffect(() => {
    if (!authState.isLoading) {
      _cachedAuthState = authState;
    }
  }, [authState]);

  // Load profile data from /api/profile (non-blocking, enhances basic auth state)
  const loadProfileData = useCallback(async (userId: string, email: string) => {
    try {
      // Profile + appeal data
      const res = await fetch("/api/profile");
      const profileData = res.ok ? await res.json() : null;

      // Trial status
      const trialRes = await fetch("/api/trial");
      const trialData = trialRes.ok ? await trialRes.json() : null;

      // MFA status
      const mfaRes = await fetch("/api/auth/mfa/status");
      const mfaData = mfaRes.ok ? await mfaRes.json() : null;

      const isMfaEnrolled = mfaData?.enrolled ?? false;
      // mfa_verified cookie presence = AAL2 (checked server-side; client infers from response)
      const isMfaVerified = false; // Will be updated after TOTP challenge

      const validPlans = ["trial", "starter", "plus", "unlimited"] as const;
      const rawPlan = profileData?.plan || "trial";
      // Backward-compat: map legacy plan names
      const normalized =
        rawPlan === "per_appeal"
          ? "starter"
          : rawPlan === "monthly"
            ? "plus"
            : rawPlan;
      const userPlan = validPlans.includes(
        normalized as (typeof validPlans)[number],
      )
        ? (normalized as "trial" | "starter" | "plus" | "unlimited")
        : "trial";

      const validRoles = ["patient", "counselor", "provider"] as const;
      const rawRole = profileData?.role || "patient";
      const userRole = validRoles.includes(
        rawRole as (typeof validRoles)[number],
      )
        ? (rawRole as "patient" | "counselor" | "provider")
        : "patient";

      const appealCount = profileData?.appealCount || 0;
      const appealCredits = profileData?.appealCredits || 0;
      const hasStripeCustomer = profileData?.hasStripeCustomer === true;
      const isAdmin = profileData?.isAdmin || false;
      const isIdmeVerified = profileData?.idmeVerified || false;
      const firstName = profileData?.firstName || null;
      const gender = profileData?.gender || null;
      const requireIdentityVerification =
        profileData?.requireIdentityVerification || false;
      const birthYear =
        typeof profileData?.birthYear === "number"
          ? profileData.birthYear
          : null;
      const isOnMedicare = profileData?.isOnMedicare === true;
      const birthYearModalDismissedAt =
        typeof profileData?.birthYearModalDismissedAt === "string"
          ? profileData.birthYearModalDismissedAt
          : null;
      const birthYearModalDisabled =
        profileData?.birthYearModalDisabled === true;

      let trialStatus: AuthState["trialStatus"] = "none";
      let trialDaysRemaining = 0;
      if (trialData?.status) {
        trialStatus = trialData.status as AuthState["trialStatus"];
        trialDaysRemaining = trialData.daysRemaining || 0;
      }

      setAuthState((prev) => ({
        ...prev,
        isIdmeVerified,
        firstName,
        gender,
        isMfaEnrolled,
        isMfaVerified,
        currentAAL: isMfaVerified ? "aal2" : "aal1",
        plan: userPlan,
        role: userRole,
        appealCount,
        appealCredits,
        hasStripeCustomer,
        trialStatus,
        trialDaysRemaining,
        isAdmin,
        requireIdentityVerification,
        birthYear,
        isOnMedicare,
        birthYearModalDismissedAt,
        birthYearModalDisabled,
      }));

      cacheSet(STORES.PROFILE, "profile", {
        plan: userPlan,
        role: userRole,
        appealCount,
        appealCredits,
        hasStripeCustomer,
        isAdmin,
        isIdmeVerified,
        firstName,
        gender,
        trialStatus,
        trialDaysRemaining,
        requireIdentityVerification,
        birthYear,
        isOnMedicare,
        birthYearModalDismissedAt,
        birthYearModalDisabled,
      });
    } catch (error) {
      console.error("Error loading profile data:", error);
      // Fallback to offline cache
      const cached = await cacheGetIfFresh<{
        plan: string;
        role: string;
        appealCount: number;
        appealCredits: number;
        hasStripeCustomer?: boolean;
        isAdmin: boolean;
        isIdmeVerified: boolean;
        firstName?: string | null;
        gender?: string | null;
        trialStatus: string;
        trialDaysRemaining: number;
        requireIdentityVerification?: boolean;
        birthYear?: number | null;
        isOnMedicare?: boolean;
        birthYearModalDismissedAt?: string | null;
        birthYearModalDisabled?: boolean;
      }>(STORES.PROFILE, "profile", TTL.PROFILE);
      if (cached) {
        const d = cached.data;
        setAuthState((prev) => ({
          ...prev,
          plan: d.plan as AuthState["plan"],
          role: d.role as AuthState["role"],
          appealCount: d.appealCount,
          appealCredits: d.appealCredits || 0,
          hasStripeCustomer: d.hasStripeCustomer === true,
          isAdmin: d.isAdmin,
          isIdmeVerified: d.isIdmeVerified || false,
          firstName: d.firstName || null,
          gender: d.gender || null,
          trialStatus: d.trialStatus as AuthState["trialStatus"],
          trialDaysRemaining: d.trialDaysRemaining,
          requireIdentityVerification: d.requireIdentityVerification || false,
          birthYear: typeof d.birthYear === "number" ? d.birthYear : null,
          isOnMedicare: d.isOnMedicare === true,
          birthYearModalDismissedAt:
            typeof d.birthYearModalDismissedAt === "string"
              ? d.birthYearModalDismissedAt
              : null,
          birthYearModalDisabled: d.birthYearModalDisabled === true,
        }));
      }
    }
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    fetch("/api/profile")
      .then(async (res) => {
        if (!res.ok) {
          setAuthState((prev) => ({ ...prev, isLoading: false }));
          return;
        }
        const data = await res.json();
        if (!data.authenticated) {
          setAuthState((prev) => ({ ...prev, isLoading: false }));
          return;
        }
        // We have a session — set basic auth immediately, then load full profile
        // /api/profile doesn't return userId/email directly, so we call /api/auth/me
        // Actually use the profile data we have
        const email = data.email || null;
        const userId = data.userId || null;
        setAuthState((prev) => ({
          ...prev,
          userId,
          email,
          isEmailVerified: !!email,
          isLoading: false,
          error: null,
        }));
        if (userId && email) {
          loadProfileData(userId, email);
        }
      })
      .catch(() => {
        setAuthState((prev) => ({ ...prev, isLoading: false }));
      });

    // Listen for auth state changes dispatched by other hooks / signout
    function handleAuthChange(e: Event) {
      const user = (e as CustomEvent<{ email: string; userId: string } | null>)
        .detail;
      if (user) {
        setAuthState((prev) => ({
          ...prev,
          userId: user.userId,
          email: user.email,
          isEmailVerified: true,
          isLoading: false,
          error: null,
        }));
        loadProfileData(user.userId, user.email);
      } else {
        setAuthState({ ...DEFAULT_AUTH_STATE, isLoading: false });
        _cachedAuthState = null;
      }
    }

    window.addEventListener("auth-state-change", handleAuthChange);
    return () =>
      window.removeEventListener("auth-state-change", handleAuthChange);
  }, [loadProfileData]);

  // Stage 1.C: re-pull /api/profile + /api/trial + /api/auth/mfa/status
  // and update authState. Used after Settings writes (PATCH or
  // birth-year reminder endpoints) so the refreshed cadence/profile
  // fields propagate to other consumers (modal gate, etc.) without
  // a navigation. No-op when unauthenticated.
  const refetchProfile = useCallback(async () => {
    if (!authState.userId || !authState.email) return;
    await loadProfileData(authState.userId, authState.email);
  }, [authState.userId, authState.email, loadProfileData]);

  // Send OTP to email
  const sendEmailOTP = useCallback(async (email: string): Promise<boolean> => {
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          error: data.error || AUTH.OTP_SEND_FAILED,
        }));
        return false;
      }

      setAuthState((prev) => ({ ...prev, isLoading: false }));
      return true;
    } catch (error) {
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : AUTH.OTP_SEND_FAILED,
      }));
      return false;
    }
  }, []);

  // Verify email OTP — returns { success, mfaRequired }
  const verifyEmailOTP = useCallback(
    async (
      email: string,
      code: string,
    ): Promise<{ success: boolean; mfaRequired?: boolean }> => {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const res = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp: code }),
        });
        const data = await res.json();

        if (!res.ok) {
          setAuthState((prev) => ({
            ...prev,
            isLoading: false,
            error: data.error || AUTH.SIGN_IN_ERROR,
          }));
          return { success: false };
        }

        const userId = data.user?.userId ?? null;
        // Use normalized email from server (strips Gmail +tag)
        const resolvedEmail = data.user?.email ?? email;

        setAuthState((prev) => ({
          ...prev,
          userId,
          email: resolvedEmail,
          isEmailVerified: true,
          isLoading: false,
          error: null,
        }));

        // Notify other hooks of auth change
        if (userId) {
          dispatchAuthChange({ email: resolvedEmail, userId });
          // Load full profile non-blocking
          loadProfileData(userId, resolvedEmail);
        }

        return { success: true, mfaRequired: data.mfaRequired };
      } catch (error) {
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : AUTH.SIGN_IN_ERROR,
        }));
        return { success: false };
      }
    },
    [loadProfileData],
  );

  // Enroll TOTP — returns secret + QR code URI
  const enrollTOTP = useCallback(async (): Promise<{
    qrCode: string;
    secret: string;
  } | null> => {
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const res = await fetch("/api/auth/mfa/enroll", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          error: data.error || "Failed to set up authenticator",
        }));
        return null;
      }

      setAuthState((prev) => ({ ...prev, isLoading: false }));
      return { qrCode: data.qrCode, secret: data.secret };
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
  }, []);

  // Unenroll TOTP
  const unenrollTOTP = useCallback(async (): Promise<boolean> => {
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const res = await fetch("/api/auth/mfa/unenroll", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          error: data.error || "Failed to remove authenticator",
        }));
        return false;
      }

      setAuthState((prev) => ({
        ...prev,
        isMfaEnrolled: false,
        isMfaVerified: false,
        currentAAL: "aal1",
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
            : "Failed to remove authenticator",
      }));
      return false;
    }
  }, []);

  // Verify TOTP code (challenge during sign-in or enrollment confirm)
  const challengeAndVerifyTOTP = useCallback(
    async (code: string): Promise<boolean> => {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const res = await fetch("/api/auth/mfa/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();

        if (!res.ok) {
          setAuthState((prev) => ({
            ...prev,
            isLoading: false,
            error: data.error || "Failed to verify authenticator code",
          }));
          return false;
        }

        setAuthState((prev) => ({
          ...prev,
          isMfaVerified: true,
          currentAAL: "aal2",
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
    [],
  );

  // Confirm TOTP enrollment (first code after scanning QR)
  const confirmTOTPEnrollment = useCallback(
    async (code: string): Promise<boolean> => {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const res = await fetch("/api/auth/mfa/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();

        if (!res.ok) {
          setAuthState((prev) => ({
            ...prev,
            isLoading: false,
            error: data.error || "Failed to confirm authenticator setup",
          }));
          return false;
        }

        setAuthState((prev) => ({
          ...prev,
          isMfaVerified: true,
          isMfaEnrolled: true,
          currentAAL: "aal2",
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
              : "Failed to confirm authenticator setup",
        }));
        return false;
      }
    },
    [],
  );

  // Check appeal access — uses fresh profile data to avoid stale closure race
  const checkAppealAccess =
    useCallback(async (): Promise<AppealAccessStatus> => {
      if (authState.isAdmin) return "allowed";
      if (authState.role === "counselor" || authState.role === "provider")
        return "allowed";
      if (!authState.isEmailVerified || !authState.email) return "paywall";

      try {
        const res = await fetch("/api/profile");
        const data = res.ok ? await res.json() : null;
        const credits = data?.appealCredits ?? authState.appealCredits;
        const plan = data?.plan ?? authState.plan;
        const isAdmin = data?.isAdmin ?? authState.isAdmin;

        if (isAdmin) return "allowed";
        // Unlimited plan bypasses credit checks
        if (plan === "unlimited") return "allowed";
        // Trial has no appeal credits
        if (plan === "trial") return "paywall";
        // Starter/Plus — credit-based
        if (plan === "starter" || plan === "plus") {
          return credits > 0 ? "available" : "paywall";
        }
        return "paywall";
      } catch {
        if (authState.plan === "unlimited") return "allowed";
        return authState.appealCredits > 0 ? "available" : "paywall";
      }
    }, [authState]);

  // Sign out
  const signOut = useCallback(async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    _cachedAuthState = null;
    setAuthState({ ...DEFAULT_AUTH_STATE, isLoading: false });
    dispatchAuthChange(null);
    // Clear all client-side caches (HIPAA: prevent next user from seeing health data)
    clearAllCaches().catch(() => {});
    // Clear ALL SW caches (HIPAA: prevent next user from seeing health data on shared devices)
    if ("caches" in window) {
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((k) => k.startsWith("denali-"))
              .map((k) => caches.delete(k)),
          ),
        )
        .catch(() => {});
    }
  }, []);

  const clearError = useCallback(() => {
    setAuthState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    authState,
    sendEmailOTP,
    verifyEmailOTP,
    enrollTOTP,
    unenrollTOTP,
    challengeAndVerifyTOTP,
    confirmTOTPEnrollment,
    checkAppealAccess,
    signOut,
    clearError,
    refetchProfile,
  };
}
