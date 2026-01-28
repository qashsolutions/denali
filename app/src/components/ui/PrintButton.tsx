"use client";

import { useCallback } from "react";
import { Button } from "./Button";

interface PrintButtonProps {
  className?: string;
  children?: React.ReactNode;
}

/**
 * Button that triggers browser print dialog
 * Elements with class "no-print" will be hidden during printing
 */
export function PrintButton({ className, children }: PrintButtonProps) {
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <Button
      variant="secondary"
      onClick={handlePrint}
      className={className}
    >
      <PrintIcon className="w-4 h-4 mr-2" />
      {children || "Print"}
    </Button>
  );
}

function PrintIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
      />
    </svg>
  );
}
