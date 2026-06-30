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

  it("no 44px touch targets remain — the floor is 48", () => {
    const roots = [
      "src/screens",
      "src/onboarding",
      "src/components",
      "src/preventive",
      "src/backup/ui",
    ];
    const offenders: string[] = [];
    // Catches both `minHeight/minWidth: 44` AND a fixed `height: 44` (square
    // touch buttons set both w/h). A bare `width: 44` is NOT flagged — that's
    // the non-interactive itemBarTrack magnitude bar (height 6).
    const re = /(?:min(?:Height|Width)|height):\s*44\b/;
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) {
          walk(p);
        } else if (p.endsWith(".tsx") || p.endsWith(".ts")) {
          if (re.test(readFileSync(p, "utf8"))) offenders.push(p);
        }
      }
    };
    for (const r of roots) walk(join(process.cwd(), r));
    expect(
      offenders,
      `44px touch targets must be bumped to 48: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});
