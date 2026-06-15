/**
 * Backup policy — pure helpers for the "manual + automatic" trigger (D16).
 *
 * Auto-backup is OPPORTUNISTIC (checked on app-foreground), not a fragile
 * background task: when backup is enabled, the last backup is stale, and the
 * network is suitable, upload. Every decision is pure + unit-tested; the screen
 * supplies live state (now, network, last-backup) as explicit args.
 */

export type NetworkKind = "wifi" | "cellular" | "none" | "unknown";

export const DEFAULT_STALE_AFTER_MS = 24 * 60 * 60 * 1000; // 24h

export interface AutoBackupInputs {
  enabled: boolean;
  lastBackupAtMs: number | null;
  nowMs: number;
  network: NetworkKind;
  /** Default true: only auto-backup on unmetered (wifi) connections. */
  wifiOnly?: boolean;
  staleAfterMs?: number;
}

/** Whether an automatic backup should fire right now. */
export function shouldAutoBackup(args: AutoBackupInputs): boolean {
  if (!args.enabled) return false;
  if (args.network === "none" || args.network === "unknown") return false;

  const wifiOnly = args.wifiOnly ?? true;
  if (wifiOnly && args.network !== "wifi") return false;

  const staleAfter = args.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  if (args.lastBackupAtMs != null && args.nowMs - args.lastBackupAtMs < staleAfter) {
    return false;
  }
  return true;
}

/** Human-readable status line for the Settings backup row. */
export function describeBackupStatus(
  lastBackupAtMs: number | null,
  nowMs: number,
): string {
  if (lastBackupAtMs == null) return "Not backed up yet";
  const mins = Math.floor((nowMs - lastBackupAtMs) / 60_000);
  if (mins < 1) return "Backed up just now";
  if (mins < 60) return `Backed up ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Backed up ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Backed up ${days} day${days === 1 ? "" : "s"} ago`;
}
