import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /onboarding/medicare — Server Component Page Tests
 *
 * The page is a thin async server component:
 *   - Unauthenticated → redirect("/")  [throws via mockRedirect]
 *   - is_on_medicare = true  → returns JSX with alreadyAnswered={true}
 *   - is_on_medicare = false → returns JSX with alreadyAnswered={true}
 *   - is_on_medicare = null  → returns JSX with alreadyAnswered={false}
 *
 * In the node test environment React.createElement produces element objects
 * without invoking the component function. We inspect the returned element's
 * props directly rather than checking if the component was called.
 */

// --- Mocks ---

const mockGetAuthUserFromServerContext = vi.fn();
vi.mock("@/lib/auth-server", () => ({
  getAuthUserFromServerContext: (...args: unknown[]) =>
    mockGetAuthUserFromServerContext(...args),
  getAuthUser: vi.fn(),
  initiateCognitoAuth: vi.fn(),
  isEmailAllowed: vi.fn(() => true),
}));

const mockQuery = vi.fn();
vi.mock("@/lib/db", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

const mockRedirect = vi.fn((url: string): never => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

// Mock MedicareOnboardingForm to avoid "use client" directive issues in
// a node test environment. The mock returns a plain object so the page
// can be imported and called without React client machinery.
vi.mock("../MedicareOnboardingForm", () => ({
  default: vi.fn((props: unknown) => props),
}));

import MedicareOnboardingPage from "../page";

const MOCK_USER = { userId: "user-abc", email: "test@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
});

// Helper: extract props from a React element (either a JSX element object
// produced by React.createElement, or a plain object if the mock returned one).
function getProps(element: unknown): Record<string, unknown> {
  if (element && typeof element === "object") {
    const el = element as Record<string, unknown>;
    // React element: { type, props, ... }
    if (el.props && typeof el.props === "object") {
      return el.props as Record<string, unknown>;
    }
  }
  return {};
}

describe("MedicareOnboardingPage — server-side routing", () => {
  it("renders with alreadyAnswered=true when is_on_medicare=true", async () => {
    mockGetAuthUserFromServerContext.mockResolvedValue(MOCK_USER);
    mockQuery.mockResolvedValue({ rows: [{ is_on_medicare: true }], rowCount: 1 });

    const result = await MedicareOnboardingPage();

    // No server-side redirect — form handles /app/chat redirect via useEffect
    expect(mockRedirect).not.toHaveBeenCalled();
    // The page resolves to something (not null/undefined)
    expect(result).toBeTruthy();
    // Props inspection: alreadyAnswered should be true (is_on_medicare !== null)
    const props = getProps(result);
    expect(props.alreadyAnswered).toBe(true);
  });

  it("renders with alreadyAnswered=true when is_on_medicare=false", async () => {
    mockGetAuthUserFromServerContext.mockResolvedValue(MOCK_USER);
    mockQuery.mockResolvedValue({ rows: [{ is_on_medicare: false }], rowCount: 1 });

    const result = await MedicareOnboardingPage();

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
    const props = getProps(result);
    expect(props.alreadyAnswered).toBe(true);
  });

  it("renders with alreadyAnswered=false when is_on_medicare=null (show the question)", async () => {
    mockGetAuthUserFromServerContext.mockResolvedValue(MOCK_USER);
    mockQuery.mockResolvedValue({ rows: [{ is_on_medicare: null }], rowCount: 1 });

    const result = await MedicareOnboardingPage();

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
    const props = getProps(result);
    expect(props.alreadyAnswered).toBe(false);
  });

  it("renders with alreadyAnswered=false when DB row is missing (null fallback)", async () => {
    mockGetAuthUserFromServerContext.mockResolvedValue(MOCK_USER);
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const result = await MedicareOnboardingPage();

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
    const props = getProps(result);
    expect(props.alreadyAnswered).toBe(false);
  });

  it("calls redirect('/') when user is unauthenticated", async () => {
    mockGetAuthUserFromServerContext.mockResolvedValue(null);

    let caught: Error | null = null;
    try {
      await MedicareOnboardingPage();
    } catch (e) {
      caught = e as Error;
    }

    expect(mockRedirect).toHaveBeenCalledWith("/");
    expect(caught?.message).toContain("NEXT_REDIRECT:/");
    // DB should never be queried for an unauthenticated user
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
