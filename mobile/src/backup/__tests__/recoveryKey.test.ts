/**
 * Recovery key (BIP39) — generation, rendering, round-trip, validation.
 * Real @scure/bip39 (pure JS) runs in vitest exactly as in Hermes.
 */

import { randomBytes as nodeRandomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { type RandomBytes } from "../cryptoProvider";
import {
  generateRecoveryKey,
  InvalidRecoveryPhraseError,
  isValidRecoveryPhrase,
  normalizeRecoveryPhrase,
  phraseToRecoveryKey,
  recoveryKeyToPhrase,
} from "../recoveryKey";

const rng: RandomBytes = (n) => new Uint8Array(nodeRandomBytes(n));
const hex = (u8: Uint8Array) => Buffer.from(u8).toString("hex");

describe("recovery key generation + rendering", () => {
  it("generates a 256-bit (32-byte) key", () => {
    expect(generateRecoveryKey(rng).length).toBe(32);
  });

  it("renders a 24-word BIP39 phrase", () => {
    const phrase = recoveryKeyToPhrase(generateRecoveryKey(rng));
    expect(phrase.split(" ")).toHaveLength(24);
  });

  it("round-trips key -> phrase -> key", () => {
    const rk = generateRecoveryKey(rng);
    expect(hex(phraseToRecoveryKey(recoveryKeyToPhrase(rk)))).toBe(hex(rk));
  });
});

describe("phrase validation (fails closed)", () => {
  // FIXED known-answer vectors (official BIP39 / Trezor test vectors) instead of
  // a random phrase. A randomly generated `validPhrase` made the last-word-swap
  // checksum test flaky: swapping the final word of a 24-word phrase changes 3
  // entropy bits but only an 8-bit checksum, so ~1 in 256 random phrases survive
  // the swap with a still-valid checksum and the "expect false" assertion fails.
  // Deterministic vectors remove the non-determinism without weakening intent —
  // the production checksum logic is correct; only the test's input was random.
  //
  // 32 bytes of 0xff -> the canonical "zoo … vote" mnemonic (last word "vote").
  const validPhrase =
    "zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote";
  // Sanity-pin: the fixed vector round-trips to all-0xff entropy via the prod code.
  const validEntropyHex = "ff".repeat(32);

  it("the fixed vector is a real BIP39 phrase that decodes to its known entropy", () => {
    expect(isValidRecoveryPhrase(validPhrase)).toBe(true);
    expect(hex(phraseToRecoveryKey(validPhrase))).toBe(validEntropyHex);
  });

  it("tolerates messy whitespace + casing", () => {
    const messy = `  ${validPhrase.toUpperCase().replace(/ /g, "   ")}  `;
    expect(isValidRecoveryPhrase(messy)).toBe(true);
    expect(hex(phraseToRecoveryKey(messy))).toBe(hex(phraseToRecoveryKey(validPhrase)));
  });

  it("rejects an unknown word", () => {
    expect(isValidRecoveryPhrase(validPhrase.replace(/\w+$/, "zzzznotaword"))).toBe(false);
    expect(() => phraseToRecoveryKey(validPhrase.replace(/\w+$/, "zzzznotaword"))).toThrow(
      InvalidRecoveryPhraseError,
    );
  });

  it("rejects a failed checksum (last word swapped for another valid word)", () => {
    // Deterministic: for the all-0xff vector the final word is "vote"; swapping it
    // to "zoo" (a real wordlist word) yields a phrase whose checksum no longer
    // matches the entropy, so validation MUST fail. Unlike the old random phrase,
    // this swap is a guaranteed checksum mismatch, not a 1-in-256 gamble.
    const words = validPhrase.split(" ");
    const swapped = [...words.slice(0, 23), "zoo"].join(" ");
    expect(swapped).not.toBe(validPhrase); // guard: the swap actually changed a word
    expect(isValidRecoveryPhrase(swapped)).toBe(false);
  });

  it("normalizeRecoveryPhrase collapses + lowercases", () => {
    expect(normalizeRecoveryPhrase("  Abandon   ABILITY  ")).toBe("abandon ability");
  });
});
