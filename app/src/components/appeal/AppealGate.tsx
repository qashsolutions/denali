"use client";

import { useState, useEffect } from "react";
import { useAuth, type AppealAccessStatus } from "@/hooks/useAuth";
import { EmailOTPModal } from "@/components/auth/EmailOTPModal";
// ---------------------------------------------------------------
// TOTP modals — DISABLED (2026-03-10)
//
// CMS Medicare App Library requires ID.me (IAL2/AAL2) for identity
// verification. TOTP MFA was optional extra security not mandated
// by CMS. ID.me now gates Blue Button access via /api/fhir/authorize.
//
// To re-enable: uncomment imports below + TOTP state/handlers/modals
// in this component. All TOTP API routes and hooks remain intact.
// ---------------------------------------------------------------
// import { TOTPChallengeModal } from "@/components/auth/TOTPChallengeModal";
// import { TOTPEnrollModal } from "@/components/auth/TOTPEnrollModal";
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
 * 1. If not authenticated → Show EmailOTPModal
 * 2. If authenticated + has credits → Allow access
 * 3. If authenticated + no credits → Show PaywallModal
 * 4. If has monthly subscription → Allow access
 *
 * Note: TOTP challenge step removed (2026-03-10) — ID.me is the CMS-mandated
 * identity verification path. TOTP code preserved in comments for future use.
 */
export function AppealGate({ children, onAccessGranted }: AppealGateProps) {
  const {
    authState,
    sendEmailOTP,
    verifyEmailOTP,
    // TOTP disabled — enrollTOTP, challengeAndVerifyTOTP, confirmTOTPEnrollment,
    checkAppealAccess,
    clearError,
  } = useAuth();

  const [accessStatus, setAccessStatus] = useState<AppealAccessStatus | null>(
    null
  );
  const [showEmailModal, setShowEmailModal] = useState(false);
  // TOTP disabled (2026-03-10) — see comment at top of file
  // const [showTOTPChallenge, setShowTOTPChallenge] = useState(false);
  // const [showTOTPEnroll, setShowTOTPEnroll] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Check access on mount and when auth state settles
  // Depends on isEmailVerified + plan + isAdmin so the gate re-evaluates
  // after loadProfileData() completes (avoids stale closure race).
  // Does NOT depend on the full authState to avoid re-running on every loading toggle.
  useEffect(() => {
    const check = async () => {
      if (!authState.isEmailVerified) {
        setAccessStatus("paywall");
        setIsChecking(false);
        return;
      }

      setIsChecking(true);
      const status = await checkAppealAccess();
      setAccessStatus(status);
      setIsChecking(false);

      if (status === "available" || status === "allowed") {
        onAccessGranted?.();
      }
    };

    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState.isEmailVerified, authState.plan, authState.isAdmin]);

  // Handle successful email verification
  const handleEmailVerified = async () => {
    setShowEmailModal(false);
    const status = await checkAppealAccess();
    setAccessStatus(status);

    if (status === "available" || status === "allowed") {
      onAccessGranted?.();
      // TOTP enrollment after first appeal — disabled (2026-03-10)
      // if (status === "available" && !authState.isMfaEnrolled) {
      //   setShowTOTPEnroll(true);
      // }
    } else if (status === "paywall") {
      setShowPaywallModal(true);
    }
  };

  // TOTP handlers — disabled (2026-03-10), preserved for future use
  // const handleTOTPVerified = async () => {
  //   setShowTOTPChallenge(false);
  //   const status = await checkAppealAccess();
  //   setAccessStatus(status);
  //   if (status === "available" || status === "allowed") {
  //     onAccessGranted?.();
  //   } else if (status === "paywall") {
  //     setShowPaywallModal(true);
  //   }
  // };
  // const handleTOTPEnrolled = () => setShowTOTPEnroll(false);
  // const handleTOTPSkip = () => setShowTOTPEnroll(false);
  // const handleFallbackToEmail = () => {
  //   setShowTOTPChallenge(false);
  //   setShowEmailModal(true);
  // };

  // Handle successful payment
  const handlePaymentSuccess = () => {
    setShowPaywallModal(false);
    setAccessStatus("allowed");
    onAccessGranted?.();
  };

  // Request access (triggered by user action)
  const requestAccess = () => {
    if (!authState.isEmailVerified) {
      // TOTP challenge disabled (2026-03-10) — go straight to email OTP
      // if (authState.isMfaEnrolled) {
      //   setShowTOTPChallenge(true);
      // } else {
      setShowEmailModal(true);
      // }
    } else if (accessStatus === "paywall") {
      setShowPaywallModal(true);
    }
  };

  // If access granted (has credits or subscription), show children
  if (accessStatus === "available" || accessStatus === "allowed") {
    return (
      <>
        {children}

        {/* TOTP enrollment modal — disabled (2026-03-10) */}
        {/* <TOTPEnrollModal
          isOpen={showTOTPEnroll}
          onClose={() => setShowTOTPEnroll(false)}
          onEnrolled={handleTOTPEnrolled}
          onSkip={handleTOTPSkip}
          enrollTOTP={enrollTOTP}
          confirmTOTPEnrollment={confirmTOTPEnrollment}
          isLoading={authState.isLoading}
          error={authState.error}
          clearError={clearError}
        /> */}
      </>
    );
  }

  // Show gated content with unlock prompt
  return (
    <>
      <div className="relative">
        {/* Blurred preview of content */}
        <div className="blur-sm opacity-50 pointer-events-none">{children}</div>

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
              {!authState.isEmailVerified
                ? "Sign Up to Get Started"
                : authState.trialStatus === "expired"
                ? "Your Trial Has Ended"
                : "Unlock Your Appeal Letter"}
            </h3>

            <p className="text-slate-400 mb-6">
              {!authState.isEmailVerified
                ? "Create a free account to get your first appeal letter."
                : authState.trialStatus === "expired"
                ? "Upgrade to continue generating appeal letters."
                : "Get access to this appeal letter and help fight your denial."}
            </p>

            <button
              onClick={requestAccess}
              className="w-full py-3 px-6 rounded-xl font-medium transition-all bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white"
            >
              {!authState.isEmailVerified ? "Sign Up Free" : "View Pricing"}
            </button>

            {!authState.isEmailVerified && (
              <p className="mt-3 text-sm text-slate-500">
                Includes a 14-day free trial with 10 messages per day.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Email OTP Modal */}
      <EmailOTPModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onVerified={handleEmailVerified}
        sendEmailOTP={sendEmailOTP}
        verifyEmailOTP={verifyEmailOTP}
        isLoading={authState.isLoading}
        error={authState.error}
        clearError={clearError}
      />

      {/* TOTP Challenge Modal — disabled (2026-03-10) */}
      {/* <TOTPChallengeModal
        isOpen={showTOTPChallenge}
        onClose={() => setShowTOTPChallenge(false)}
        onVerified={handleTOTPVerified}
        onFallbackToEmail={handleFallbackToEmail}
        challengeAndVerifyTOTP={challengeAndVerifyTOTP}
        isLoading={authState.isLoading}
        error={authState.error}
        clearError={clearError}
      /> */}

      {/* Paywall Modal */}
      <PaywallModal
        isOpen={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        onSuccess={handlePaymentSuccess}
        appealCount={authState.appealCount}
        trialExpired={authState.trialStatus === "expired"}
      />
    </>
  );
}

export default AppealGate;
