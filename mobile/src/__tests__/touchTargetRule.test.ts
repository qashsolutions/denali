/**
 * local/touch-target-size — RuleTester pins (Phase 2).
 *
 * The enforcement layer for the A11Y-04 class: a NEW bare interactive text-link
 * touchable below the 48px floor must be CAUGHT at lint time (a numeric source
 * scan can't see a <Pressable> with no minHeight at all). These cases pin both
 * directions — what must flag, and the deliberate narrowings that must NOT
 * (cards, hitSlop targets, non-Text children, unresolvable styles, no onPress).
 */
import { RuleTester, type Rule } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { describe, it } from "vitest";

import ruleModule from "../../eslint-rules/touch-target-size.mjs";

// The .mjs module's inferred shape (e.g. meta.type: string) is structurally
// looser than ESLint's RuleModule; the rule is correct at runtime (it passes
// the cases below), so cast through unknown for the typed run() signature.
const rule = ruleModule as unknown as Rule.RuleModule;

// vitest runs with globals OFF, so hand RuleTester vitest's own describe/it.
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const flatLink = `const styles = StyleSheet.create({ link: { color: "#000", paddingVertical: 4 } });`;
const sizedStyle = `const styles = StyleSheet.create({ ok: { minHeight: 48 } });`;
const cardStyle = `const styles = StyleSheet.create({ card: { backgroundColor: "#fff", padding: 12 } });`;

ruleTester.run("touch-target-size", rule, {
  valid: [
    // Inline minHeight >= 48.
    `<Pressable onPress={f} style={{ minHeight: 48 }}><Text>x</Text></Pressable>;`,
    // In-file style ref with minHeight >= 48.
    `${sizedStyle} <Pressable onPress={f} style={styles.ok}><Text>x</Text></Pressable>;`,
    // Card surface (backgroundColor) — exempt.
    `${cardStyle} <Pressable onPress={f} style={styles.card}><Text>x</Text></Pressable>;`,
    // Bordered surface inline — exempt.
    `<Pressable onPress={f} style={{ borderWidth: 1 }}><Text>x</Text></Pressable>;`,
    // hitSlop extends the tap area — E2 exempt.
    `<Pressable onPress={f} hitSlop={8}><Text>x</Text></Pressable>;`,
    // Wraps a non-Text element — E1 skip (can't measure).
    `<Pressable onPress={f}><View><Text>x</Text></View></Pressable>;`,
    // No onPress — not interactive — E6 skip.
    `<Pressable><Text>x</Text></Pressable>;`,
    // Unresolvable style (imported ref) — E5 skip, never false-flag.
    `<Pressable onPress={f} style={imported}><Text>x</Text></Pressable>;`,
    // Array style with a conditional element — unresolvable — skip.
    `<Pressable onPress={f} style={[styles.flat, cond && extra]}><Text>x</Text></Pressable>;`,
    // Custom component (not an RN primitive) — E4 exempt by name.
    `<TouchTargetLink onPress={f} label="x" />;`,
  ],
  invalid: [
    // Bare flat Pressable wrapping Text — the recurring defect.
    {
      code: `<Pressable onPress={f}><Text>x</Text></Pressable>;`,
      errors: [{ messageId: "tooSmall" }],
    },
    // TouchableOpacity, same shape.
    {
      code: `<TouchableOpacity onPress={f}><Text>x</Text></TouchableOpacity>;`,
      errors: [{ messageId: "tooSmall" }],
    },
    // In-file flat style (no surface, no minHeight) — flagged.
    {
      code: `${flatLink} <Pressable onPress={f} style={styles.link}><Text>x</Text></Pressable>;`,
      errors: [{ messageId: "tooSmall" }],
    },
    // Inline flat style — flagged.
    {
      code: `<Pressable onPress={f} style={{ paddingVertical: 4 }}><Text>x</Text></Pressable>;`,
      errors: [{ messageId: "tooSmall" }],
    },
  ],
});
