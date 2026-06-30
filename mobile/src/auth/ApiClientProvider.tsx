/**
 * ApiClientProvider — React context for the singleton `ApiClient`.
 *
 * Phase 1 mobile, Wave 1.
 *
 * The provider creates ONE `ApiClient` instance per app launch and shares
 * it via context. Consumers obtain the instance via `useApiClient()`. The
 * consumer surface (onboarding, upload, chat) never constructs its own
 * client and never reaches into the auth/ folder directly — they import
 * the `ApiClient` interface from `@/contracts` and depend on the injected
 * value here.
 *
 * Splitting the provider into its own file keeps the .ts/.tsx boundary
 * clean: the impl is pure TypeScript, the provider is the JSX layer.
 */

import React from "react";

import type { ApiClient } from "@/contracts";

import { createApiClient } from "./ApiClientImpl";

interface ApiClientContextValue {
  client: ApiClient;
}

const ApiClientContext = React.createContext<ApiClientContextValue | null>(null);

export interface ApiClientProviderProps {
  children: React.ReactNode;
  /**
   * Optional override for tests. Production paths use the default
   * `createApiClient()`.
   */
  client?: ApiClient;
}

export function ApiClientProvider({
  children,
  client,
}: ApiClientProviderProps): React.ReactElement {
  // useRef so the same instance survives re-renders without going through
  // useState (which would also work but signals "this changes" to readers).
  const ref = React.useRef<ApiClient | null>(client ?? null);
  if (ref.current == null) {
    ref.current = createApiClient();
  }
  const value = React.useMemo<ApiClientContextValue>(
    () => ({ client: ref.current! }),
    [],
  );
  return (
    <ApiClientContext.Provider value={value}>
      {children}
    </ApiClientContext.Provider>
  );
}

export function useApiClient(): ApiClient {
  const ctx = React.useContext(ApiClientContext);
  if (ctx == null) {
    throw new Error(
      "useApiClient() called outside <ApiClientProvider>. Wrap your app root in <ApiClientProvider> (see App.tsx).",
    );
  }
  return ctx.client;
}
