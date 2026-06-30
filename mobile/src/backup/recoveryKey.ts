/**
 * Recovery key — the root secret for ZK backup (D16, BIP39 rendering).
 *
 * The RK is 256 bits of CSPRNG (the same FIPS-grade source as the SQLCipher
 * key; NEVER derived from login — invariant 3). It is rendered as a 24-word
 * BIP39 mnemonic for the printable recovery kit — the checksum catches
 * transcription errors. The phrase IS the cross-device recovery: on a new
 * device the user enters it to re-derive the RK and decrypt their backup.
 *
 * @scure/bip39 is pure-JS + audited (noble family); verified by the unit tests.
 */

import { entropyToMnemonic, mnemonicToEntropy, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

import { KEY_BYTES, type RandomBytes } from "./cryptoProvider";

/** Thrown when a user-entered recovery phrase is malformed or fails checksum. */
export class InvalidRecoveryPhraseError extends Error {
  constructor() {
    super("That recovery phrase isn't valid. Check the words and try again.");
    this.name = "InvalidRecoveryPhraseError";
  }
}

/** Generate a fresh 256-bit recovery key from the injected CSPRNG. */
export function generateRecoveryKey(randomBytes: RandomBytes): Uint8Array {
  return randomBytes(KEY_BYTES);
}

/** Render a recovery key as a 24-word BIP39 phrase (for the recovery kit). */
export function recoveryKeyToPhrase(recoveryKey: Uint8Array): string {
  return entropyToMnemonic(recoveryKey, wordlist);
}

/** Normalize user input: trim, collapse internal whitespace, lowercase. */
export function normalizeRecoveryPhrase(phrase: string): string {
  return phrase.trim().replace(/\s+/g, " ").toLowerCase();
}

/** True iff the phrase is a valid BIP39 mnemonic (checksum passes). */
export function isValidRecoveryPhrase(phrase: string): boolean {
  return validateMnemonic(normalizeRecoveryPhrase(phrase), wordlist);
}

/**
 * Decode a recovery phrase back to the 256-bit key. Throws
 * InvalidRecoveryPhraseError on an unknown word or a failed checksum.
 */
export function phraseToRecoveryKey(phrase: string): Uint8Array {
  const normalized = normalizeRecoveryPhrase(phrase);
  if (!validateMnemonic(normalized, wordlist)) {
    throw new InvalidRecoveryPhraseError();
  }
  return mnemonicToEntropy(normalized, wordlist);
}
