import { NextRequest, NextResponse } from "next/server";
import { getAMAClient, AMAAPIError } from "@/lib/ama-client";

/**
 * Search Knowledge Base articles
 *
 * GET /api/ama/articles?keyword=99213
 * GET /api/ama/articles?cptCode=99213
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const keyword = searchParams.get("keyword");
    const cptCode = searchParams.get("cptCode");
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    if (!keyword && !cptCode) {
      return NextResponse.json(
        { error: "Either 'keyword' or 'cptCode' query parameter is required" },
        { status: 400 }
      );
    }

    const client = getAMAClient();

    const result = await client.searchArticles({
      keyword: keyword || undefined,
      cptCode: cptCode || undefined,
      limit,
      offset,
    });

    // Log API usage (no PII)
    console.log(
      `[AMA API] Articles search: keyword="${keyword || ""}", cptCode="${cptCode || ""}", results=${result.total}`
    );

    return NextResponse.json({
      articles: result.articles,
      total: result.total,
      query: { keyword, cptCode },
      pagination: {
        limit,
        offset,
        hasMore: offset + result.articles.length < result.total,
      },
    });
  } catch (error) {
    console.error("[AMA API] Articles search error:", error);

    if (error instanceof AMAAPIError) {
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

    if (error instanceof Error && error.message.includes("environment variables")) {
      return NextResponse.json(
        {
          error: "AMA API not configured",
          message: "Knowledge Base lookup is not available in this environment",
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
