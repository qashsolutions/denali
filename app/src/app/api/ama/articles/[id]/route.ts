import { NextRequest, NextResponse } from "next/server";
import { getAMAClient, AMAAPIError } from "@/lib/ama-client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Get specific article by ID
 *
 * GET /api/ama/articles/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Article ID is required" },
        { status: 400 }
      );
    }

    const client = getAMAClient();
    const article = await client.getArticle(id);

    // Log API usage (no PII)
    console.log(`[AMA API] Article fetch: id="${id}"`);

    return NextResponse.json({ article });
  } catch (error) {
    console.error("[AMA API] Article fetch error:", error);

    if (error instanceof AMAAPIError) {
      if (error.status === 404) {
        return NextResponse.json(
          { error: "Article not found" },
          { status: 404 }
        );
      }

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
