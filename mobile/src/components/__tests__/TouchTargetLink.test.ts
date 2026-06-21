/**
 * TouchTargetLink — size guarantee + the "every link site uses it" regression.
 *
 * The project has no render-test layer (vitest is node-only, by convention), so
 * the ≥48px guarantee is proven STRUCTURALLY via the pure `touchTargetBaseStyle`
 * helper (test a), and the "no site re-inlines a bare Pressable" invariant is
 * proven by a source scan (test b). Together they stop the recurrence the
 * reviewer caught: a screen-local 48px style that the next new link forgets.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  TOUCH_TARGET_MIN,
  TOUCH_TARGET_HITSLOP,
  touchTargetBaseStyle,
} from "../touchTarget";

describe("touchTargetBaseStyle — ≥48 in BOTH dimensions (a)", () => {
  it("the floor constant is 48 (the D35 45+ target)", () => {
    expect(TOUCH_TARGET_MIN).toBe(48);
  });

  it("resolves an effective ≥48px box in height AND width", () => {
    const s = touchTargetBaseStyle();
    expect(s.minHeight).toBeGreaterThanOrEqual(48);
    expect(s.minWidth).toBeGreaterThanOrEqual(48);
    // Content centered so a short label sits in the middle of the ≥48 box.
    expect(s.justifyContent).toBe("center");
    expect(s.alignItems).toBe("center");
  });

  it("adds a defense-in-depth hitSlop ON TOP of the ≥48 box", () => {
    // The box alone already meets the floor; hitSlop only widens it further.
    expect(TOUCH_TARGET_HITSLOP.top).toBeGreaterThan(0);
    expect(TOUCH_TARGET_HITSLOP.bottom).toBeGreaterThan(0);
    expect(TOUCH_TARGET_HITSLOP.left).toBeGreaterThan(0);
    expect(TOUCH_TARGET_HITSLOP.right).toBeGreaterThan(0);
  });
});

/** Last JSX opening tag (`<Tag`) before the first occurrence of `needle`. */
function nearestTagBefore(src: string, needle: string): string | null {
  const idx = src.indexOf(needle);
  if (idx === -1) return null;
  const before = src.slice(0, idx);
  const tags = [...before.matchAll(/<([A-Za-z][A-Za-z0-9_]*)/g)];
  return tags.length > 0 ? tags[tags.length - 1]![1]! : null;
}

// Every secondary-link site → its link testID(s). The nearest JSX tag before
// each testID must be TouchTargetLink. Re-inlining a raw <Pressable testID="…">
// flips the nearest tag and fails here.
const LINK_SITES: ReadonlyArray<[string, ReadonlyArray<string>]> = [
  [
    "src/screens/SignInScreen.tsx",
    ['testID="signin_resend_code_button"', 'testID="signin_use_different_email_button"'],
  ],
  ["src/screens/LockScreen.tsx", ['testID="lock_signout_button"']],
  ["src/screens/SettingsScreen.tsx", ['testID="settings_consent_retry"']],
  ["src/screens/ReportDetailScreen.tsx", ['testID="report_detail_rename"']],
];

describe("every secondary-link site renders via TouchTargetLink (b)", () => {
  for (const [file, testIDs] of LINK_SITES) {
    const src = readFileSync(join(process.cwd(), file), "utf8");

    it(`${file} imports TouchTargetLink`, () => {
      expect(src).toContain("TouchTargetLink");
      expect(src).toMatch(/from "@\/components\/TouchTargetLink"/);
    });

    for (const id of testIDs) {
      it(`${file} ${id} is a TouchTargetLink, not a bare Pressable`, () => {
        expect(src).toContain(id);
        expect(nearestTagBefore(src, id)).toBe("TouchTargetLink");
      });
    }
  }
});
