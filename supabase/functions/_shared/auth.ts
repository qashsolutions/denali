/**
 * Auth Utilities for Supabase Edge Functions
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Create authenticated Supabase client from request
 */
export function createSupabaseClient(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Get auth header from request
  const authHeader = req.headers.get("Authorization");

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });
}

/**
 * Validate request has required fields
 */
export function validateRequest<T extends Record<string, unknown>>(
  body: unknown,
  requiredFields: (keyof T)[]
): { valid: true; data: T } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body is required" };
  }

  const data = body as Record<string, unknown>;

  for (const field of requiredFields) {
    if (!(field in data) || data[field as string] === undefined) {
      return { valid: false, error: `Missing required field: ${String(field)}` };
    }
  }

  return { valid: true, data: data as T };
}
