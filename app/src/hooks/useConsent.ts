"use client";

import { useState, useEffect, useCallback } from "react";

export interface ConsentState {
  health_data_ai: boolean;
  health_data_storage: boolean;
  analytics: boolean;
}

const DEFAULT_CONSENT: ConsentState = {
  health_data_ai: false,
  health_data_storage: false,
  analytics: false,
};

interface UseConsentReturn {
  consent: ConsentState;
  isLoading: boolean;
  updateConsent: (type: keyof ConsentState, granted: boolean) => Promise<void>;
  hasConsent: (type: keyof ConsentState) => boolean;
}

export function useConsent(): UseConsentReturn {
  const [consent, setConsent] = useState<ConsentState>(DEFAULT_CONSENT);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConsent = async () => {
      try {
        const res = await fetch("/api/consent");
        if (res.ok) {
          const data = await res.json();
          setConsent({
            health_data_ai: data.consent.health_data_ai ?? false,
            health_data_storage: data.consent.health_data_storage ?? false,
            analytics: data.consent.analytics ?? false,
          });
        }
      } catch (error) {
        console.warn("Failed to fetch consent:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConsent();
  }, []);

  const updateConsent = useCallback(
    async (type: keyof ConsentState, granted: boolean) => {
      // Optimistic update
      setConsent((prev) => ({ ...prev, [type]: granted }));

      try {
        const res = await fetch("/api/consent", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consentType: type, granted }),
        });

        if (!res.ok) {
          // Revert on failure
          setConsent((prev) => ({ ...prev, [type]: !granted }));
        }
      } catch {
        setConsent((prev) => ({ ...prev, [type]: !granted }));
      }
    },
    []
  );

  const hasConsent = useCallback(
    (type: keyof ConsentState) => consent[type],
    [consent]
  );

  return { consent, isLoading, updateConsent, hasConsent };
}
