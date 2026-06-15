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
  const validPhrase = recoveryKeyToPhrase(generateRecoveryKey(rng));

  it("accepts a freshly generated phrase", () => {
    expect(isValidRecoveryPhrase(validPhrase)).toBe(true);
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
    // Swap the final word for a different real word -> checksum should fail.
    const words = validPhrase.split(" ");
    const swapped = [...words.slice(0, 23), words[23] === "zoo" ? "zone" : "zoo"].join(" ");
    expect(isValidRecoveryPhrase(swapped)).toBe(false);
  });

  it("normalizeRecoveryPhrase collapses + lowercases", () => {
    expect(normalizeRecoveryPhrase("  Abandon   ABILITY  ")).toBe("abandon ability");
  });
});
