/**
 * crisisDetection tests — recall on clear ideation, no false-fire on idioms.
 *
 * NOTE on fixtures: the "must detect" phrases are assembled from word
 * fragments at runtime (`.join(" ")`) rather than written as literal
 * sentences, and the tests use index-based names. This keeps the source and
 * the test output free of complete explicit self-harm phrases while still
 * exercising the real detector. This adversarial corpus is the durable,
 * privacy-safe way to tune the detector — extend it (and re-run the
 * clinical-boundary review) rather than ever logging real user messages.
 */

import { describe, expect, it } from "vitest";

import { detectCrisisLanguage } from "../crisisDetection";

// Each entry joins to a phrase the detector MUST flag.
const MUST_DETECT: string[] = [
  ["kill", "myself"],
  ["i", "want", "to", "die"],
  ["i", "wanna", "die"],
  ["end", "my", "life"],
  ["ending", "it", "all"],
  ["take", "my", "own", "life"],
  ["i", "would", "be", "better", "off", "dead"],
  ["i", "wish", "i", "was", "dead"],
  ["there", "is", "no", "reason", "to", "live"],
  ["nothing", "to", "live", "for"],
  ["i", "dont", "want", "to", "be", "here"],
  ["i", "have", "thoughts", "of", "suicide"],
  ["i", "feel", "suicidal"],
  ["i", "want", "to", "hurt", "myself"],
  ["ive", "been", "cutting", "myself"],
  ["self-harm"],
  // 2026-06-11 clinical-review recall expansion:
  ["ready", "to", "die"],
  ["im", "tired", "of", "living"],
  ["i", "cant", "go", "on", "living"],
  ["i", "dont", "want", "to", "exist"],
  ["no", "reason", "to", "be", "alive"],
  ["im", "going", "to", "overdose"],
  ["i", "cant", "go", "on", "anymore"],
].map((parts) => parts.join(" "));

// Idioms / benign inputs that MUST NOT fire (written as plain literals —
// none are sensitive).
const MUST_NOT_DETECT: string[] = [
  "I'm dying to know the results",
  "this commute is killing me",
  "my back is killing me",
  "I'm dead tired today",
  "I could kill for a nap",
  "the deadline is brutal this week",
  "the suicide prevention hotline helped my friend",
  "what does my A1C of 6.1 mean?",
  "how do I lower my blood pressure?",
  // Precision guards for the 2026-06-11 expansion:
  "what is the overdose risk of metformin?",
  "did I take all my pills today?",
  "I can't go on with this project at work",
  "I'm so tired of work lately",
  "",
];

describe("detectCrisisLanguage — recall (must flag)", () => {
  MUST_DETECT.forEach((phrase, i) => {
    it(`flags ideation case ${i + 1}`, () => {
      expect(detectCrisisLanguage(phrase)).toBe(true);
    });
  });
});

describe("detectCrisisLanguage — precision (must not flag)", () => {
  MUST_NOT_DETECT.forEach((phrase, i) => {
    it(`leaves benign/idiom case ${i + 1} alone`, () => {
      expect(detectCrisisLanguage(phrase)).toBe(false);
    });
  });
});

describe("detectCrisisLanguage — robustness", () => {
  it("is case-insensitive", () => {
    expect(detectCrisisLanguage(["KILL", "MYSELF"].join(" "))).toBe(true);
  });

  it("detects within a longer message", () => {
    const embedded = ["i", "dont", "want", "to", "be", "here"].join(" ");
    expect(
      detectCrisisLanguage(`been a rough week and honestly ${embedded} anymore`),
    ).toBe(true);
  });
});
