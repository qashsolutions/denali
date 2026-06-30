/**
 * Instruments focus-mode pins (Step 4) — the three clinical pre-review
 * guards plus the routing table.
 *
 *   G1 — "mood" resolves to the full mood path (never a menu shortcut).
 *   G2 — sex-gated mismatches resolve "unavailable" (defined fallback),
 *        including unknown/intersex/null.
 *   G3 — isFocusComplete keys ONLY off post-persist signals.
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
    ["sleep", "sleep"],
  ] as const)("%s → menu %s for every cohort", (domain, menuKey) => {
    for (const sex of ["male", "female", "intersex", "unknown", null] as const) {
      expect(resolveFocus(domain, sex)).toEqual({ kind: "menu", menuKey });
    }
  });

  it("urinary → IPSS for male only; everyone else unavailable (G2)", () => {
    expect(resolveFocus("urinary", "male")).toEqual({
      kind: "menu",
      menuKey: "urinary",
    });
    for (const sex of ["female", "intersex", "unknown", null] as const) {
      expect(resolveFocus("urinary", sex)).toEqual({ kind: "unavailable" });
    }
  });

  it("menopause → MRS for female only; everyone else unavailable (G2)", () => {
    expect(resolveFocus("menopause", "female")).toEqual({
      kind: "menu",
      menuKey: "hormonalFemale",
    });
    for (const sex of ["male", "intersex", "unknown", null] as const) {
      expect(resolveFocus("menopause", sex)).toEqual({ kind: "unavailable" });
    }
  });

  it("hormonal → ADAM for male only; everyone else unavailable (G2)", () => {
    expect(resolveFocus("hormonal", "male")).toEqual({
      kind: "menu",
      menuKey: "hormonalMale",
    });
    for (const sex of ["female", "intersex", "unknown", null] as const) {
      expect(resolveFocus("hormonal", sex)).toEqual({ kind: "unavailable" });
    }
  });

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
  it("true exactly when the focus is runnable", () => {
    expect(checkInAvailable("mood", null)).toBe(true);
    expect(checkInAvailable("anxiety", "unknown")).toBe(true);
    expect(checkInAvailable("urinary", "male")).toBe(true);
    expect(checkInAvailable("urinary", "female")).toBe(false);
    expect(checkInAvailable("menopause", "male")).toBe(false);
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
    const r = { kind: "menu", menuKey: "sleep" } as const;
    expect(isFocusComplete(r, false, none)).toBe(false);
    expect(isFocusComplete(r, true, none)).toBe(false); // moodDone irrelevant
    expect(isFocusComplete(r, false, new Set<MenuKey>(["anxiety"]))).toBe(false);
    expect(isFocusComplete(r, false, new Set<MenuKey>(["sleep"]))).toBe(true);
  });

  it("none/unavailable never report complete", () => {
    expect(isFocusComplete({ kind: "none" }, true, new Set(["sleep"]))).toBe(false);
    expect(
      isFocusComplete({ kind: "unavailable" }, true, new Set(["sleep"])),
    ).toBe(false);
  });
});

describe("finishTarget", () => {
  it("onboarding → main tabs; focus mode → back", () => {
    expect(finishTarget(undefined)).toBe("main-tabs");
    expect(finishTarget("sleep")).toBe("back");
    expect(finishTarget("mood")).toBe("back");
  });
});
