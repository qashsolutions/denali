/**
 * Process-singleton wrapper around `createLocalDataDAL(adapter)`.
 *
 * Wave 2 / mobile-upload-parse-builder.
 *
 * Why a singleton:
 *   The DAL's `openLocalDb()` is itself a singleton (see
 *   `mobile/src/db/open.ts`), and the DAL factory is trivially stateless.
 *   We memoize the bound DAL so each upload screen render doesn't pay the
 *   open + migrate cost, and so multiple screens share the same adapter
 *   reference (relevant for test injection later).
 *
 * The full Wave-1 pattern would expose a `useDal()` hook via React context;
 * that's deferred to Pass 2 when the app-shell agent wires the context.
 * For Wave 2 we provide an async accessor that screens await on mount.
 */

import type { LocalDataDAL } from "@/contracts";
import { createLocalDataDAL } from "@/db/dal";
import { openLocalDb } from "@/db/open";

let cached: LocalDataDAL | null = null;

export async function getLocalDataDAL(): Promise<LocalDataDAL> {
  if (cached) return cached;
  const adapter = await openLocalDb();
  cached = createLocalDataDAL(adapter);
  return cached;
}

export function __resetDalSingletonForTests(): void {
  cached = null;
}
