"use client";

import { SparkleIcon } from "@/components/icons";

export function AIDisclaimer() {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/5 border-b border-amber-500/20 rounded-xl">
      <SparkleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
      <p className="text-xs text-amber-700 dark:text-amber-400">
        AI-generated analysis &middot; May contain errors &middot; Not medical advice
      </p>
    </div>
  );
}
