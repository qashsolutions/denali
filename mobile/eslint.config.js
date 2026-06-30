/**
 * ESLint v9 flat config — Phase-1 mobile.
 *
 * LEAN by design: high-signal rules only, no @typescript-eslint/recommended.
 * The point is to catch the bug CLASSES we've already hit at runtime (stale
 * closures from auto-advance handlers, ad-hoc emoji decorations in source),
 * not to start a months-long lint-cleanup loop.
 *
 * What this config enforces:
 *
 *   ERROR  react-hooks/rules-of-hooks
 *   ERROR  react-hooks/exhaustive-deps
 *   ERROR  eslint-comments/no-restricted-disable for the above two rules
 *          — disabling them is what HID the cohort onboarding dead-end
 *          (`eslint-disable-next-line react-hooks/exhaustive-deps` over a
 *          callback with `[]` deps closing over null state). Forbid it.
 *   ERROR  local/no-emoji — no emoji / pictographic chars in source code.
 *
 *   WARN   max-lines-per-function (80) — flags refactor candidates;
 *          informational, doesn't fail CI.
 *   WARN   complexity (12) — same.
 *
 * What's deliberately NOT enabled (separate budgeted follow-up):
 *
 *   - @typescript-eslint/recommended (broad cleanup needed).
 *   - Type-aware rules including no-floating-promises (would have caught
 *     the un-awaited Promise.resolve().then() patterns in the persist
 *     paths — high-value follow-up).
 *
 * The CI workflow at `.github/workflows/mobile-ci.yml` runs this as one
 * of three gates (tsc → eslint → vitest).
 */

// @ts-check
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import reactHooks from "eslint-plugin-react-hooks";
import tsParser from "@typescript-eslint/parser";

/**
 * Inline custom rule: forbid emoji / pictographic characters in source.
 *
 * Using `\p{Extended_Pictographic}` — broad enough to catch the common
 * decorative-emoji cases (🚀, 🎉, ✨) and Unicode arrows / symbols
 * occasionally used in comments. Production code should communicate via
 * plain language; designers want a single typographic voice.
 *
 * Implemented as a tiny inline plugin to avoid pulling in a third-party
 * dep for ~30 lines of logic.
 */
const noEmojiRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Forbid emoji and other pictographic characters in source.",
    },
    schema: [],
    messages: {
      foundEmoji:
        'Emoji or pictographic character forbidden in source: "{{ char }}" (U+{{ codepoint }}). Use plain ASCII.',
    },
  },
  create(context) {
    return {
      Program(node) {
        const text = context.sourceCode.getText();
        const re = /\p{Extended_Pictographic}/gu;
        let m;
        while ((m = re.exec(text)) !== null) {
          const loc = context.sourceCode.getLocFromIndex(m.index);
          context.report({
            node,
            loc: {
              start: loc,
              end: { line: loc.line, column: loc.column + m[0].length },
            },
            messageId: "foundEmoji",
            data: {
              char: m[0],
              codepoint: m[0].codePointAt(0).toString(16).toUpperCase().padStart(4, "0"),
            },
          });
        }
      },
    };
  },
};

const localPlugin = {
  rules: { "no-emoji": noEmojiRule },
};

export default [
  // Ignores (replaces .eslintignore in flat config).
  {
    ignores: [
      "node_modules/**",
      "android/**", // Expo prebuild artifacts — not authored.
      "ios/**", //     "        "        "
      ".expo/**",
      "**/*.js.map",
      "test/stubs/**", // Hand-written Node-CSPRNG stub; no React, no lint.
    ],
  },

  // TypeScript source — production + tests + entry + config files.
  {
    files: [
      "src/**/*.ts",
      "src/**/*.tsx",
      "App.tsx",
      "*.config.ts",
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "eslint-comments": eslintComments,
      local: localPlugin,
    },
    rules: {
      // Hooks correctness — the closure-class bug we just paid for.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",

      // Disabling the two rules above is exactly what hid the original
      // dead-end. Forbid it at the comment layer.
      "eslint-comments/no-restricted-disable": [
        "error",
        "react-hooks/exhaustive-deps",
        "react-hooks/rules-of-hooks",
      ],

      // No emoji in source.
      "local/no-emoji": "error",

      // Soft refactor candidates — warnings, not errors.
      "max-lines-per-function": [
        "warn",
        { max: 80, skipBlankLines: true, skipComments: true, IIFEs: false },
      ],
      complexity: ["warn", { max: 12 }],
    },
  },
];
