/**
 * biometricGate — unit tests.
 *
 * The native module can't load in node-env vitest, so expo-local-authentication
 * is mocked. These pin the verdict logic: availability gating + the
 * passed/failed/unavailable mapping, including the fail-safe error paths.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hasHardwareMock = vi.fn(async () => true);
const isEnrolledMock = vi.fn(async () => true);
const authenticateMock = vi.fn(async () => ({ success: true }) as { success: boolean });
vi.mock("expo-local-authentication", () => ({
  hasHardwareAsync: () => hasHardwareMock(),
  isEnrolledAsync: () => isEnrolledMock(),
  authenticateAsync: (opts: unknown) => authenticateMock(),
}));

import { isBiometricAvailable, runBiometricGate } from "../biometricGate";

beforeEach(() => {
  hasHardwareMock.mockResolvedValue(true);
  isEnrolledMock.mockResolvedValue(true);
  authenticateMock.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("biometricGate — availability", () => {
  it("unavailable when no hardware", async () => {
    hasHardwareMock.mockResolvedValue(false);
    expect(await isBiometricAvailable()).toBe(false);
  });

  it("unavailable when hardware present but nothing enrolled", async () => {
    isEnrolledMock.mockResolvedValue(false);
    expect(await isBiometricAvailable()).toBe(false);
  });

  it("available when hardware + enrolled credential", async () => {
    expect(await isBiometricAvailable()).toBe(true);
  });

  it("treats a native error as unavailable (fail-safe, never bricks)", async () => {
    hasHardwareMock.mockRejectedValue(new Error("boom"));
    expect(await isBiometricAvailable()).toBe(false);
  });
});

describe("biometricGate — runBiometricGate verdicts", () => {
  it("'unavailable' without prompting when no enrolled credential", async () => {
    isEnrolledMock.mockResolvedValue(false);
    expect(await runBiometricGate()).toBe("unavailable");
    expect(authenticateMock).not.toHaveBeenCalled();
  });

  it("'passed' on a successful authentication", async () => {
    expect(await runBiometricGate()).toBe("passed");
  });

  it("'failed' when authentication is unsuccessful", async () => {
    authenticateMock.mockResolvedValue({ success: false });
    expect(await runBiometricGate()).toBe("failed");
  });

  it("'failed' when the native call throws (lockout etc.)", async () => {
    authenticateMock.mockRejectedValue(new Error("lockout"));
    expect(await runBiometricGate()).toBe("failed");
  });
});
