"use client";

import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

export interface ContainerProps {
  children: ReactNode;
  className?: string;
}

export function Container({ children, className }: ContainerProps) {
  return (
    <div
      className={cn(
        "w-full max-w-2xl mx-auto px-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageContainer({ children, className }: ContainerProps) {
  return (
    <div
      className={cn(
        "min-h-screen flex flex-col bg-[var(--bg-primary)]",
        className
      )}
    >
      {children}
    </div>
  );
}
