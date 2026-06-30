/**
 * useBackupDeps — assembles the BackupDeps the controller needs from the app
 * providers (ApiClient + DAL) plus the production crypto/store/RNG. Returns
 * null until the local DB is ready. App-only (touches native adapters); the
 * controller itself stays unit-tested with injected deps.
 */

import React from "react";

import { useApiClient } from "@/auth";
import { useDal } from "@/db/DalProvider";

import { type BackupDeps } from "./backupController";
import { backupCrypto, expoRandomBytes } from "./expoRng";
import { recoveryKeyStore } from "./recoveryKeyStore";

export function useBackupDeps(): BackupDeps | null {
  const api = useApiClient();
  const dal = useDal();
  return React.useMemo<BackupDeps | null>(() => {
    if (!dal) return null;
    return {
      api,
      dal,
      crypto: backupCrypto,
      store: recoveryKeyStore,
      randomBytes: expoRandomBytes,
      nowIso: () => new Date().toISOString(),
    };
  }, [api, dal]);
}
