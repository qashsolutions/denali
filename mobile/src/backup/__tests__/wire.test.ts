/**
 * Wire codec — SealedBackup <-> JSON-safe WireBackup round-trip + validation.
 */

import { randomBytes as nodeRandomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createBackupCrypto, type RandomBytes } from "../cryptoProvider";
import { sealBackup } from "../envelope";
import { sealedToWire, WireFormatError, wireToSealed } from "../wire";

const rng: RandomBytes = (n) => new Uint8Array(nodeRandomBytes(n));
const crypto = createBackupCrypto(rng);
const hex = (u8: Uint8Array) => Buffer.from(u8).toString("hex");

function makeSealed() {
  return sealBackup(crypto, rng(32), new TextEncoder().encode("hello record"), {
    appDataVersion: 1,
    recordCounts: { observations: 3, conditions: 1, profile: 1 },
    createdAtIso: "2026-06-14T10:00:00.000Z",
  });
}

describe("sealedToWire / wireToSealed", () => {
  it("survives a full JSON transport round-trip", () => {
    const sealed = makeSealed();
    const overWire = JSON.parse(JSON.stringify(sealedToWire(sealed)));
    const back = wireToSealed(overWire);

    expect(hex(back.kekSalt)).toBe(hex(sealed.kekSalt));
    expect(hex(back.wrapNonce)).toBe(hex(sealed.wrapNonce));
    expect(hex(back.wrappedDek)).toBe(hex(sealed.wrappedDek));
    expect(hex(back.dataNonce)).toBe(hex(sealed.dataNonce));
    expect(hex(back.ciphertext)).toBe(hex(sealed.ciphertext));
    expect(back.manifest).toEqual(sealed.manifest);
    expect(back.version).toBe(sealed.version);
  });

  it("produces a JSON-stringifiable shape (no binary leaks)", () => {
    const wire = sealedToWire(makeSealed());
    const json = JSON.stringify(wire);
    expect(json).not.toContain("Uint8Array");
    expect(typeof wire.ciphertext).toBe("string");
    expect(wire.ciphertext).toMatch(/^[0-9a-f]+$/);
  });
});

describe("wireToSealed validation (fails closed)", () => {
  it("rejects a non-object", () => {
    expect(() => wireToSealed("nope")).toThrow(WireFormatError);
  });

  it("rejects a missing manifest", () => {
    const wire = sealedToWire(makeSealed()) as unknown as Record<string, unknown>;
    delete wire.manifest;
    expect(() => wireToSealed(wire)).toThrow(WireFormatError);
  });

  it("rejects a non-string hex field", () => {
    const wire = { ...sealedToWire(makeSealed()), ciphertext: 123 };
    expect(() => wireToSealed(wire)).toThrow(WireFormatError);
  });

  it("rejects an invalid-hex field", () => {
    const wire = { ...sealedToWire(makeSealed()), kekSalt: "zzzz" };
    expect(() => wireToSealed(wire)).toThrow(WireFormatError);
  });
});
