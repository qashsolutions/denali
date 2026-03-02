"use client";

import { useState, useCallback, useEffect } from "react";
import { cacheSet, cacheGetIfFresh, STORES, TTL } from "@/lib/offline-cache";

export interface AuthState {
  userId: string | null;
  email: string | null;
  isEmailVerified: boolean;
  isMfaEnrolled: boolean;
  isMfaVerified: boolean;
  currentAAL: string | null;
  plan: "trial" | "per_appeal" | "monthly";
  role: "patient" | "counselor" | "provider";
  appealCount: number;
  appealCredits: number;
  trialStatus: "none" | "active" | "expired" | "converted";
  trialDaysRemaining: number;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
}

export type AppealAccessStatus = "available" | "paywall" | "allowed";

interface UseAuthReturn {
  authState: AuthState;
  sendEmailOTP: (email: string) => Promise<boolean>;
  verifyEmailOTP: (email: string, code: string) => Promise<{ success: boolean; mfaRequired?: boolean }>;
  enrollTOTP: () => Promise<{ qrCode: string; secret: string } | null>;
  unenrollTOTP: () => Promise<boolean>;
  challengeAndVerifyTOTP: (code: string) => Promise<boolean>;
  confirmTOTPEnrollment: (code: string) => Promise<boolean>;
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
  plan: "trial",
  role: "patient",
  appealCount: 0,
  appealCredits: 0,
  trialStatus: "none",
  trialDaysRemaining: 0,
  isAdmin: false,
  isLoading: true,
  error: null,
};

// Module-level cache: survives SPA navigations
let _cachedAuthState: AuthState | null = null;

// Dispatch auth state change to other hooks (AppHeader, useConversationHistory, etc.)
function dispatchAuthChange(user: { email: string; userId: string } | null) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth-state-change", { detail: user }));
  }
}

export function useAuth(): UseAuthReturn {
  const [authState, setAuthState] = useState<AuthState>(
    _cachedAuthState ?? DEFAULT_AUTH_STATE
  );

  // Sync module-level cache when auth state settles
  useEffect(() => {
    if (!authState.isLoading) {
      _cachedAuthState = authState;
    }
  }, [authState]);

  // Load profile data from /api/profile (non-blocking, enhances basic auth state)
  const loadProfileData = useCallback(
    async (userId: string, email: string) => {
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

        const validPlans = ["trial", "per_appeal", "monthly"] as const;
        const rawPlan = profileData?.plan || "trial";
        const userPlan = validPlans.includes(rawPlan as (typeof validPlans)[number])
          ? (rawPlan as "trial" | "per_appeal" | "monthly")
          : "trial";

        const validRoles = ["patient", "counselor", "provider"] as const;
        const rawRole = profileData?.role || "patient";
        const userRole = validRoles.includes(rawRole as (typeof validRoles)[number])
          ? (rawRole as "patient" | "counselor" | "provider")
          : "patient";

        const appealCount = profileData?.appealCount || 0;
        const appealCredits = profileData?.appealCredits || 0;
        const isAdmin = profileData?.isAdmin || false;

        let trialStatus: AuthState["trialStatus"] = "none";
        let trialDaysRemaining = 0;
        if (trialData?.status) {
          trialStatus = trialData.status as AuthState["trialStatus"];
          trialDaysRemaining = trialData.daysRemaining || 0;
        }

        setAuthState((prev) => ({
          ...prev,
          isMfaEnrolled,
          isMfaVerified,
          currentAAL: isMfaVerified ? "aal2" : "aal1",
          plan: userPlan,
          role: userRole,
          appealCount,
          appealCredits,
          trialStatus,
          trialDaysRemaining,
          isAdmin,
        }));

        cacheSet(STORES.PROFILE, "profile", {
          plan: userPlan,
          role: userRole,
          appealCount,
          appealCredits,
          isAdmin,
          trialStatus,
          trialDaysRemaining,
        });
      } catch (error) {
        console.error("Error loading profile data:", error);
        // Fallback to offline cache
        const cached = await cacheGetIfFresh<{
          plan: string;
          role: string;
          appealCount: number;
          appealCredits: number;
          isAdmin: boolean;
          trialStatus: string;
          trialDaysRemaining: number;
        }>(STORES.PROFILE, "profile", TTL.PROFILE);
        if (cached) {
          const d = cached.data;
          setAuthState((prev) => ({
            ...prev,
            plan: d.plan as AuthState["plan"],
            role: d.role as AuthState["role"],
            appealCount: d.appealCount,
            appealCredits: d.appealCredits || 0,
            isAdmin: d.isAdmin,
            trialStatus: d.trialStatus as AuthState["trialStatus"],
            trialDaysRemaining: d.trialDaysRemaining,
          }));
        }
      }
    },
    []
  );

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
      const user = (e as CustomEvent<{ email: string; userId: string } | null>).detail;
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
    return () => window.removeEventListener("auth-state-change", handleAuthChange);
  }, [loadProfileData]);

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
          error: data.error || "Failed to send verification code",
        }));
        return false;
      }

      setAuthState((prev) => ({ ...prev, isLoading: false }));
      return true;
    } catch (error) {
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to send verification code",
      }));
      return false;
    }
  }, []);

  // Verify email OTP — returns { success, mfaRequired }
  const verifyEmailOTP = useCallback(
    async (email: string, code: string): Promise<{ success: boolean; mfaRequired?: boolean }> => {
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
            error: data.error || "Failed to verify code",
          }));
          return { success: false };
        }

        const userId = data.user?.userId ?? null;

        setAuthState((prev) => ({
          ...prev,
          userId,
          email,
          isEmailVerified: true,
          isLoading: false,
          error: null,
        }));

        // Notify other hooks of auth change
        if (userId) {
          dispatchAuthChange({ email, userId });
          // Load full profile non-blocking
          loadProfileData(userId, email);
        }

        return { success: true, mfaRequired: data.mfaRequired };
      } catch (error) {
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to verify code",
        }));
        return { success: false };
      }
    },
    [loadProfileData]
  );

  // Enroll TOTP — returns secret + QR code URI
  const enrollTOTP = useCallback(async (): Promise<{ qrCode: string; secret: string } | null> => {
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
        error: error instanceof Error ? error.message : "Failed to set up authenticator",
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
        error: error instanceof Error ? error.message : "Failed to remove authenticator",
      }));
      return false;
    }
  }, []);

  // Verify TOTP code (challenge during sign-in or enrollment confirm)
  const challengeAndVerifyTOTP = useCallback(async (code: string): Promise<boolean> => {
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
        error: error instanceof Error ? error.message : "Failed to verify authenticator code",
      }));
      return false;
    }
  }, []);

  // Confirm TOTP enrollment (first code after scanning QR)
  const confirmTOTPEnrollment = useCallback(async (code: string): Promise<boolean> => {
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
        error: error instanceof Error ? error.message : "Failed to confirm authenticator setup",
      }));
      return false;
    }
  }, []);

  // Check appeal access
  const checkAppealAccess = useCallback(async (): Promise<AppealAccessStatus> => {
    if (authState.isAdmin) return "allowed";
    if (authState.role === "counselor" || authState.role === "provider") return "allowed";
    if (!authState.isEmailVerified || !authState.email) return "paywall";

    try {
      const res = await fetch("/api/profile");
      const data = res.ok ? await res.json() : null;
      const credits = data?.appealCredits ?? authState.appealCredits;

      if (authState.plan === "trial") {
        return authState.trialStatus === "active" && credits > 0 ? "available" : "paywall";
      }
      if (authState.plan === "per_appeal" || authState.plan === "monthly") {
        return credits > 0 ? "available" : "paywall";
      }
      return "paywall";
    } catch {
      return authState.appealCredits > 0 ? "available" : "paywall";
    }
  }, [authState]);

  // Sign out
  const signOut = useCallback(async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    _cachedAuthState = null;
    setAuthState({ ...DEFAULT_AUTH_STATE, isLoading: false });
    dispatchAuthChange(null);
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
  };
}
