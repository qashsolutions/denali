/**
 * Accessibility acceptance floor for the 45+ audience (D35, proposal principle 8).
 *
 *   - Body text ≥ 17px (Dynamic Type still respected — MAX_FONT_SCALE caps
 *     CHROME only, content scales).
 *   - Touch targets ≥ 48px — guard against re-introducing the old 44px floor.
 *
 * The touch-target check is a source scan: the 44px convention is gone, so any
 * `minHeight: 44` / `minWidth: 44` re-appearing fails here. (Genuinely small
 * non-interactive dimensions — bars, value columns — use other values and are
 * unaffected.)
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { tokens } from "../tokens";

describe("a11y acceptance — 45+ floor (principle 8)", () => {
  it("body base font is ≥ 17px", () => {
    expect(tokens.typography.sizes.base).toBeGreaterThanOrEqual(17);
  });

  it("no sub-48px touch targets remain — the floor is 48", () => {
    const roots = [
      "src/screens",
      "src/onboarding",
      "src/components",
      "src/preventive",
      "src/backup/ui",
    ];
    const offenders: string[] = [];
    // A11Y-04: broadened from the literal `44` to the whole INTERACTIVE-RANGE
    // sub-48 band. `minHeight`/`minWidth` in [24,47] reads as an undersized
    // touch target (44, 40, 36, …) and fails — not just the old 44px floor.
    // Values < 24 are decorative non-interactive dims (magnitude bars, dots,
    // the 14px chart marker) and are NOT flagged. A fixed `height: 44` is also
    // caught (square touch buttons set both w/h) but `height` is not range-
    // scanned to avoid flagging decorative fixed heights.
    //   NOTE: a bare interactive Pressable with NO minHeight at all (the
    //   original Resend-link defect) cannot be caught by a numeric source scan —
    //   that structural class is covered by the Maestro touch-target flow.
    const TOUCH_FLOOR = 48;
    const INTERACTIVE_MIN = 24;
    const minRe = /min(?:Height|Width):\s*(\d+)\b/g;
    const heightRe = /\bheight:\s*44\b/;
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) {
          walk(p);
        } else if (p.endsWith(".tsx") || p.endsWith(".ts")) {
          const src = readFileSync(p, "utf8");
          let m: RegExpExecArray | null;
          minRe.lastIndex = 0;
          while ((m = minRe.exec(src)) !== null) {
            const n = Number(m[1]);
            if (n >= INTERACTIVE_MIN && n < TOUCH_FLOOR) {
              offenders.push(`${p} (${m[0]})`);
            }
          }
          if (heightRe.test(src)) offenders.push(`${p} (height: 44)`);
        }
      }
    };
    for (const r of roots) walk(join(process.cwd(), r));
    expect(
      offenders,
      `sub-48px touch targets must be bumped to 48: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});
