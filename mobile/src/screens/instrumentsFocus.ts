/**
 * Instruments focus mode — pure helpers (Step 4).
 *
 * The Instruments screen is reused for repeat check-ins via an optional
 * `focus?: DomainId` route param. ALL focus decisions live here as pure
 * functions over explicit args (mobile/CLAUDE.md stale-closure rule);
 * the screen only executes the verdicts.
 *
 * Reviewer guards (clinical-boundary pre-review, Step-4 plan):
 *   G1 — focus "mood" enters the FULL existing PHQ-2→PHQ-9 path
 *        (phqStep 0, moodDone false); resolveFocus only routes, it never
 *        provides a shortcut past the item-9 / 988 wiring.
 *   G2 — a focus naming a sex-gated instrument the user's sex_at_birth
 *        doesn't permit resolves to "unavailable" (screen goBack()s) —
 *        never a blank render, never the gated instrument.
 *   G3 — completion is signalled by post-persist state only (moodDone /
 *        doneKeys), decided by isFocusComplete below; goBack cannot fire
 *        before the persist resolved.
 */

import type { SexAtBirth } from "@/contracts";

import type { DomainId } from "./timeline/domains/registry";

/** Menu-section keys — shared with InstrumentsScreen's menu composition. */
export type MenuKey =
  | "anxiety"
  | "alcohol"
  | "sleep"
  | "urinary"
  | "hormonalFemale"
  | "hormonalMale";

export type FocusResolution =
  /** No focus param — onboarding behavior, byte-identical. */
  | { kind: "none" }
  /** The full mood path (PHQ-2 → optional PHQ-9 → item-9/988). */
  | { kind: "mood" }
  /** Exactly one menu instrument. */
  | { kind: "menu"; menuKey: MenuKey }
  /** Domain has no instrument for this user — screen must goBack(). */
  | { kind: "unavailable" };

/**
 * Resolve a focus param against the user's cohort. Sex-gated domains
 * (urinary/IPSS male, menopause/MRS female, hormonal/ADAM male) resolve
 * to "unavailable" on any mismatch INCLUDING unknown/intersex/null —
 * the same strictness as `instrumentsFor`.
 */
export function resolveFocus(
  focus: DomainId | undefined,
  sexAtBirth: SexAtBirth | null,
): FocusResolution {
  if (focus == null) return { kind: "none" };
  switch (focus) {
    case "mood":
      return { kind: "mood" };
    case "anxiety":
      return { kind: "menu", menuKey: "anxiety" };
    case "alcohol":
      return { kind: "menu", menuKey: "alcohol" };
    case "sleep":
      return { kind: "menu", menuKey: "sleep" };
    case "urinary":
      return sexAtBirth === "male"
        ? { kind: "menu", menuKey: "urinary" }
        : { kind: "unavailable" };
    case "menopause":
      return sexAtBirth === "female"
        ? { kind: "menu", menuKey: "hormonalFemale" }
        : { kind: "unavailable" };
    case "hormonal":
      return sexAtBirth === "male"
        ? { kind: "menu", menuKey: "hormonalMale" }
        : { kind: "unavailable" };
    // Umbrella domains carry no instrument.
    case "health_markers":
    case "health_history":
      return { kind: "unavailable" };
  }
}

/**
 * Should the domain detail surface a "Start a check-in" CTA? True only
 * when the focus would resolve to a runnable check-in for this user.
 */
export function checkInAvailable(
  domainId: DomainId,
  sexAtBirth: SexAtBirth | null,
): boolean {
  const r = resolveFocus(domainId, sexAtBirth);
  return r.kind === "mood" || r.kind === "menu";
}

/**
 * G3 — focus completion, decided ONLY from post-persist signals:
 * `moodDone` flips after the mood persist resolves; `doneKeys` gains
 * the key inside finishMenuItem AFTER persistInstrument resolved.
 */
export function isFocusComplete(
  resolution: FocusResolution,
  moodDone: boolean,
  doneKeys: ReadonlySet<MenuKey>,
): boolean {
  if (resolution.kind === "mood") return moodDone;
  if (resolution.kind === "menu") return doneKeys.has(resolution.menuKey);
  return false;
}

/** Where "finished" goes: onboarding → MainTabs; focus mode → back. */
export function finishTarget(
  focus: DomainId | undefined,
): "main-tabs" | "back" {
  return focus == null ? "main-tabs" : "back";
}
