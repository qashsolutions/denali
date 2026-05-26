import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/health — Unit Tests
 *
 * Tests ALB health check: 200 when RDS reachable, 503 when not.
 */

const mockQuery = vi.fn();
vi.mock("@/lib/db", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

vi.mock("@/lib/metrics", () => ({
  withMetrics: (handler: Function) => handler,
}));

import { NextRequest } from "next/server";
import { GET } from "../route";

const req = new NextRequest("http://localhost:3000/api/health");

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with status ok when RDS is reachable", async () => {
    mockQuery.mockResolvedValue({ rows: [{ "?column?": 1 }] });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(mockQuery).toHaveBeenCalledWith("SELECT 1");
  });

  it("returns 503 with degraded status when RDS is unreachable", async () => {
    mockQuery.mockRejectedValue(new Error("connect ETIMEDOUT"));

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.reason).toBe("database unreachable");
  });

  it("returns 503 on connection refused", async () => {
    mockQuery.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const res = await GET(req);
    expect(res.status).toBe(503);
  });

  it("returns 503 on authentication failure", async () => {
    mockQuery.mockRejectedValue(new Error("password authentication failed"));

    const res = await GET(req);
    expect(res.status).toBe(503);
  });
});
