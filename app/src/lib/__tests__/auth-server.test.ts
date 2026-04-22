import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * auth-server.ts — Unit Tests
 *
 * Tests getAuthUser() JWT extraction and email fallback logic.
 * Cognito verifier and RDS are mocked.
 */

// Mock CognitoJwtVerifier
const mockVerify = vi.fn();
vi.mock("aws-jwt-verify", () => ({
  CognitoJwtVerifier: {
    create: () => ({ verify: mockVerify }),
  },
}));

// Mock RDS
const mockQuery = vi.fn();
vi.mock("@/lib/db", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

// Mock Cognito SDK (not used by getAuthUser, but imported at module level)
vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: vi.fn(),
  AdminCreateUserCommand: vi.fn(),
  AdminDeleteUserCommand: vi.fn(),
  AdminGetUserCommand: vi.fn(),
  AdminInitiateAuthCommand: vi.fn(),
  AdminSetUserPasswordCommand: vi.fn(),
  GlobalSignOutCommand: vi.fn(),
  InitiateAuthCommand: vi.fn(),
}));

import { NextRequest } from "next/server";
import { getAuthUser, getAuthUserOptional } from "../auth-server";

function makeRequest(opts?: { bearer?: string; cookie?: string }): NextRequest {
  const headers: Record<string, string> = {};
  if (opts?.bearer) headers["Authorization"] = `Bearer ${opts.bearer}`;

  const req = new NextRequest("http://localhost:3000/api/test", { headers });
  if (opts?.cookie) {
    // NextRequest cookies are read-only, so we build with cookie header
    return new NextRequest("http://localhost:3000/api/test", {
      headers: {
        ...headers,
        cookie: `access_token=${opts.cookie}`,
      },
    });
  }
  return req;
}

describe("getAuthUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no token is present", async () => {
    const result = await getAuthUser(makeRequest());
    expect(result).toBeNull();
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("extracts token from Authorization Bearer header", async () => {
    mockVerify.mockResolvedValue({ sub: "uuid-123", email: "user@test.com" });

    const result = await getAuthUser(makeRequest({ bearer: "my-jwt-token" }));

    expect(mockVerify).toHaveBeenCalledWith("my-jwt-token");
    expect(result).toEqual({ userId: "uuid-123", email: "user@test.com" });
  });

  it("extracts token from access_token cookie", async () => {
    mockVerify.mockResolvedValue({ sub: "uuid-456", email: "cookie@test.com" });

    const result = await getAuthUser(makeRequest({ cookie: "cookie-jwt" }));

    expect(mockVerify).toHaveBeenCalledWith("cookie-jwt");
    expect(result).toEqual({ userId: "uuid-456", email: "cookie@test.com" });
  });

  it("prefers Authorization header over cookie", async () => {
    mockVerify.mockResolvedValue({ sub: "uuid-789", email: "header@test.com" });

    const req = new NextRequest("http://localhost:3000/api/test", {
      headers: {
        Authorization: "Bearer header-token",
        cookie: "access_token=cookie-token",
      },
    });

    await getAuthUser(req);
    expect(mockVerify).toHaveBeenCalledWith("header-token");
  });

  it("falls back to username when email claim is missing", async () => {
    mockVerify.mockResolvedValue({ sub: "uuid-100", username: "user@fallback.com" });

    const result = await getAuthUser(makeRequest({ bearer: "tok" }));
    expect(result).toEqual({ userId: "uuid-100", email: "user@fallback.com" });
  });

  it("looks up email from DB when token has UUID username (no @ sign)", async () => {
    mockVerify.mockResolvedValue({ sub: "uuid-200", username: "abc-def-ghi" });
    mockQuery.mockResolvedValue({ rows: [{ email: "db@lookup.com" }] });

    const result = await getAuthUser(makeRequest({ bearer: "tok" }));

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SELECT email FROM users"),
      ["uuid-200"]
    );
    expect(result).toEqual({ userId: "uuid-200", email: "db@lookup.com" });
  });

  it("proceeds with UUID email when DB lookup fails", async () => {
    mockVerify.mockResolvedValue({ sub: "uuid-300", username: "abc-def" });
    mockQuery.mockRejectedValue(new Error("connection refused"));

    const result = await getAuthUser(makeRequest({ bearer: "tok" }));

    expect(result).toEqual({ userId: "uuid-300", email: "abc-def" });
  });

  it("proceeds with UUID email when DB returns no rows", async () => {
    mockVerify.mockResolvedValue({ sub: "uuid-400", username: "no-match" });
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await getAuthUser(makeRequest({ bearer: "tok" }));
    expect(result).toEqual({ userId: "uuid-400", email: "no-match" });
  });

  it("returns null when token verification fails", async () => {
    mockVerify.mockRejectedValue(new Error("Token expired"));

    const result = await getAuthUser(makeRequest({ bearer: "bad-token" }));
    expect(result).toBeNull();
  });

  it("returns empty email when neither email nor username is in payload", async () => {
    mockVerify.mockResolvedValue({ sub: "uuid-500" });

    const result = await getAuthUser(makeRequest({ bearer: "tok" }));
    expect(result).toEqual({ userId: "uuid-500", email: "" });
  });

  // ── Malformed Bearer header edge cases ──

  it("ignores lowercase 'bearer' (case-sensitive check)", async () => {
    const req = new NextRequest("http://localhost:3000/api/test", {
      headers: { Authorization: "bearer lowercase-token" },
    });

    const result = await getAuthUser(req);

    // "bearer " doesn't match startsWith("Bearer ") → no token extracted, no cookie → null
    expect(result).toBeNull();
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("ignores 'BearerNOSPACE' (no space after Bearer)", async () => {
    const req = new NextRequest("http://localhost:3000/api/test", {
      headers: { Authorization: "BearerNOSPACE" },
    });

    const result = await getAuthUser(req);

    // "BearerNOSPACE" doesn't start with "Bearer " → falls to cookie → no cookie → null
    expect(result).toBeNull();
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("passes empty string to verifier when header is 'Bearer ' with nothing after", async () => {
    // "Bearer " (trailing space, no token) → slice(7) → ""
    // Empty string passes the `if (!token)` check since "" is falsy → returns null
    const req = new NextRequest("http://localhost:3000/api/test", {
      headers: { Authorization: "Bearer " },
    });

    const result = await getAuthUser(req);
    expect(result).toBeNull();
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("returns null when Bearer header has only whitespace after prefix", async () => {
    // "Bearer   " — HTTP headers trim trailing whitespace per spec,
    // so slice(7) yields "" (falsy) → !token → returns null without calling verifier.
    // This is safe: whitespace-only tokens never reach the verifier.
    const req = new NextRequest("http://localhost:3000/api/test", {
      headers: { Authorization: "Bearer   " },
    });

    const result = await getAuthUser(req);
    expect(result).toBeNull();
    expect(mockVerify).not.toHaveBeenCalled();
  });
});

describe("getAuthUserOptional", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user on success", async () => {
    mockVerify.mockResolvedValue({ sub: "uuid-opt", email: "opt@test.com" });

    const result = await getAuthUserOptional(makeRequest({ bearer: "tok" }));
    expect(result).toEqual({ userId: "uuid-opt", email: "opt@test.com" });
  });

  it("returns null on any error without throwing", async () => {
    mockVerify.mockRejectedValue(new Error("boom"));

    const result = await getAuthUserOptional(makeRequest({ bearer: "tok" }));
    expect(result).toBeNull();
  });
});
