"use client";

import { useState, useEffect } from "react";
import { useAuth, type AppealAccessStatus } from "@/hooks/useAuth";
import { PhoneOTPModal } from "@/components/auth/PhoneOTPModal";
import { PaywallModal } from "@/components/payment/PaywallModal";

interface AppealGateProps {
  children: React.ReactNode;
  onAccessGranted?: () => void;
}

/**
 * AppealGate Component
 *
 * Controls access to appeal letter generation based on user's auth and payment status.
 *
 * Flow:
 * 1. If not authenticated → Show PhoneOTPModal
 * 2. If authenticated but first appeal → Allow access (free)
 * 3. If authenticated and used free appeal → Show PaywallModal
 * 4. If has unlimited subscription → Allow access
 */
export function AppealGate({ children, onAccessGranted }: AppealGateProps) {
  const {
    authState,
    sendOTP,
    verifyOTP,
    checkAppealAccess,
    clearError,
  } = useAuth();

  const [accessStatus, setAccessStatus] = useState<AppealAccessStatus | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Check access on mount and when auth state changes
  useEffect(() => {
    const check = async () => {
      setIsChecking(true);

      // If not verified, need to authenticate first
      if (!authState.isPhoneVerified) {
        setAccessStatus("paywall"); // Will show auth modal
        setIsChecking(false);
        return;
      }

      const status = await checkAppealAccess();
      setAccessStatus(status);
      setIsChecking(false);

      // If access is granted, call the callback
      if (status === "free" || status === "allowed") {
        onAccessGranted?.();
      }
    };

    check();
  }, [authState.isPhoneVerified, checkAppealAccess, onAccessGranted]);

  // Handle successful authentication
  const handleAuthVerified = async () => {
    setShowAuthModal(false);
    const status = await checkAppealAccess();
    setAccessStatus(status);

    if (status === "free" || status === "allowed") {
      onAccessGranted?.();
    } else if (status === "paywall") {
      setShowPaywallModal(true);
    }
  };

  // Handle successful payment
  const handlePaymentSuccess = () => {
    setShowPaywallModal(false);
    setAccessStatus("allowed");
    onAccessGranted?.();
  };

  // Request access (triggered by user action)
  const requestAccess = () => {
    if (!authState.isPhoneVerified) {
      setShowAuthModal(true);
    } else if (accessStatus === "paywall") {
      setShowPaywallModal(true);
    }
  };

  // Show loading state while checking
  if (isChecking) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-slate-400">
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Checking access...</span>
        </div>
      </div>
    );
  }

  // If access granted (free first appeal or subscription), show children
  if (accessStatus === "free" || accessStatus === "allowed") {
    return <>{children}</>;
  }

  // Show gated content with unlock prompt
  return (
    <>
      <div className="relative">
        {/* Blurred preview of content */}
        <div className="blur-sm opacity-50 pointer-events-none">
          {children}
        </div>

        {/* Overlay with unlock prompt */}
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-xl">
          <div className="text-center p-6 max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-600/20 to-violet-600/20 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>

            <h3 className="text-xl font-semibold text-slate-100 mb-2">
              {!authState.isPhoneVerified
                ? "Verify Your Phone"
                : "Unlock Your Appeal Letter"}
            </h3>

            <p className="text-slate-400 mb-6">
              {!authState.isPhoneVerified
                ? "Quick phone verification keeps your appeal letters secure."
                : "Get access to this appeal letter and help fight your denial."}
            </p>

            <button
              onClick={requestAccess}
              className="w-full py-3 px-6 rounded-xl font-medium transition-all bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white"
            >
              {!authState.isPhoneVerified ? "Verify Phone" : "View Pricing"}
            </button>

            {!authState.isPhoneVerified && (
              <p className="mt-3 text-sm text-slate-500">
                Your first appeal letter is free!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <PhoneOTPModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onVerified={handleAuthVerified}
        sendOTP={sendOTP}
        verifyOTP={verifyOTP}
        isLoading={authState.isLoading}
        error={authState.error}
        clearError={clearError}
      />

      {/* Paywall Modal */}
      <PaywallModal
        isOpen={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        onSuccess={handlePaymentSuccess}
        appealCount={authState.appealCount}
      />
    </>
  );
}

export default AppealGate;
