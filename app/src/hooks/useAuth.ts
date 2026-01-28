"use client";

import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export interface AuthState {
  phone: string | null;
  isPhoneVerified: boolean;
  email: string | null;
  isEmailVerified: boolean;
  plan: "free" | "per_appeal" | "unlimited";
  appealCount: number;
  isLoading: boolean;
  error: string | null;
}

export type AppealAccessStatus = "free" | "paywall" | "allowed";

interface UseAuthReturn {
  authState: AuthState;
  sendOTP: (phone: string) => Promise<boolean>;
  verifyOTP: (phone: string, code: string) => Promise<boolean>;
  checkAppealAccess: () => Promise<AppealAccessStatus>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const DEFAULT_AUTH_STATE: AuthState = {
  phone: null,
  isPhoneVerified: false,
  email: null,
  isEmailVerified: false,
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
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          const phone = session.user.phone || null;
          const email = session.user.email || null;

          // Fetch user profile from database
          const { data: profile } = await supabase
            .from("users")
            .select("plan, phone")
            .eq("id", session.user.id)
            .single();

          // Fetch appeal count (only if phone exists)
          let appealCount = 0;
          if (phone) {
            const { data: usage } = await supabase
              .from("usage")
              .select("appeal_count")
              .eq("phone", phone)
              .single();
            appealCount = usage?.appeal_count || 0;
          }

          // Validate plan type
          const validPlans = ["free", "per_appeal", "unlimited"] as const;
          const userPlan = validPlans.includes(profile?.plan as typeof validPlans[number])
            ? (profile?.plan as "free" | "per_appeal" | "unlimited")
            : "free";

          setAuthState({
            phone,
            isPhoneVerified: !!phone,
            email,
            isEmailVerified: !!email && session.user.email_confirmed_at !== null,
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (event === "SIGNED_IN" && session?.user) {
          const phone = session.user.phone || null;
          setAuthState((prev) => ({
            ...prev,
            phone,
            isPhoneVerified: !!phone,
            email: session.user.email || null,
            isEmailVerified: !!session.user.email && session.user.email_confirmed_at !== null,
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

  // Send OTP to phone number
  const sendOTP = useCallback(async (phone: string): Promise<boolean> => {
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Format phone number (ensure it starts with +1 for US)
      const formattedPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;

      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

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
        phone: formattedPhone,
        isLoading: false,
      }));
      return true;
    } catch (error) {
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to send verification code",
      }));
      return false;
    }
  }, [supabase]);

  // Verify OTP code
  const verifyOTP = useCallback(async (phone: string, code: string): Promise<boolean> => {
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const formattedPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;

      const { error, data } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: code,
        type: "sms",
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
        const { error: upsertError } = await supabase
          .from("users")
          .upsert({
            id: data.user.id,
            phone: formattedPhone,
            plan: "free",
          }, {
            onConflict: "id",
          });

        if (upsertError) {
          console.error("Error upserting user:", upsertError);
        }

        // Initialize usage record if not exists
        const { error: usageError } = await supabase
          .from("usage")
          .upsert({
            phone: formattedPhone,
            appeal_count: 0,
          }, {
            onConflict: "phone",
            ignoreDuplicates: true,
          });

        if (usageError) {
          console.error("Error initializing usage:", usageError);
        }

        setAuthState((prev) => ({
          ...prev,
          phone: formattedPhone,
          isPhoneVerified: true,
          isLoading: false,
        }));
        return true;
      }

      return false;
    } catch (error) {
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to verify code",
      }));
      return false;
    }
  }, [supabase]);

  // Check appeal access based on phone and plan
  const checkAppealAccess = useCallback(async (): Promise<AppealAccessStatus> => {
    if (!authState.isPhoneVerified || !authState.phone) {
      // Need to sign up first
      return "paywall";
    }

    try {
      // Check if user has unlimited plan
      if (authState.plan === "unlimited") {
        return "allowed";
      }

      // Check appeal count
      const { data: usage } = await supabase
        .from("usage")
        .select("appeal_count")
        .eq("phone", authState.phone)
        .single();

      const appealCount = usage?.appeal_count || 0;

      // First appeal is free
      if (appealCount === 0) {
        return "free";
      }

      // Additional appeals require payment
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
    sendOTP,
    verifyOTP,
    checkAppealAccess,
    signOut,
    clearError,
  };
}
