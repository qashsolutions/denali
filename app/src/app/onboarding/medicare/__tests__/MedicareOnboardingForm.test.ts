import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * MedicareOnboardingForm — Pure Helper Tests (no React render)
 *
 * Tests the extracted submitMedicareAnswer() and healMedicareCookie()
 * functions in isolation. globalThis.fetch is stubbed per test.
 *
 * Node environment (no jsdom). No React. No router.
 * The "use client" directive is on the default export, not the named exports,
 * so these can be imported in a node test context.
 */

// next/navigation is imported by the module. Mock it so the module loads cleanly.
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn() })),
}));

// react hooks are imported by the module. Mock them so the module loads cleanly.
vi.mock("react", async (importOriginal) => {
  const original = await importOriginal<typeof import("react")>();
  return {
    ...original,
    useState: vi.fn((init: unknown) => [init, vi.fn()]),
    useEffect: vi.fn(),
  };
});

import {
  submitMedicareAnswer,
  healMedicareCookie,
} from "../MedicareOnboardingForm";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = mockFetch;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("submitMedicareAnswer", () => {
  it("calls /api/profile with PATCH, correct body for true, and credentials", async () => {
    const fakeResponse = new Response(JSON.stringify({ success: true }), {
      status: 200,
    });
    mockFetch.mockResolvedValue(fakeResponse);

    const result = await submitMedicareAnswer(true);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/profile");
    expect(init.method).toBe("PATCH");
    expect(init.credentials).toBe("include");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json"
    );
    expect(init.body).toBe(JSON.stringify({ is_on_medicare: true }));
    expect(result).toBe(fakeResponse);
  });

  it("calls /api/profile with PATCH and body is_on_medicare:false for false", async () => {
    const fakeResponse = new Response(JSON.stringify({ success: true }), {
      status: 200,
    });
    mockFetch.mockResolvedValue(fakeResponse);

    await submitMedicareAnswer(false);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ is_on_medicare: false }));
  });

  it("returns the fetch Response object directly", async () => {
    const fakeResponse = new Response(null, { status: 400 });
    mockFetch.mockResolvedValue(fakeResponse);

    const result = await submitMedicareAnswer(true);
    expect(result).toBe(fakeResponse);
  });
});

describe("healMedicareCookie", () => {
  it("calls /api/profile with credentials:include and no explicit method (GET)", async () => {
    const fakeResponse = new Response(JSON.stringify({ authenticated: true }), {
      status: 200,
    });
    mockFetch.mockResolvedValue(fakeResponse);

    const result = await healMedicareCookie();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/profile");
    expect(init.credentials).toBe("include");
    // No method override — browser defaults to GET
    expect((init as { method?: string }).method).toBeUndefined();
    expect(result).toBe(fakeResponse);
  });

  it("returns null when fetch throws (network error)", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await healMedicareCookie();

    expect(result).toBeNull();
  });

  it("returns the response even on a non-200 status (error handling is caller's job)", async () => {
    const fakeResponse = new Response(null, { status: 401 });
    mockFetch.mockResolvedValue(fakeResponse);

    const result = await healMedicareCookie();
    expect(result).toBe(fakeResponse);
  });
});
