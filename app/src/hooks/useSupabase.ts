"use client";

import { useMemo } from "react";
import { getClient } from "@/lib/supabase";

/**
 * Hook to access the Supabase client in components
 */
export function useSupabase() {
  const client = useMemo(() => getClient(), []);
  return client;
}
