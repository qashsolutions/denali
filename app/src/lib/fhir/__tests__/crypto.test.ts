import { describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * fhir/crypto.ts — Unit Tests
 *
 * Tests AES-256-GCM encryption of Blue Button OAuth tokens.
 * CRITICAL: If encrypt/decrypt break, all Blue Button connections fail silently.
 * If auth tag validation is wrong, tampered tokens could be accepted.
 */

import { encrypt, decrypt } from "../crypto";

// Valid 32-byte hex key (64 chars)
const TEST_KEY = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";
const WRONG_KEY = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

describe("fhir/crypto — AES-256-GCM", () => {
  beforeEach(() => {
    process.env.FHIR_TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.FHIR_TOKEN_ENCRYPTION_KEY;
  });

  // ── Round-trip ──

  it("encrypt → decrypt returns original plaintext", () => {
    const plaintext = "my-secret-oauth-token-12345";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("round-trips JSON token payloads", () => {
    const payload = JSON.stringify({
      access_token: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test",
      refresh_token: "def50200abc123",
      expires_in: 3600,
    });
    expect(decrypt(encrypt(payload))).toBe(payload);
  });

  it("round-trips empty string", () => {
    expect(decrypt(encrypt(""))).toBe("");
  });

  it("round-trips long tokens (> 1KB)", () => {
    const longToken = "x".repeat(2000);
    expect(decrypt(encrypt(longToken))).toBe(longToken);
  });

  it("round-trips unicode content", () => {
    const unicode = "token-with-émojis-🔑-and-ñ";
    expect(decrypt(encrypt(unicode))).toBe(unicode);
  });

  // ── IV uniqueness ──

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const plaintext = "identical-input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b); // Different random IVs → different output
    // But both decrypt to the same thing
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  // ── Output format ──

  it("produces valid base64 output", () => {
    const encrypted = encrypt("test");
    expect(() => Buffer.from(encrypted, "base64")).not.toThrow();
    // Re-encode should match (no corruption)
    const buf = Buffer.from(encrypted, "base64");
    expect(buf.toString("base64")).toBe(encrypted);
  });

  it("output contains IV (12 bytes) + ciphertext + auth tag (16 bytes)", () => {
    const plaintext = "hello";
    const encrypted = encrypt(plaintext);
    const buf = Buffer.from(encrypted, "base64");
    // Minimum size: 12 (IV) + 0 (empty plaintext would be smaller) + 16 (tag)
    expect(buf.length).toBeGreaterThanOrEqual(12 + 16);
    // For "hello" (5 bytes), ciphertext is 5 bytes (GCM stream cipher, no padding)
    expect(buf.length).toBe(12 + 5 + 16);
  });

  // ── Tamper detection ──

  it("rejects tampered ciphertext (flipped byte)", () => {
    const encrypted = encrypt("sensitive-token");
    const buf = Buffer.from(encrypted, "base64");
    // Flip a byte in the ciphertext region (after IV, before tag)
    buf[15] ^= 0xff;
    const tampered = buf.toString("base64");

    expect(() => decrypt(tampered)).toThrow();
  });

  it("rejects tampered auth tag", () => {
    const encrypted = encrypt("sensitive-token");
    const buf = Buffer.from(encrypted, "base64");
    // Flip last byte (auth tag region)
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString("base64");

    expect(() => decrypt(tampered)).toThrow();
  });

  it("rejects tampered IV", () => {
    const encrypted = encrypt("sensitive-token");
    const buf = Buffer.from(encrypted, "base64");
    // Flip first byte (IV region)
    buf[0] ^= 0xff;
    const tampered = buf.toString("base64");

    expect(() => decrypt(tampered)).toThrow();
  });

  it("rejects truncated ciphertext", () => {
    const encrypted = encrypt("my-token");
    const buf = Buffer.from(encrypted, "base64");
    const truncated = buf.subarray(0, buf.length - 5).toString("base64");

    expect(() => decrypt(truncated)).toThrow();
  });

  it("rejects garbage input", () => {
    expect(() => decrypt("not-valid-encrypted-data")).toThrow();
  });

  // ── Wrong key ──

  it("fails to decrypt with a different key", () => {
    const encrypted = encrypt("secret");

    // Switch to wrong key
    process.env.FHIR_TOKEN_ENCRYPTION_KEY = WRONG_KEY;

    expect(() => decrypt(encrypted)).toThrow();
  });

  // ── Key validation ──

  it("throws when FHIR_TOKEN_ENCRYPTION_KEY is missing", () => {
    delete process.env.FHIR_TOKEN_ENCRYPTION_KEY;

    expect(() => encrypt("test")).toThrow("FHIR_TOKEN_ENCRYPTION_KEY");
  });

  it("throws when key is too short", () => {
    process.env.FHIR_TOKEN_ENCRYPTION_KEY = "abcd1234"; // 8 chars, not 64

    expect(() => encrypt("test")).toThrow("32-byte hex string");
  });

  it("throws when key is too long", () => {
    process.env.FHIR_TOKEN_ENCRYPTION_KEY = TEST_KEY + "ff"; // 66 chars

    expect(() => encrypt("test")).toThrow("32-byte hex string");
  });

  it("throws when key is empty string", () => {
    process.env.FHIR_TOKEN_ENCRYPTION_KEY = "";

    expect(() => encrypt("test")).toThrow("FHIR_TOKEN_ENCRYPTION_KEY");
  });
});
