import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * auth-server.ts — Cognito Integration Tests
 *
 * Tests all Cognito admin functions: user CRUD, auth, signout, token refresh.
 * The Cognito SDK client's send() method is mocked to verify correct commands
 * are dispatched and error paths are handled.
 */

// Mock send at the SDK client level so all commands go through it
const mockSend = vi.fn();
function MockCognitoClient() { return { send: mockSend }; }
vi.mock("@aws-sdk/client-cognito-identity-provider", async () => {
  const actual = await vi.importActual("@aws-sdk/client-cognito-identity-provider");
  return {
    ...actual,
    CognitoIdentityProviderClient: MockCognitoClient,
  };
});

// Mock JWT verifier (not under test here, but imported at module level)
vi.mock("aws-jwt-verify", () => ({
  CognitoJwtVerifier: { create: () => ({ verify: vi.fn() }) },
}));

// Mock DB (not under test here)
vi.mock("@/lib/db", () => ({ query: vi.fn() }));

import {
  deleteCognitoUser,
  getCognitoUsernameByEmail,
  createOrGetCognitoUser,
  setCognitoPassword,
  initiateCognitoAuth,
  cognitoGlobalSignOut,
  refreshCognitoTokens,
} from "../auth-server";

describe("deleteCognitoUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends AdminDeleteUserCommand with correct params", async () => {
    mockSend.mockResolvedValue({});

    await deleteCognitoUser("user@test.com");

    expect(mockSend).toHaveBeenCalledOnce();
    const command = mockSend.mock.calls[0][0];
    expect(command.input).toEqual(
      expect.objectContaining({ Username: "user@test.com" })
    );
  });

  it("throws when Cognito returns an error", async () => {
    mockSend.mockRejectedValue(new Error("User does not exist"));

    await expect(deleteCognitoUser("missing@test.com")).rejects.toThrow("User does not exist");
  });
});

describe("getCognitoUsernameByEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns Username on success", async () => {
    mockSend.mockResolvedValue({ Username: "user-uuid-123" });

    const result = await getCognitoUsernameByEmail("user@test.com");
    expect(result).toBe("user-uuid-123");
  });

  it("returns null when user not found", async () => {
    const err = new Error("UserNotFoundException");
    (err as unknown as Record<string, string>).name = "UserNotFoundException";
    mockSend.mockRejectedValue(err);

    const result = await getCognitoUsernameByEmail("missing@test.com");
    expect(result).toBeNull();
  });

  it("returns null on any other error", async () => {
    mockSend.mockRejectedValue(new Error("Service unavailable"));

    const result = await getCognitoUsernameByEmail("user@test.com");
    expect(result).toBeNull();
  });
});

describe("createOrGetCognitoUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns existing user sub when user exists", async () => {
    mockSend.mockResolvedValue({
      UserAttributes: [{ Name: "sub", Value: "existing-sub-123" }],
    });

    const sub = await createOrGetCognitoUser("existing@test.com");
    expect(sub).toBe("existing-sub-123");
    expect(mockSend).toHaveBeenCalledOnce(); // Only AdminGetUser, no Create
  });

  it("creates user when not found and returns new sub", async () => {
    const notFoundErr = new Error("UserNotFoundException");
    (notFoundErr as unknown as Record<string, string>).name = "UserNotFoundException";

    mockSend
      .mockRejectedValueOnce(notFoundErr) // AdminGetUser → not found
      .mockResolvedValueOnce({             // AdminCreateUser → success
        User: {
          Attributes: [{ Name: "sub", Value: "new-sub-456" }],
        },
      });

    const sub = await createOrGetCognitoUser("new@test.com");
    expect(sub).toBe("new-sub-456");
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("throws when AdminGetUser fails with non-UserNotFound error", async () => {
    mockSend.mockRejectedValue(new Error("InternalError"));

    await expect(createOrGetCognitoUser("user@test.com")).rejects.toThrow("InternalError");
  });

  it("throws when created user has no sub attribute", async () => {
    const notFoundErr = new Error("UserNotFoundException");
    (notFoundErr as unknown as Record<string, string>).name = "UserNotFoundException";

    mockSend
      .mockRejectedValueOnce(notFoundErr)
      .mockResolvedValueOnce({ User: { Attributes: [] } }); // No sub

    await expect(createOrGetCognitoUser("broken@test.com")).rejects.toThrow("Cognito sub missing");
  });

  it("returns sub from existing user even if other attributes are present", async () => {
    mockSend.mockResolvedValue({
      UserAttributes: [
        { Name: "email", Value: "user@test.com" },
        { Name: "sub", Value: "found-it" },
        { Name: "email_verified", Value: "true" },
      ],
    });

    const sub = await createOrGetCognitoUser("user@test.com");
    expect(sub).toBe("found-it");
  });
});

describe("setCognitoPassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends AdminSetUserPasswordCommand with Permanent=true", async () => {
    mockSend.mockResolvedValue({});

    await setCognitoPassword("user@test.com", "secret123");

    const command = mockSend.mock.calls[0][0];
    expect(command.input).toEqual(
      expect.objectContaining({
        Username: "user@test.com",
        Password: "secret123",
        Permanent: true,
      })
    );
  });

  it("throws on Cognito error", async () => {
    mockSend.mockRejectedValue(new Error("InvalidPasswordException"));

    await expect(setCognitoPassword("user@test.com", "weak")).rejects.toThrow("InvalidPasswordException");
  });
});

describe("initiateCognitoAuth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns tokens on successful auth", async () => {
    mockSend.mockResolvedValue({
      AuthenticationResult: {
        AccessToken: "access-tok",
        RefreshToken: "refresh-tok",
        IdToken: "id-tok",
        ExpiresIn: 3600,
      },
    });

    const tokens = await initiateCognitoAuth("user@test.com", "password123");

    expect(tokens).toEqual({
      accessToken: "access-tok",
      refreshToken: "refresh-tok",
      idToken: "id-tok",
      expiresIn: 3600,
    });
  });

  it("defaults expiresIn to 3600 when not provided", async () => {
    mockSend.mockResolvedValue({
      AuthenticationResult: {
        AccessToken: "a",
        RefreshToken: "r",
        IdToken: "i",
      },
    });

    const tokens = await initiateCognitoAuth("user@test.com", "pass");
    expect(tokens.expiresIn).toBe(3600);
  });

  it("throws when tokens are missing from response", async () => {
    mockSend.mockResolvedValue({ AuthenticationResult: null });

    await expect(initiateCognitoAuth("user@test.com", "pass")).rejects.toThrow(
      "Cognito did not return tokens"
    );
  });

  it("throws when AccessToken is missing", async () => {
    mockSend.mockResolvedValue({
      AuthenticationResult: { RefreshToken: "r", IdToken: "i" },
    });

    await expect(initiateCognitoAuth("user@test.com", "pass")).rejects.toThrow(
      "Cognito did not return tokens"
    );
  });

  it("sends correct AuthFlow and parameters", async () => {
    mockSend.mockResolvedValue({
      AuthenticationResult: {
        AccessToken: "a", RefreshToken: "r", IdToken: "i", ExpiresIn: 3600,
      },
    });

    await initiateCognitoAuth("user@test.com", "mypass");

    const command = mockSend.mock.calls[0][0];
    expect(command.input).toEqual(
      expect.objectContaining({
        AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
        AuthParameters: { USERNAME: "user@test.com", PASSWORD: "mypass" },
      })
    );
  });
});

describe("cognitoGlobalSignOut", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends GlobalSignOutCommand with access token", async () => {
    mockSend.mockResolvedValue({});

    await cognitoGlobalSignOut("my-access-token");

    const command = mockSend.mock.calls[0][0];
    expect(command.input).toEqual(
      expect.objectContaining({ AccessToken: "my-access-token" })
    );
  });

  it("swallows errors silently (expired token, already signed out)", async () => {
    mockSend.mockRejectedValue(new Error("NotAuthorizedException"));

    // Should not throw
    await expect(cognitoGlobalSignOut("expired-token")).resolves.toBeUndefined();
  });
});

describe("refreshCognitoTokens", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns new access token on success", async () => {
    mockSend.mockResolvedValue({
      AuthenticationResult: {
        AccessToken: "new-access-tok",
        ExpiresIn: 7200,
      },
    });

    const result = await refreshCognitoTokens("my-refresh-token");

    expect(result).toEqual({
      accessToken: "new-access-tok",
      expiresIn: 7200,
    });
  });

  it("defaults expiresIn to 3600 when not provided", async () => {
    mockSend.mockResolvedValue({
      AuthenticationResult: { AccessToken: "tok" },
    });

    const result = await refreshCognitoTokens("ref");
    expect(result.expiresIn).toBe(3600);
  });

  it("throws when AccessToken is missing", async () => {
    mockSend.mockResolvedValue({ AuthenticationResult: {} });

    await expect(refreshCognitoTokens("ref")).rejects.toThrow("Token refresh failed");
  });

  it("throws when AuthenticationResult is null", async () => {
    mockSend.mockResolvedValue({ AuthenticationResult: null });

    await expect(refreshCognitoTokens("ref")).rejects.toThrow("Token refresh failed");
  });

  it("sends REFRESH_TOKEN_AUTH flow", async () => {
    mockSend.mockResolvedValue({
      AuthenticationResult: { AccessToken: "tok", ExpiresIn: 3600 },
    });

    await refreshCognitoTokens("my-ref-tok");

    const command = mockSend.mock.calls[0][0];
    expect(command.input).toEqual(
      expect.objectContaining({
        AuthFlow: "REFRESH_TOKEN_AUTH",
        AuthParameters: { REFRESH_TOKEN: "my-ref-tok" },
      })
    );
  });

  it("propagates Cognito errors (NotAuthorizedException)", async () => {
    mockSend.mockRejectedValue(new Error("NotAuthorizedException: Token has been revoked"));

    await expect(refreshCognitoTokens("revoked")).rejects.toThrow("NotAuthorizedException");
  });
});
