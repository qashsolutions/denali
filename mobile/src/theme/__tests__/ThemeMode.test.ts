/**
 * resolveScheme — the pure mode→effective-scheme decision behind useTheme().
 * Live state (mode + OS scheme) passed as explicit args, so the branch logic
 * is provable without rendering (stale-closure rule, mobile/CLAUDE.md).
 */

import { describe, expect, it } from "vitest";

import { resolveScheme } from "../themeScheme";

describe("resolveScheme", () => {
  it("explicit 'light' wins regardless of OS scheme", () => {
    expect(resolveScheme("light", "dark")).toBe("light");
    expect(resolveScheme("light", "light")).toBe("light");
    expect(resolveScheme("light", null)).toBe("light");
  });

  it("explicit 'dark' wins regardless of OS scheme", () => {
    expect(resolveScheme("dark", "light")).toBe("dark");
    expect(resolveScheme("dark", "dark")).toBe("dark");
    expect(resolveScheme("dark", null)).toBe("dark");
  });

  it("'system' follows the OS scheme", () => {
    expect(resolveScheme("system", "dark")).toBe("dark");
    expect(resolveScheme("system", "light")).toBe("light");
  });

  it("'system' defaults to light when the OS reports no scheme", () => {
    expect(resolveScheme("system", null)).toBe("light");
    expect(resolveScheme("system", undefined)).toBe("light");
  });
});
