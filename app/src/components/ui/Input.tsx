"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, type = "text", ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          type={type}
          ref={ref}
          className={cn(
            "w-full h-12 px-4 rounded-[var(--radius-lg)]",
            "bg-[var(--input-bg)] text-[var(--text-primary)]",
            "border border-[var(--border)]",
            "placeholder:text-[var(--text-muted)]",
            "transition-colors duration-[var(--transition-fast)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-[var(--error)] focus:ring-[var(--error)]",
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-[var(--error)]">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
