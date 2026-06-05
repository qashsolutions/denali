/**
 * DalProvider — React context for the singleton `LocalDataDAL`.
 *
 * Wave 2 onboarding + upload screens need a way to obtain the DAL instance
 * without each screen calling `openLocalDb()` itself. The provider opens
 * the SQLCipher DB once on mount, applies migrations, and shares the
 * resulting `LocalDataDAL` via context.
 *
 * The DB open is async — until it resolves, `useDal()` returns `null`.
 * Consumers must handle the null state (typically by showing a brief
 * loading view) before calling DAL methods. This mirrors how the web's
 * `useAuth` exposes `isLoading: true` until the profile call settles.
 *
 * Test override: callers can pass an explicit `dal` prop. The DAL unit
 * tests already exercise the DAL implementations directly via
 * `createLocalDataDAL(adapter)`; this provider is the production wiring.
 */
import React from "react";

import type { LocalDataDAL } from "@/contracts";

import { createLocalDataDAL } from "./dal";
import { openLocalDb } from "./open";

interface DalContextValue {
  dal: LocalDataDAL | null;
  /** True after `openLocalDb()` has resolved (or rejected). */
  ready: boolean;
  /** Set if the open or migration failed; safe to display to a user. */
  error: Error | null;
}

const DalContext = React.createContext<DalContextValue | null>(null);

export interface DalProviderProps {
  children: React.ReactNode;
  /** Test-only override — when set, the provider skips openLocalDb(). */
  dal?: LocalDataDAL;
}

export function DalProvider({
  children,
  dal: overrideDal,
}: DalProviderProps): React.ReactElement {
  const [state, setState] = React.useState<DalContextValue>({
    dal: overrideDal ?? null,
    ready: overrideDal != null,
    error: null,
  });

  React.useEffect(() => {
    if (overrideDal != null) return; // Test path skips real open.
    let cancelled = false;
    openLocalDb()
      .then((adapter) => {
        if (cancelled) return;
        setState({ dal: createLocalDataDAL(adapter), ready: true, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const error =
          err instanceof Error ? err : new Error(String(err ?? "open failed"));
        setState({ dal: null, ready: true, error });
      });
    return () => {
      cancelled = true;
    };
  }, [overrideDal]);

  return <DalContext.Provider value={state}>{children}</DalContext.Provider>;
}

/**
 * Returns the singleton DAL. Returns `null` while the DB is still opening
 * (or if the open failed — see `useDalState()` to inspect error/ready).
 */
export function useDal(): LocalDataDAL | null {
  const ctx = React.useContext(DalContext);
  if (ctx == null) {
    throw new Error(
      "useDal() called outside <DalProvider>. Wrap your app root in <DalProvider>.",
    );
  }
  return ctx.dal;
}

/**
 * Detailed DAL state — for surfaces that need to differentiate "still
 * loading" from "load failed". Returns the full {dal, ready, error}
 * triple.
 */
export function useDalState(): DalContextValue {
  const ctx = React.useContext(DalContext);
  if (ctx == null) {
    throw new Error(
      "useDalState() called outside <DalProvider>. Wrap your app root in <DalProvider>.",
    );
  }
  return ctx;
}
