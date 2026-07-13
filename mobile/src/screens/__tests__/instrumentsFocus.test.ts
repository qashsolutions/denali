/**
 * Instruments focus-mode pins — the clinical pre-review guards plus the
 * routing table.
 *
 *   G1 — "mood" resolves to the full mood path (never a menu shortcut).
 *   G3 — isFocusComplete keys ONLY off post-persist signals.
 *
 * Post-2026-07 licensing removal: only public-domain scored screeners remain
 * (mood / anxiety / alcohol). The former sex-gated instrument domains
 * (sleep / urinary / menopause / hormonal) lost their instruments and now
 * resolve "unavailable" — their repeat-entry CTA is the symptom tracker.
 */
import { describe, expect, it } from "vitest";

import {
  checkInAvailable,
  finishTarget,
  isFocusComplete,
  resolveFocus,
  type MenuKey,
} from "../instrumentsFocus";

describe("resolveFocus — routing table", () => {
  it("no focus → none (onboarding behavior)", () => {
    expect(resolveFocus(undefined, "male")).toEqual({ kind: "none" });
  });

  it("mood → the full mood path for every cohort (G1)", () => {
    for (const sex of ["male", "female", "intersex", "unknown", null] as const) {
      expect(resolveFocus("mood", sex)).toEqual({ kind: "mood" });
    }
  });

  it.each([
    ["anxiety", "anxiety"],
    ["alcohol", "alcohol"],
  ] as const)("%s → menu %s for every cohort", (domain, menuKey) => {
    for (const sex of ["male", "female", "intersex", "unknown", null] as const) {
      expect(resolveFocus(domain, sex)).toEqual({ kind: "menu", menuKey });
    }
  });

  it.each(["sleep", "urinary", "menopause", "hormonal"] as const)(
    "%s → unavailable for every cohort (instrument removed; symptom tracker instead)",
    (domain) => {
      for (const sex of [
        "male",
        "female",
        "intersex",
        "unknown",
        null,
      ] as const) {
        expect(resolveFocus(domain, sex)).toEqual({ kind: "unavailable" });
      }
    },
  );

  it("umbrella domains carry no instrument", () => {
    expect(resolveFocus("health_markers", "male")).toEqual({
      kind: "unavailable",
    });
    expect(resolveFocus("health_history", "female")).toEqual({
      kind: "unavailable",
    });
  });
});

describe("checkInAvailable — CTA visibility", () => {
  it("true exactly when the focus is a runnable scored screener", () => {
    expect(checkInAvailable("mood", null)).toBe(true);
    expect(checkInAvailable("anxiety", "unknown")).toBe(true);
    expect(checkInAvailable("alcohol", "female")).toBe(true);
    // Instrument-less domains: no scored check-in CTA.
    expect(checkInAvailable("urinary", "male")).toBe(false);
    expect(checkInAvailable("menopause", "female")).toBe(false);
    expect(checkInAvailable("hormonal", "male")).toBe(false);
    expect(checkInAvailable("sleep", "male")).toBe(false);
    expect(checkInAvailable("health_markers", "male")).toBe(false);
    expect(checkInAvailable("health_history", "female")).toBe(false);
  });
});

describe("isFocusComplete — post-persist signals only (G3)", () => {
  const none = new Set<MenuKey>();

  it("mood completes only when moodDone (set after persist resolves)", () => {
    expect(isFocusComplete({ kind: "mood" }, false, none)).toBe(false);
    expect(isFocusComplete({ kind: "mood" }, true, none)).toBe(true);
  });

  it("menu completes only when doneKeys gains its key (post-persist)", () => {
    const r = { kind: "menu", menuKey: "anxiety" } as const;
    expect(isFocusComplete(r, false, none)).toBe(false);
    expect(isFocusComplete(r, true, none)).toBe(false); // moodDone irrelevant
    expect(isFocusComplete(r, false, new Set<MenuKey>(["alcohol"]))).toBe(false);
    expect(isFocusComplete(r, false, new Set<MenuKey>(["anxiety"]))).toBe(true);
  });

  it("none/unavailable never report complete", () => {
    expect(
      isFocusComplete({ kind: "none" }, true, new Set<MenuKey>(["anxiety"])),
    ).toBe(false);
    expect(
      isFocusComplete(
        { kind: "unavailable" },
        true,
        new Set<MenuKey>(["anxiety"]),
      ),
    ).toBe(false);
  });
});

describe("finishTarget", () => {
  it("onboarding → main tabs; focus mode → back", () => {
    expect(finishTarget(undefined)).toBe("main-tabs");
    expect(finishTarget("anxiety")).toBe("back");
    expect(finishTarget("mood")).toBe("back");
  });
});
