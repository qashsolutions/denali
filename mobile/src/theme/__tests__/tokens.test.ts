/**
 * Token-drift test — redesign step 1.
 *
 * The mobile palette's source of truth is now the redesign mockup
 * (docs/design/denali-redesign-mockups.html, :root block) — "Alpine
 * clarity". This test parses the mockup's CSS custom properties and
 * asserts:
 *
 *   1. The `redesign` named vocabulary in src/theme/tokens.ts matches
 *      the mockup byte-for-byte (paper / surface / ink / ink-2 / ink-3 /
 *      line / line-2 / teal / teal-deep / teal-wash / blue / amber /
 *      amber-wash / sage-wash, plus the --r card radius).
 *   2. The light ThemeColors mapping resolves onto those values; the dark
 *      palette is the distinct Alpine-night variant (asserted below for
 *      key-set parity + WCAG-AA contrast on the clinical surfaces).
 *   3. Chat bubble colors are rethemed to the teal accent.
 *
 * Non-color tokens (brand purple, spacing intermediates) still mirror
 * the web's app/src/app/globals.css, asserted at the bottom.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { redesign, redesignDark, tokens } from "../tokens";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Repo root = four levels up from src/theme/__tests__ → mobile root, +1. */
const MOCKUP_HTML = resolve(
  __dirname,
  "../../../../docs/design/denali-redesign-mockups.html",
);
const GLOBALS_CSS = resolve(__dirname, "../../../../app/src/app/globals.css");

const mockup = readFileSync(MOCKUP_HTML, "utf8");
const css = readFileSync(GLOBALS_CSS, "utf8");

/** Relative luminance of a #rrggbb hex per WCAG 2.x. */
function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG contrast ratio between two #rrggbb hexes (1..21). */
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Extracts the body of the FIRST CSS block matching `selectorRegex` from
 * `source`. Single-level brace matching — these blocks hold only
 * `--var: value;` declarations.
 */
function extractBlock(source: string, selectorRegex: RegExp): string {
  const m = selectorRegex.exec(source);
  if (!m) {
    throw new Error(`Could not find CSS block matching ${selectorRegex}`);
  }
  const openIdx = source.indexOf("{", m.index + m[0].length - 1);
  if (openIdx < 0) throw new Error(`No opening brace after ${selectorRegex}`);
  const closeIdx = source.indexOf("}", openIdx + 1);
  if (closeIdx < 0) throw new Error(`No closing brace for ${selectorRegex}`);
  return source.slice(openIdx + 1, closeIdx);
}

/** Parses one custom property out of a block body (comments tolerated). */
function readVar(blockBody: string, name: string): string {
  const re = new RegExp(`--${name}\\s*:\\s*([^;]+);`);
  const m = re.exec(blockBody);
  if (!m) throw new Error(`Property --${name} not found in CSS block`);
  // Strip a trailing /* comment */ if the declaration carries one.
  return m[1].replace(/\/\*.*?\*\//g, "").trim();
}

const mockupRoot = extractBlock(mockup, /:root\s*\{/);

describe("redesign vocabulary — mirrors denali-redesign-mockups.html :root", () => {
  const expectations: ReadonlyArray<[keyof typeof redesign, string]> = [
    ["paper", "paper"],
    ["surface", "surface"],
    ["ink", "ink"],
    ["ink2", "ink-2"],
    ["ink3", "ink-3"],
    ["line", "line"],
    ["line2", "line-2"],
    ["teal", "teal"],
    ["tealDeep", "teal-deep"],
    ["tealWash", "teal-wash"],
    ["blue", "blue"],
    ["amber", "amber"],
    ["amberWash", "amber-wash"],
    ["sageWash", "sage-wash"],
  ];
  for (const [key, cssVar] of expectations) {
    it(`--${cssVar} matches redesign.${key}`, () => {
      expect(redesign[key]).toBe(readVar(mockupRoot, cssVar));
    });
  }

  it("--r (card radius, px) matches redesign.rCard", () => {
    expect(`${redesign.rCard}px`).toBe(readVar(mockupRoot, "r"));
  });
});

describe("alarm tokens — intentional additions beyond the mockup :root", () => {
  // The mockup defines no alarm state; alarm + alarm-wash are deliberate
  // extensions for severe screener bands and crisis-path UI only. These
  // assertions document that intent: the tokens MUST NOT appear in the
  // mockup (if a future mockup revision adds them, re-point these at it).
  it("--alarm is absent from the mockup :root", () => {
    expect(() => readVar(mockupRoot, "alarm")).toThrow();
  });
  it("--alarm-wash is absent from the mockup :root", () => {
    expect(() => readVar(mockupRoot, "alarm-wash")).toThrow();
  });
  it("alarm is the error red, darkened to clear WCAG AA on alarmWash", () => {
    // Was #C44536 (4.18:1 on alarmWash); darkened for the severe pill. Not a
    // mockup token, so pinned directly here rather than via the drift test.
    expect(redesign.alarm).toBe("#B53A2C");
  });
  it("alarmWash follows the *-wash construction (valid pale hex)", () => {
    expect(redesign.alarmWash).toMatch(/^#[0-9A-F]{6}$/i);
    // Pale tint: every RGB channel high, like the other washes.
    const channels = [1, 3, 5].map((i) =>
      Number.parseInt(redesign.alarmWash.slice(i, i + 2), 16),
    );
    for (const c of channels) expect(c).toBeGreaterThanOrEqual(0xc8);
  });
  it("ThemeColors.error resolves to the alarm token", () => {
    expect(tokens.colors.light.error).toBe(redesign.alarm);
  });
});

describe("ThemeColors mapping — resolves onto the redesign palette", () => {
  const mappings: ReadonlyArray<
    [keyof typeof tokens.colors.light, string]
  > = [
    ["bgPrimary", redesign.paper],
    ["bgSecondary", redesign.surface],
    ["bgTertiary", redesign.line2],
    ["textPrimary", redesign.ink],
    ["textSecondary", redesign.ink2],
    ["textMuted", redesign.ink3],
    // accentPrimary points at tealDeep (A11Y-01/02 — entry-screen CTA/link AA).
    ["accentPrimary", redesign.tealDeep],
    ["accentSecondary", redesign.tealDeep],
    ["border", redesign.line],
    ["success", redesign.teal],
    ["warning", redesign.amber],
  ];
  for (const [key, expected] of mappings) {
    it(`light.${key} carries the redesign value`, () => {
      expect(tokens.colors.light[key]).toBe(expected);
    });
  }

  it("dark palette is a DISTINCT appearance (no longer equal to light)", () => {
    expect(tokens.colors.dark).not.toEqual(tokens.colors.light);
    // ...and is genuinely dark: background darker than text (inverted).
    expect(luminance(tokens.colors.dark.bgPrimary)).toBeLessThan(
      luminance(tokens.colors.dark.textPrimary),
    );
  });

  it("accentSecondary is the contrast-safe teal for TEXT (teal-deep)", () => {
    expect(tokens.colors.light.accentSecondary).toBe(redesign.tealDeep);
  });
});

describe("Alpine-night dark palette — derived from the light vocabulary", () => {
  it("has the same key set as the light redesign vocabulary", () => {
    expect(Object.keys(redesignDark).sort()).toEqual(
      Object.keys(redesign).sort(),
    );
  });

  it("carries the light radii unchanged (appearance-independent)", () => {
    expect(redesignDark.rCard).toBe(redesign.rCard);
    expect(redesignDark.rChip).toBe(redesign.rChip);
  });

  it("maps dark ThemeColors onto the dark vocabulary (error → alarm, etc.)", () => {
    expect(tokens.colors.dark.bgPrimary).toBe(redesignDark.paper);
    expect(tokens.colors.dark.textPrimary).toBe(redesignDark.ink);
    expect(tokens.colors.dark.error).toBe(redesignDark.alarm);
    expect(tokens.colors.dark.warning).toBe(redesignDark.amber);
    expect(tokens.colors.dark.success).toBe(redesignDark.teal);
  });

  // Clinical-surface legibility: the disclaimer, every severity pill, the
  // crisis button, the trend-chart band labels, AND the primary CTA must clear
  // WCAG AA (4.5:1) in BOTH appearances. Light is the DEFAULT scheme, so a
  // light-only failure ships to most users — pre-fix, the light disclaimer was
  // 2.46:1, the watch pill 3.20:1 and the white-on-teal CTA 4.11:1, and this
  // dark-only matrix never caught them. Run the same matrix against each palette.
  const clinicalPairs = (
    p: typeof redesign | typeof redesignDark,
  ): ReadonlyArray<readonly [string, string, string]> => [
    ["disclaimer (ink3 on paper)", p.ink3, p.paper],
    ["body (ink on paper)", p.ink, p.paper],
    ["ok pill (tealDeep on tealWash)", p.tealDeep, p.tealWash],
    ["watch pill (amber on amberWash)", p.amber, p.amberWash],
    ["severe pill (alarm on alarmWash)", p.alarm, p.alarmWash],
    // Crisis-988 "Call 988" button: surface-colored label on the alarm fill.
    ["crisis 988 button (surface on alarm)", p.surface, p.alarm],
    // Primary CTA: white/surface label on the teal-deep button fill (the
    // bare-teal fill at 4.11:1 was the pre-fix failure).
    ["primary CTA (surface on tealDeep)", p.surface, p.tealDeep],
    // Trend-chart band labels (ink) on each severity band fill — a band label
    // unreadable on its fill could let "severe" read as "minimal".
    ["band label (ink on bandOk)", p.ink, p.bandOk],
    ["band label (ink on bandSoft)", p.ink, p.bandSoft],
    ["band label (ink on bandWatch)", p.ink, p.bandWatch],
    ["band label (ink on bandAlarm)", p.ink, p.bandAlarm],
  ];
  for (const [mode, palette] of [
    ["light", redesign],
    ["dark", redesignDark],
  ] as const) {
    for (const [name, fg, bg] of clinicalPairs(palette)) {
      it(`${mode}: ${name} clears WCAG AA (>= 4.5:1)`, () => {
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("keeps the three severity washes distinct (no two identical)", () => {
    const washes = [
      redesignDark.sageWash,
      redesignDark.amberWash,
      redesignDark.alarmWash,
    ];
    expect(new Set(washes).size).toBe(3);
  });

  it("keeps the four trend-chart band fills distinct (light + dark)", () => {
    const light = [redesign.bandOk, redesign.bandSoft, redesign.bandWatch, redesign.bandAlarm];
    const dark = [redesignDark.bandOk, redesignDark.bandSoft, redesignDark.bandWatch, redesignDark.bandAlarm];
    expect(new Set(light).size).toBe(4);
    expect(new Set(dark).size).toBe(4);
  });
});

describe("chat colors — rethemed to the teal accent", () => {
  it("user bubble gradient runs teal → teal-deep", () => {
    expect(tokens.colors.chat.light.userBubbleFrom).toBe(redesign.teal);
    expect(tokens.colors.chat.light.userBubbleTo).toBe(redesign.tealDeep);
  });
  it("assistant bubble sits on the card surface", () => {
    expect(tokens.colors.chat.light.assistantBubble).toBe(redesign.surface);
  });
  it("dark chat uses the dark teal vocabulary", () => {
    expect(tokens.colors.chat.dark.userBubbleFrom).toBe(redesignDark.teal);
    expect(tokens.colors.chat.dark.userBubbleTo).toBe(redesignDark.tealDeep);
    expect(tokens.colors.chat.dark.assistantBubble).toBe(redesignDark.surface);
  });
});

describe("typography roles — one face per role, expo-font registration keys", () => {
  it("body (sans) is Inter", () => {
    expect(tokens.typography.fonts.sans).toBe("Inter-Regular");
  });
  it("display (serif slot) is Bricolage Grotesque", () => {
    expect(tokens.typography.fonts.serif).toBe("Bricolage-SemiBold");
  });
  it("numbers (mono slot) is Inter Tight", () => {
    expect(tokens.typography.fonts.mono).toBe("InterTight-SemiBold");
  });
});

/**
 * Non-color tokens still mirror the web's globals.css (first :root block:
 * fonts, --brand-purple, --space-*, --radius-*).
 */
const webRoot = extractBlock(css, /:root\s*\{/);

function remToPx(value: string): number {
  const m = /^([\d.]+)rem$/.exec(value.trim());
  if (!m) throw new Error(`Expected a "<n>rem" value, got "${value}"`);
  return Number.parseFloat(m[1]) * 16;
}

describe("non-color tokens — still mirror app/src/app/globals.css", () => {
  it("--brand-purple matches", () => {
    expect(tokens.colors.brand.purple).toBe(readVar(webRoot, "brand-purple"));
  });
  it("--space-3 (0.75rem = 12px) matches tokens.spacing.space3", () => {
    expect(tokens.spacing.space3).toBe(remToPx(readVar(webRoot, "space-3")));
  });
  it("--space-5 (1.25rem = 20px) matches tokens.spacing.space5", () => {
    expect(tokens.spacing.space5).toBe(remToPx(readVar(webRoot, "space-5")));
  });
});
