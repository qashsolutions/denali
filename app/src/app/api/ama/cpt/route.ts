import { NextRequest, NextResponse } from "next/server";
import { getAMAClient, AMAAPIError } from "@/lib/ama-client";

/**
 * Search CPT codes by keyword or code
 *
 * GET /api/ama/cpt?code=99213
 * GET /api/ama/cpt?keyword=evaluation
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const keyword = searchParams.get("keyword");
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    if (!code && !keyword) {
      return NextResponse.json(
        { error: "Either 'code' or 'keyword' query parameter is required" },
        { status: 400 }
      );
    }

    const client = getAMAClient();

    // Search using the query
    const query = code || keyword || "";
    const result = await client.searchCPT({ query, limit });

    // Log API usage (no PII)
    console.log(`[AMA API] CPT search: query="${query}", results=${result.total}`);

    return NextResponse.json({
      codes: result.codes,
      total: result.total,
      query,
    });
  } catch (error) {
    console.error("[AMA API] CPT search error:", error);

    if (error instanceof AMAAPIError) {
      // Handle rate limiting
      if (error.status === 429) {
        return NextResponse.json(
          {
            error: "Rate limit exceeded. Please try again later.",
            retryAfter: 60,
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status }
      );
    }

    // Check if AMA credentials are not configured
    if (error instanceof Error && error.message.includes("environment variables")) {
      return NextResponse.json(
        {
          error: "AMA API not configured",
          message: "CPT code lookup is not available in this environment",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
