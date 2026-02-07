// DEAD CODE — No consumers. Components use createClient() from @/lib/supabase directly.
// Commented out 2026-02-06. Safe to delete if still unused after next review.

// "use client";
//
// import { useMemo } from "react";
// import { getClient } from "@/lib/supabase";
//
// /**
//  * Hook to access the Supabase client in components
//  */
// export function useSupabase() {
//   const client = useMemo(() => getClient(), []);
//   return client;
// }
