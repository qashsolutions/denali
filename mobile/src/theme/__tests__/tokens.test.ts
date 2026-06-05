/**
 * Token-drift test — Phase 1 mobile theme.
 *
 * Reads app/src/app/globals.css (the web's source of truth) and asserts
 * the mobile palette in src/theme/tokens.ts still mirrors the web's
 * --bg-primary / --text-primary / --accent-primary / --success / --warning
 * / --error values for both light and dark — plus, post Wave-1 amendment,
 * --bg-tertiary, the chat-bubble triplet, the five condition accent
 * families (--auth-blue / --check-teal / --appeal-coral / --health-red /
 * --diabetes-violet — each {base, light, bg}), --brand-purple, and the
 * --space-3 / --space-5 intermediate gaps.
 *
 * If a future web change drifts the palette, this test catches it and
 * fails the wave's CI. Re-run after every web globals.css edit.
 *
 * globals.css block map (verified 2026-06-04):
 *   • Lines   8-39   :root              → non-color tokens
 *                                         (fonts, --brand-purple, --space-*, radii)
 *   • Lines  45-93   :root              → DARK palette (web default)
 *   • Lines  99-147  [data-theme="dark"]  → DARK explicit (duplicate)
 *   • Lines 153-201  [data-theme="light"] → LIGHT palette
 *
 * We parse the explicit `[data-theme="dark"]` and `[data-theme="light"]`
 * blocks because they are the unambiguous, named sources for color tokens.
 * The first `:root` block (non-color tokens) is parsed for --brand-purple
 * and the spacing scale.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { tokens } from "../tokens";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Mobile root = three levels up from this file
 * (src/theme/__tests__/tokens.test.ts → mobile root). The web globals.css
 * lives at ../../app/src/app/globals.css relative to the mobile root.
 */
const GLOBALS_CSS = resolve(
  __dirname,
  "../../../../app/src/app/globals.css",
);

const css = readFileSync(GLOBALS_CSS, "utf8");

/**
 * Extracts the body of a CSS block whose selector matches `selectorRegex`.
 * Returns just the `{ ... }` interior text (without the braces) for the
 * FIRST match. Throws if not found.
 */
function extractBlock(selectorRegex: RegExp): string {
  const m = selectorRegex.exec(css);
  if (!m) {
    throw new Error(
      `Could not find CSS block matching ${selectorRegex} in globals.css`,
    );
  }
  // Start scanning from the end of the selector match for the opening `{`.
  const openIdx = css.indexOf("{", m.index + m[0].length - 1);
  if (openIdx < 0) {
    throw new Error(
      `No opening brace after selector ${selectorRegex} in globals.css`,
    );
  }
  // Naive single-level brace matching is sufficient: these blocks contain
  // only `--var: value;` declarations, no nested rules.
  const closeIdx = css.indexOf("}", openIdx + 1);
  if (closeIdx < 0) {
    throw new Error(
      `No closing brace for selector ${selectorRegex} in globals.css`,
    );
  }
  return css.slice(openIdx + 1, closeIdx);
}

/**
 * Parses a single CSS custom-property value out of a block body.
 * Returns the trimmed value or throws if the property is absent.
 */
function readVar(blockBody: string, name: string): string {
  const re = new RegExp(`--${name}\\s*:\\s*([^;]+);`);
  const m = re.exec(blockBody);
  if (!m) {
    throw new Error(`Property --${name} not found in CSS block`);
  }
  return m[1].trim();
}

const darkBlock = extractBlock(/\[data-theme="dark"\]\s*\{/);
const lightBlock = extractBlock(/\[data-theme="light"\]\s*\{/);
/**
 * First `:root` block — the non-color tokens at globals.css lines 8-39
 * (fonts, --brand-purple, --space-*, --radius-*). `extractBlock` returns
 * the FIRST regex match, so the `:root` block at line 45 (dark palette)
 * is not consulted here.
 */
const rootBlock = extractBlock(/:root\s*\{/);

/**
 * Parses a CSS rem value (e.g. "0.75rem") into a pixel number, using the
 * web baseline of 1rem = 16px. The mobile tokens store the px equivalent
 * directly (see tokens.spacing comments), so we convert at the assertion
 * boundary instead of round-tripping the rem string.
 */
function remToPx(value: string): number {
  const m = /^([\d.]+)rem$/.exec(value.trim());
  if (!m) {
    throw new Error(`Expected a "<n>rem" value, got "${value}"`);
  }
  return Number.parseFloat(m[1]) * 16;
}

describe("tokens — mirror app/src/app/globals.css exactly", () => {
  describe("light palette ([data-theme=\"light\"])", () => {
    it("--bg-primary matches", () => {
      expect(tokens.colors.light.bgPrimary).toBe(readVar(lightBlock, "bg-primary"));
    });
    it("--bg-secondary matches", () => {
      expect(tokens.colors.light.bgSecondary).toBe(readVar(lightBlock, "bg-secondary"));
    });
    it("--bg-tertiary matches", () => {
      expect(tokens.colors.light.bgTertiary).toBe(readVar(lightBlock, "bg-tertiary"));
    });
    it("--text-primary matches", () => {
      expect(tokens.colors.light.textPrimary).toBe(readVar(lightBlock, "text-primary"));
    });
    it("--text-secondary matches", () => {
      expect(tokens.colors.light.textSecondary).toBe(readVar(lightBlock, "text-secondary"));
    });
    it("--text-muted matches", () => {
      expect(tokens.colors.light.textMuted).toBe(readVar(lightBlock, "text-muted"));
    });
    it("--accent-primary matches", () => {
      expect(tokens.colors.light.accentPrimary).toBe(readVar(lightBlock, "accent-primary"));
    });
    it("--accent-secondary matches", () => {
      expect(tokens.colors.light.accentSecondary).toBe(readVar(lightBlock, "accent-secondary"));
    });
    it("--border matches", () => {
      expect(tokens.colors.light.border).toBe(readVar(lightBlock, "border"));
    });
    it("--success matches", () => {
      expect(tokens.colors.light.success).toBe(readVar(lightBlock, "success"));
    });
    it("--warning matches", () => {
      expect(tokens.colors.light.warning).toBe(readVar(lightBlock, "warning"));
    });
    it("--error matches", () => {
      expect(tokens.colors.light.error).toBe(readVar(lightBlock, "error"));
    });
  });

  describe("dark palette ([data-theme=\"dark\"])", () => {
    it("--bg-primary matches", () => {
      expect(tokens.colors.dark.bgPrimary).toBe(readVar(darkBlock, "bg-primary"));
    });
    it("--bg-secondary matches", () => {
      expect(tokens.colors.dark.bgSecondary).toBe(readVar(darkBlock, "bg-secondary"));
    });
    it("--bg-tertiary matches", () => {
      expect(tokens.colors.dark.bgTertiary).toBe(readVar(darkBlock, "bg-tertiary"));
    });
    it("--text-primary matches", () => {
      expect(tokens.colors.dark.textPrimary).toBe(readVar(darkBlock, "text-primary"));
    });
    it("--text-secondary matches", () => {
      expect(tokens.colors.dark.textSecondary).toBe(readVar(darkBlock, "text-secondary"));
    });
    it("--text-muted matches", () => {
      expect(tokens.colors.dark.textMuted).toBe(readVar(darkBlock, "text-muted"));
    });
    it("--accent-primary matches", () => {
      expect(tokens.colors.dark.accentPrimary).toBe(readVar(darkBlock, "accent-primary"));
    });
    it("--accent-secondary matches", () => {
      expect(tokens.colors.dark.accentSecondary).toBe(readVar(darkBlock, "accent-secondary"));
    });
    it("--border matches", () => {
      expect(tokens.colors.dark.border).toBe(readVar(darkBlock, "border"));
    });
    it("--success matches", () => {
      expect(tokens.colors.dark.success).toBe(readVar(darkBlock, "success"));
    });
    it("--warning matches", () => {
      expect(tokens.colors.dark.warning).toBe(readVar(darkBlock, "warning"));
    });
    it("--error matches", () => {
      expect(tokens.colors.dark.error).toBe(readVar(darkBlock, "error"));
    });
  });

  describe("chat colors ([data-theme=\"light\"])", () => {
    it("--user-bubble-from matches", () => {
      expect(tokens.colors.chat.light.userBubbleFrom).toBe(
        readVar(lightBlock, "user-bubble-from"),
      );
    });
    it("--user-bubble-to matches", () => {
      expect(tokens.colors.chat.light.userBubbleTo).toBe(
        readVar(lightBlock, "user-bubble-to"),
      );
    });
    it("--assistant-bubble matches", () => {
      expect(tokens.colors.chat.light.assistantBubble).toBe(
        readVar(lightBlock, "assistant-bubble"),
      );
    });
  });

  describe("chat colors ([data-theme=\"dark\"])", () => {
    it("--user-bubble-from matches", () => {
      expect(tokens.colors.chat.dark.userBubbleFrom).toBe(
        readVar(darkBlock, "user-bubble-from"),
      );
    });
    it("--user-bubble-to matches", () => {
      expect(tokens.colors.chat.dark.userBubbleTo).toBe(
        readVar(darkBlock, "user-bubble-to"),
      );
    });
    it("--assistant-bubble matches", () => {
      expect(tokens.colors.chat.dark.assistantBubble).toBe(
        readVar(darkBlock, "assistant-bubble"),
      );
    });
  });

  describe("condition accents ([data-theme=\"light\"])", () => {
    it("--auth-blue family matches", () => {
      expect(tokens.colors.conditions.light.authBlue.base).toBe(readVar(lightBlock, "auth-blue"));
      expect(tokens.colors.conditions.light.authBlue.light).toBe(readVar(lightBlock, "auth-blue-light"));
      expect(tokens.colors.conditions.light.authBlue.bg).toBe(readVar(lightBlock, "auth-blue-bg"));
    });
    it("--check-teal family matches", () => {
      expect(tokens.colors.conditions.light.checkTeal.base).toBe(readVar(lightBlock, "check-teal"));
      expect(tokens.colors.conditions.light.checkTeal.light).toBe(readVar(lightBlock, "check-teal-light"));
      expect(tokens.colors.conditions.light.checkTeal.bg).toBe(readVar(lightBlock, "check-teal-bg"));
    });
    it("--appeal-coral family matches", () => {
      expect(tokens.colors.conditions.light.appealCoral.base).toBe(readVar(lightBlock, "appeal-coral"));
      expect(tokens.colors.conditions.light.appealCoral.light).toBe(readVar(lightBlock, "appeal-coral-light"));
      expect(tokens.colors.conditions.light.appealCoral.bg).toBe(readVar(lightBlock, "appeal-coral-bg"));
    });
    it("--health-red family matches", () => {
      expect(tokens.colors.conditions.light.healthRed.base).toBe(readVar(lightBlock, "health-red"));
      expect(tokens.colors.conditions.light.healthRed.light).toBe(readVar(lightBlock, "health-red-light"));
      expect(tokens.colors.conditions.light.healthRed.bg).toBe(readVar(lightBlock, "health-red-bg"));
    });
    it("--diabetes-violet family matches", () => {
      expect(tokens.colors.conditions.light.diabetesViolet.base).toBe(readVar(lightBlock, "diabetes-violet"));
      expect(tokens.colors.conditions.light.diabetesViolet.light).toBe(readVar(lightBlock, "diabetes-violet-light"));
      expect(tokens.colors.conditions.light.diabetesViolet.bg).toBe(readVar(lightBlock, "diabetes-violet-bg"));
    });
  });

  describe("condition accents ([data-theme=\"dark\"])", () => {
    it("--auth-blue family matches", () => {
      expect(tokens.colors.conditions.dark.authBlue.base).toBe(readVar(darkBlock, "auth-blue"));
      expect(tokens.colors.conditions.dark.authBlue.light).toBe(readVar(darkBlock, "auth-blue-light"));
      expect(tokens.colors.conditions.dark.authBlue.bg).toBe(readVar(darkBlock, "auth-blue-bg"));
    });
    it("--check-teal family matches", () => {
      expect(tokens.colors.conditions.dark.checkTeal.base).toBe(readVar(darkBlock, "check-teal"));
      expect(tokens.colors.conditions.dark.checkTeal.light).toBe(readVar(darkBlock, "check-teal-light"));
      expect(tokens.colors.conditions.dark.checkTeal.bg).toBe(readVar(darkBlock, "check-teal-bg"));
    });
    it("--appeal-coral family matches", () => {
      expect(tokens.colors.conditions.dark.appealCoral.base).toBe(readVar(darkBlock, "appeal-coral"));
      expect(tokens.colors.conditions.dark.appealCoral.light).toBe(readVar(darkBlock, "appeal-coral-light"));
      expect(tokens.colors.conditions.dark.appealCoral.bg).toBe(readVar(darkBlock, "appeal-coral-bg"));
    });
    it("--health-red family matches", () => {
      expect(tokens.colors.conditions.dark.healthRed.base).toBe(readVar(darkBlock, "health-red"));
      expect(tokens.colors.conditions.dark.healthRed.light).toBe(readVar(darkBlock, "health-red-light"));
      expect(tokens.colors.conditions.dark.healthRed.bg).toBe(readVar(darkBlock, "health-red-bg"));
    });
    it("--diabetes-violet family matches", () => {
      expect(tokens.colors.conditions.dark.diabetesViolet.base).toBe(readVar(darkBlock, "diabetes-violet"));
      expect(tokens.colors.conditions.dark.diabetesViolet.light).toBe(readVar(darkBlock, "diabetes-violet-light"));
      expect(tokens.colors.conditions.dark.diabetesViolet.bg).toBe(readVar(darkBlock, "diabetes-violet-bg"));
    });
  });

  describe("brand (mode-agnostic, :root)", () => {
    it("--brand-purple matches", () => {
      expect(tokens.colors.brand.purple).toBe(readVar(rootBlock, "brand-purple"));
    });
  });

  describe("spacing intermediates (:root)", () => {
    it("--space-3 (0.75rem = 12px) matches tokens.spacing.space3", () => {
      expect(tokens.spacing.space3).toBe(remToPx(readVar(rootBlock, "space-3")));
    });
    it("--space-5 (1.25rem = 20px) matches tokens.spacing.space5", () => {
      expect(tokens.spacing.space5).toBe(remToPx(readVar(rootBlock, "space-5")));
    });
  });
});
