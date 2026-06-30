/**
 * blobStore tests — Phase 1 mobile (Wave 2 / mobile-upload-parse-builder).
 *
 * What these tests prove:
 *   1. Encryption parity — writing then reading a blob round-trips exactly
 *      under the same keystore root.
 *   2. Wrong-key isolation — a blob written under root A cannot be decrypted
 *      under root B. (We can't simulate "wrong key" by re-calling
 *      `getOrCreateDbKey()` because the keystore returns the same value;
 *      instead we directly verify the GCM tag check raises by tampering
 *      with the stored bytes.)
 *   3. Static-source isolation (Invariant 3 / Invariant 1 cross-check) —
 *      `blobStore.ts` does NOT import `@/auth`, does NOT call `fetch` /
 *      `XMLHttpRequest`, does NOT contain `cognito` / `jwt` /
 *      `refresh_token` / `access_token`. Mirrors the keystore static check.
 *
 * Approach: we mock the runtime dependencies (expo-crypto, expo-file-system,
 * keystore) with deterministic in-memory equivalents so the tests run under
 * vitest's node environment without a device.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as nodeCrypto from "node:crypto";

// ── In-memory fakes for expo-file-system ────────────────────────────────

const fakeFs: Record<string, Uint8Array> = {};

class FakeDirectory {
  constructor(public root: { uri: string } | string, public name?: string) {}
  get uri(): string {
    const base = typeof this.root === "string" ? this.root : this.root.uri;
    return this.name ? `${base.replace(/\/$/, "")}/${this.name}/` : base;
  }
  get exists(): boolean {
    return true; // ensure directories always exist for the test
  }
  create(_opts?: { intermediates?: boolean }): void {
    // no-op
    void _opts;
  }
}

class FakeFile {
  uri: string;
  constructor(...parts: Array<{ uri: string } | string | FakeFile>) {
    const segments = parts.map((p) =>
      typeof p === "string" ? p : "uri" in p ? p.uri : "",
    );
    // Join exactly like the spec wants — last segment is the filename.
    const base = segments[0].replace(/\/$/, "");
    const tail = segments.slice(1).join("/").replace(/^\//, "");
    this.uri = tail ? `${base}/${tail}` : base;
  }
  get exists(): boolean {
    return this.uri in fakeFs;
  }
  create(): void {
    if (!(this.uri in fakeFs)) fakeFs[this.uri] = new Uint8Array(0);
  }
  write(content: Uint8Array | string): void {
    if (typeof content === "string") {
      fakeFs[this.uri] = new TextEncoder().encode(content);
    } else {
      fakeFs[this.uri] = new Uint8Array(content);
    }
  }
  async bytes(): Promise<Uint8Array> {
    if (!(this.uri in fakeFs)) {
      throw new Error(`FakeFile: ${this.uri} not found`);
    }
    return new Uint8Array(fakeFs[this.uri]);
  }
  delete(): void {
    delete fakeFs[this.uri];
  }
}

vi.mock("expo-file-system", () => ({
  Directory: FakeDirectory,
  File: FakeFile,
  Paths: { document: { uri: "file:///fake/doc" } },
}));

// ── In-memory fakes for expo-crypto (AES-GCM + digest + random) ─────────

// Use node's crypto under the hood so the round-trip is real cryptography.
const aesKeyByBytes = new WeakMap<object, Uint8Array>();

class FakeSealedData {
  // Renamed from `combined` (which is a method in the real API) to
  // `combinedBytes` to avoid shadowing the method-name slot.
  combinedBytes: Uint8Array;
  ivLen: number;
  tagLen: number;

  constructor(bytes: Uint8Array, ivLen = 12, tagLen = 16) {
    this.combinedBytes = bytes;
    this.ivLen = ivLen;
    this.tagLen = tagLen;
  }

  static fromCombined(
    combined: Uint8Array,
    config?: { ivLength?: number; tagLength?: number },
  ): FakeSealedData {
    return new FakeSealedData(
      new Uint8Array(combined),
      config?.ivLength ?? 12,
      config?.tagLength ?? 16,
    );
  }

  static fromParts(_iv: unknown, _ct: unknown, _tag?: unknown): FakeSealedData {
    throw new Error("fromParts not used in tests");
  }

  async combined(encoding?: "bytes" | "base64"): Promise<Uint8Array | string> {
    if (encoding === "base64") {
      return Buffer.from(this.combinedBytes).toString("base64");
    }
    return new Uint8Array(this.combinedBytes);
  }
}

class FakeAESKey {
  constructor(public bytes: Uint8Array) {}
  static async import(bytes: Uint8Array): Promise<FakeAESKey> {
    const key = new FakeAESKey(new Uint8Array(bytes));
    aesKeyByBytes.set(key, key.bytes);
    return key;
  }
}

async function fakeAesEncryptAsync(
  plaintext: Uint8Array | string | ArrayBuffer,
  key: FakeAESKey,
  options: { nonce: { bytes: Uint8Array } },
): Promise<FakeSealedData> {
  const pt =
    typeof plaintext === "string"
      ? Buffer.from(plaintext, "base64")
      : plaintext instanceof Uint8Array
        ? Buffer.from(plaintext)
        : Buffer.from(plaintext);
  const iv = Buffer.from(options.nonce.bytes);
  const cipher = nodeCrypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(key.bytes),
    iv,
  );
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, ct, tag]);
  return new FakeSealedData(new Uint8Array(combined), iv.length, tag.length);
}

async function fakeAesDecryptAsync(
  sealed: FakeSealedData,
  key: FakeAESKey,
  options?: { output?: "bytes" | "base64" },
): Promise<Uint8Array | string> {
  const bytes = sealed.combinedBytes;
  const iv = bytes.slice(0, sealed.ivLen);
  const tag = bytes.slice(bytes.length - sealed.tagLen);
  const ct = bytes.slice(sealed.ivLen, bytes.length - sealed.tagLen);
  const decipher = nodeCrypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key.bytes),
    Buffer.from(iv),
  );
  decipher.setAuthTag(Buffer.from(tag));
  const pt = Buffer.concat([decipher.update(Buffer.from(ct)), decipher.final()]);
  if (options?.output === "base64") return pt.toString("base64");
  return new Uint8Array(pt);
}

vi.mock("expo-crypto", () => ({
  getRandomBytes: (n: number) => nodeCrypto.randomBytes(n),
  digest: async (_alg: unknown, data: Uint8Array): Promise<ArrayBuffer> => {
    const h = nodeCrypto.createHash("sha256").update(Buffer.from(data)).digest();
    const out = new Uint8Array(h.length);
    out.set(h);
    return out.buffer;
  },
  CryptoDigestAlgorithm: { SHA256: "SHA256" },
  AESEncryptionKey: FakeAESKey,
  AESSealedData: FakeSealedData,
  aesEncryptAsync: fakeAesEncryptAsync,
  aesDecryptAsync: fakeAesDecryptAsync,
}));

// ── Keystore mock ────────────────────────────────────────────────────────

let mockRootKey = "00".repeat(32);
vi.mock("@/db/keystore", () => ({
  getOrCreateDbKey: () => Promise.resolve(mockRootKey),
}));

// ── Tests ────────────────────────────────────────────────────────────────

describe("blobStore — encryption parity + key isolation", () => {
  beforeEach(async () => {
    for (const k of Object.keys(fakeFs)) delete fakeFs[k];
    mockRootKey = nodeCrypto.randomBytes(32).toString("hex");
    // Clear the in-process key cache so each test re-derives.
    const mod = await import("../blobStore");
    mod.__dangerouslyClearBlobKeyCacheForTests();
  });

  it("round-trips: write encrypted, read decrypted matches plaintext", async () => {
    const { storeBlob, readBlob } = await import("../blobStore");

    // Seed a source plaintext file in the fake FS.
    const plaintext = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    fakeFs["file:///fake/source.pdf"] = plaintext;

    const reportId = "report-aaa-1";
    const outUri = await storeBlob(reportId, "file:///fake/source.pdf");
    expect(outUri).toMatch(/reports\/report-aaa-1\.bin$/);

    // The stored bytes are NOT plaintext.
    const storedBytes = fakeFs[outUri];
    expect(storedBytes).toBeDefined();
    expect(storedBytes.length).toBeGreaterThan(plaintext.length); // IV + tag overhead
    // No subsequence of the encrypted output matches the plaintext.
    const storedAsString = Buffer.from(storedBytes).toString("hex");
    const plaintextHex = Buffer.from(plaintext).toString("hex");
    expect(storedAsString).not.toContain(plaintextHex);

    // Read decrypts back to the original bytes.
    const decrypted = await readBlob(reportId);
    expect(Array.from(decrypted)).toEqual(Array.from(plaintext));
  });

  it("fails to decrypt after the root key changes (wrong-key isolation)", async () => {
    const blobMod = await import("../blobStore");
    const { storeBlob, readBlob, __dangerouslyClearBlobKeyCacheForTests } =
      blobMod;

    fakeFs["file:///fake/source.pdf"] = new Uint8Array([10, 20, 30]);
    await storeBlob("report-bbb-1", "file:///fake/source.pdf");

    // Simulate a "wrong key" scenario: rotate the keystore root and reset
    // the cache so the next derivation produces a different blob key.
    mockRootKey = nodeCrypto.randomBytes(32).toString("hex");
    __dangerouslyClearBlobKeyCacheForTests();

    await expect(readBlob("report-bbb-1")).rejects.toThrow();
  });

  it("fails to decrypt when the ciphertext is tampered with (GCM auth)", async () => {
    const blobMod = await import("../blobStore");
    const { storeBlob, readBlob } = blobMod;

    fakeFs["file:///fake/source.pdf"] = new Uint8Array([42, 42, 42]);
    const outUri = await storeBlob("report-ccc-1", "file:///fake/source.pdf");

    // Flip one byte inside the ciphertext region.
    const bytes = new Uint8Array(fakeFs[outUri]);
    bytes[bytes.length - 20] ^= 0x55;
    fakeFs[outUri] = bytes;

    await expect(readBlob("report-ccc-1")).rejects.toThrow();
  });

  it("rejects path-traversal report ids", async () => {
    const { storeBlob } = await import("../blobStore");
    fakeFs["file:///fake/source.pdf"] = new Uint8Array([1]);
    await expect(
      storeBlob("../../etc/passwd", "file:///fake/source.pdf"),
    ).rejects.toThrow(/Invalid reportId/);
  });
});

describe("blobStore — static-source isolation (Invariant 3 cross-check)", () => {
  // Mirror of mobile/src/db/__tests__/keystore.test.ts § static-source.
  // Confirms blobStore.ts does not import any auth/network surface.
  it("source does not import @/auth, fetch, XMLHttpRequest, or token names", () => {
    const path = resolve(__dirname, "../blobStore.ts");
    const raw = readFileSync(path, "utf8");
    const src = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    // Allowed imports.
    expect(src).toMatch(/from "expo-crypto"/);
    expect(src).toMatch(/from "expo-file-system"/);
    expect(src).toMatch(/from "@\/db\/keystore"/);

    // Forbidden imports / surfaces.
    expect(src).not.toMatch(/from "@\/auth/);
    expect(src).not.toMatch(/from "@\/contracts\/ApiClient/);
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/XMLHttpRequest/);
    // No derivation from server-issued tokens (code-level — comments stripped).
    expect(src).not.toMatch(/\bjwt\b/i);
    expect(src).not.toMatch(/cognito/i);
    expect(src).not.toMatch(/refresh.?token/i);
    expect(src).not.toMatch(/access.?token/i);
  });
});
