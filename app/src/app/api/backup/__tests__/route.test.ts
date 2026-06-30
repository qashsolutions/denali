import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Zero-Knowledge Backup API — unit tests.
 *
 * Auth gating, fail-closed validation, last-write-wins replace, and the
 * ciphertext-only guard: the server stores ONLY opaque hex + manifest and
 * never persists a stray recovery key / plaintext even if a client sends one.
 */

const mockGetAuthUser = vi.fn();
vi.mock("@/lib/auth-server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}));

const mockQuery = vi.fn();
const mockTxQ = vi.fn();
vi.mock("@/lib/db", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  transaction: async (cb: (q: typeof mockTxQ) => unknown) => cb(mockTxQ),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockReturnValue(Promise.resolve()),
}));

import { NextRequest } from "next/server";
import { GET, PUT, POST, DELETE } from "../route";
import { AUTH } from "@/config/messages";

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/backup", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const MOCK_USER = { userId: "user-123", email: "test@example.com" };

const VALID_WIRE = {
  version: 1,
  kekSalt: "aabb",
  wrapNonce: "ccdd",
  wrappedDek: "eeff",
  dataNonce: "0011",
  ciphertext: "22334455",
  manifest: {
    schemaVersion: 1,
    appDataVersion: 1,
    recordCounts: { observations: 2, conditions: 1, profile: 1 },
    createdAtIso: "2026-06-14T10:00:00.000Z",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockQuery.mockResolvedValue({ rows: [] });
  mockTxQ.mockResolvedValue({ rows: [] });
});

describe("PUT /api/backup", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await PUT(makeRequest("PUT", VALID_WIRE));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe(AUTH.SIGN_IN_REQUIRED);
  });

  it.each([
    ["missing ciphertext", { ...VALID_WIRE, ciphertext: undefined }],
    ["non-hex ciphertext", { ...VALID_WIRE, ciphertext: "zzzz" }],
    ["odd-length hex", { ...VALID_WIRE, kekSalt: "abc" }],
    ["missing manifest", { ...VALID_WIRE, manifest: undefined }],
    ["non-number version", { ...VALID_WIRE, version: "1" }],
  ])("returns 400 on %s", async (_label, body) => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    const res = await PUT(makeRequest("PUT", body));
    expect(res.status).toBe(400);
  });

  it("stores the blob (last-write-wins: DELETE then INSERT) and returns size", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    const res = await PUT(makeRequest("PUT", VALID_WIRE));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.sizeBytes).toBe(VALID_WIRE.ciphertext.length / 2);

    const sqls = mockTxQ.mock.calls.map((c) => String(c[0]));
    expect(sqls[0]).toContain("DELETE FROM backup_blobs");
    expect(sqls[1]).toContain("INSERT INTO backup_blobs");
    // Insert params carry the opaque ciphertext + the user scope.
    const insertParams = mockTxQ.mock.calls[1][1] as unknown[];
    expect(insertParams[0]).toBe("user-123");
    expect(insertParams).toContain("22334455");
  });

  it("ciphertext-only: never persists a stray recovery key / plaintext", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    const sneaky = {
      ...VALID_WIRE,
      recoveryKey: "SUPER_SECRET_KEY",
      plaintext: "RAW_PHI_VALUE",
    };
    const res = await PUT(makeRequest("PUT", sneaky));
    expect(res.status).toBe(200);

    const insertCall = mockTxQ.mock.calls.find((c) =>
      String(c[0]).includes("INSERT"),
    );
    const persisted = JSON.stringify(insertCall?.[1]);
    expect(persisted).not.toContain("SUPER_SECRET_KEY");
    expect(persisted).not.toContain("RAW_PHI_VALUE");
  });

  it("returns 500 when the transaction throws", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockTxQ.mockRejectedValueOnce(new Error("db down"));
    const res = await PUT(makeRequest("PUT", VALID_WIRE));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/backup (mobile alias for PUT)", () => {
  it("is wired (the mobile ApiClient sends POST, not PUT)", () => {
    expect(typeof POST).toBe("function");
  });

  it("stores identically to PUT (same auth + validation + insert path)", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    const res = await POST(makeRequest("POST", VALID_WIRE));
    expect(res.status).toBe(200);
    const sqls = mockTxQ.mock.calls.map((c) => String(c[0]));
    expect(sqls[1]).toContain("INSERT INTO backup_blobs");
  });

  it("still enforces auth (401 when unauthenticated)", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await POST(makeRequest("POST", VALID_WIRE));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/backup", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when the user has no backup", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(404);
  });

  it("returns the latest blob mapped to the wire shape", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockResolvedValue({
      rows: [
        {
          version: 1,
          kek_salt: "aabb",
          wrap_nonce: "ccdd",
          wrapped_dek: "eeff",
          data_nonce: "0011",
          ciphertext: "22334455",
          manifest: VALID_WIRE.manifest,
        },
      ],
    });
    const res = await GET(makeRequest("GET"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.kekSalt).toBe("aabb");
    expect(body.ciphertext).toBe("22334455");
    expect(body.manifest.recordCounts.observations).toBe(2);
    // scoped read
    expect(mockQuery.mock.calls[0][1]).toEqual(["user-123"]);
  });
});

describe("DELETE /api/backup", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await DELETE(makeRequest("DELETE"));
    expect(res.status).toBe(401);
  });

  it("deletes the user's backup and returns success", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    const res = await DELETE(makeRequest("DELETE"));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(String(mockQuery.mock.calls[0][0])).toContain(
      "DELETE FROM backup_blobs",
    );
    expect(mockQuery.mock.calls[0][1]).toEqual(["user-123"]);
  });
});
