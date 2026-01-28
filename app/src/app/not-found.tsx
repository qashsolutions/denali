"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NotFound() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(3);
  const [destination, setDestination] = useState<"back" | "home">("home");

  useEffect(() => {
    // Check if we have a referrer from the same origin
    const referrer = document.referrer;
    const currentOrigin = window.location.origin;

    if (referrer && referrer.startsWith(currentOrigin)) {
      setDestination("back");
    }
  }, []);

  useEffect(() => {
    // Countdown timer
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
    // Redirect when countdown reaches 0
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
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--accent-primary)]/20 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-[var(--accent-primary)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          Page Not Found
        </h1>
        <p className="text-[var(--text-secondary)] mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
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
          <Link
            href="/chat"
            className="px-6 py-2.5 rounded-full border border-[var(--border)] text-[var(--text-primary)] font-medium transition-colors hover:bg-[var(--bg-secondary)]"
          >
            Ask a Question
          </Link>
        </div>
      </div>
    </div>
  );
}
