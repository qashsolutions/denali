"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);
  const [destination, setDestination] = useState<"back" | "home">("home");

  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  useEffect(() => {
    const referrer = document.referrer;
    const currentOrigin = window.location.origin;

    if (referrer && referrer.startsWith(currentOrigin)) {
      setDestination("back");
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (countdown === 0) {
      if (destination === "back") {
        router.back();
      } else {
        router.push("/");
      }
    }
  }, [countdown, destination, router]);

  const handleRedirectNow = () => {
    if (destination === "back") {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--error)]/20 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-[var(--error)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          Something Went Wrong
        </h1>
        <p className="text-[var(--text-secondary)] mb-6">
          This page ran into a problem. We&apos;ll take you{" "}
          {destination === "back" ? "back" : "home"} shortly.
        </p>

        {/* Countdown */}
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Redirecting {destination === "back" ? "back" : "to home"} in{" "}
          <span className="font-semibold text-[var(--accent-primary)]">
            {countdown}
          </span>{" "}
          second{countdown !== 1 ? "s" : ""}...
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleRedirectNow}
            className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white font-medium transition-opacity hover:opacity-90"
          >
            {destination === "back" ? "Go Back Now" : "Go Home Now"}
          </button>
          <button
            onClick={reset}
            className="px-6 py-2.5 rounded-full border border-[var(--border)] text-[var(--text-primary)] font-medium transition-colors hover:bg-[var(--bg-secondary)]"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
