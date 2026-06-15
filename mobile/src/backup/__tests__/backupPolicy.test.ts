/**
 * Backup policy — shouldAutoBackup + describeBackupStatus (pure).
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_STALE_AFTER_MS,
  describeBackupStatus,
  shouldAutoBackup,
} from "../backupPolicy";

const NOW = 1_000 * DEFAULT_STALE_AFTER_MS; // arbitrary fixed "now"

describe("shouldAutoBackup", () => {
  const base = {
    enabled: true,
    lastBackupAtMs: null,
    nowMs: NOW,
    network: "wifi" as const,
  };

  it("is false when backup is disabled", () => {
    expect(shouldAutoBackup({ ...base, enabled: false })).toBe(false);
  });

  it("is false with no/unknown network", () => {
    expect(shouldAutoBackup({ ...base, network: "none" })).toBe(false);
    expect(shouldAutoBackup({ ...base, network: "unknown" })).toBe(false);
  });

  it("is false on cellular by default (wifiOnly)", () => {
    expect(shouldAutoBackup({ ...base, network: "cellular" })).toBe(false);
  });

  it("allows cellular when wifiOnly is off", () => {
    expect(shouldAutoBackup({ ...base, network: "cellular", wifiOnly: false })).toBe(true);
  });

  it("is false when the last backup is still fresh", () => {
    expect(
      shouldAutoBackup({ ...base, lastBackupAtMs: NOW - 60_000 }),
    ).toBe(false);
  });

  it("fires when enabled, stale, and on wifi", () => {
    expect(
      shouldAutoBackup({ ...base, lastBackupAtMs: NOW - DEFAULT_STALE_AFTER_MS - 1 }),
    ).toBe(true);
  });

  it("fires on first run (never backed up) when on wifi", () => {
    expect(shouldAutoBackup({ ...base, lastBackupAtMs: null })).toBe(true);
  });
});

describe("describeBackupStatus", () => {
  it("reports never-backed-up", () => {
    expect(describeBackupStatus(null, NOW)).toBe("Not backed up yet");
  });
  it("reports just now", () => {
    expect(describeBackupStatus(NOW - 30_000, NOW)).toBe("Backed up just now");
  });
  it("reports minutes", () => {
    expect(describeBackupStatus(NOW - 5 * 60_000, NOW)).toBe("Backed up 5 min ago");
  });
  it("reports hours", () => {
    expect(describeBackupStatus(NOW - 3 * 3_600_000, NOW)).toBe("Backed up 3h ago");
  });
  it("reports days with pluralization", () => {
    expect(describeBackupStatus(NOW - 24 * 3_600_000, NOW)).toBe("Backed up 1 day ago");
    expect(describeBackupStatus(NOW - 72 * 3_600_000, NOW)).toBe("Backed up 3 days ago");
  });
});
