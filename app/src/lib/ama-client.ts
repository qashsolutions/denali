/**
 * AMA Intelligent Platform API Client
 *
 * DISABLED: AMA API integration is temporarily disabled.
 * The CPTAPI_Zip endpoint was returning 500 errors during testing.
 *
 * We are using local Medicare code mappings instead (medicare-codes.ts, medicare-lookup.ts).
 * This file is preserved for future use when KBAPI access is needed for
 * CPT guidance articles and detailed code descriptions.
 *
 * To re-enable:
 * 1. Set AMA_CLIENT_ID and AMA_CLIENT_SECRET environment variables
 * 2. Uncomment the implementation below
 * 3. Update API routes in /api/ama/ to use this client
 *
 * OAuth2 Client Credentials flow with token caching.
 * Supports CPTAPI_Zip and KBAPI endpoints.
 */

// =============================================================================
// TYPE DEFINITIONS (kept for reference)
// =============================================================================

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface CPTCode {
  code: string;
  shortDescription?: string;
  longDescription?: string;
  category?: string;
}

export interface CPTSearchResult {
  codes: CPTCode[];
  total: number;
}

export interface ArticleSummary {
  id: string;
  title: string;
  summary?: string;
  cptCodes?: string[];
  lastUpdated?: string;
}

export interface ArticleDetail {
  id: string;
  title: string;
  content: string;
  cptCodes?: string[];
  lastUpdated?: string;
  references?: string[];
}

export interface ArticleSearchResult {
  articles: ArticleSummary[];
  total: number;
}

export interface AMAClientConfig {
  clientId: string;
  clientSecret: string;
  tokenUrl?: string;
  apiBaseUrl?: string;
}

// =============================================================================
// DISABLED IMPLEMENTATION
// =============================================================================

/*
 * AMA API Client implementation is disabled.
 * See medicare-codes.ts and medicare-lookup.ts for local CPT/ICD-10 lookups.
 *
 * Uncomment below to re-enable AMA API integration.
 */

/*
// Token cache - in production, use Redis or similar
let cachedToken: { token: string; expiresAt: number } | null = null;

export class AMAClient {
  private clientId: string;
  private clientSecret: string;
  private tokenUrl: string;
  private apiBaseUrl: string;

  constructor(config: AMAClientConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.tokenUrl = config.tokenUrl || "https://api-platform.ama-assn.org/token";
    this.apiBaseUrl = config.apiBaseUrl || "https://api-platform.ama-assn.org";
  }

  async getToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
      return cachedToken.token;
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");

    const response = await fetch(this.tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      const error = await response.text();
      throw new AMAAPIError(
        `Failed to get access token: ${response.status}`,
        response.status,
        error
      );
    }

    const data: TokenResponse = await response.json();

    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    return data.access_token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getToken();

    const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After") || "60";
      throw new AMAAPIError(
        `Rate limited. Retry after ${retryAfter} seconds`,
        429,
        "RATE_LIMITED"
      );
    }

    if (!response.ok) {
      const error = await response.text();
      throw new AMAAPIError(
        `API request failed: ${response.status}`,
        response.status,
        error
      );
    }

    return response.json();
  }

  async getCPTReleases(): Promise<{ releases: { version: string; releaseDate: string }[] }> {
    return this.request("/cpt-zip/1.0.0/releases");
  }

  async getCPTDataFile(): Promise<ArrayBuffer> {
    const token = await this.getToken();

    const response = await fetch(`${this.apiBaseUrl}/cpt-zip/1.0.0/files`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new AMAAPIError(
        `Failed to download CPT data: ${response.status}`,
        response.status
      );
    }

    return response.arrayBuffer();
  }

  async searchArticles(params: {
    keyword?: string;
    cptCode?: string;
    limit?: number;
    offset?: number;
  }): Promise<ArticleSearchResult> {
    const searchParams = new URLSearchParams();

    if (params.keyword) {
      searchParams.append("keyword", params.keyword);
    }
    if (params.cptCode) {
      searchParams.append("cptCode", params.cptCode);
    }
    if (params.limit) {
      searchParams.append("limit", params.limit.toString());
    }
    if (params.offset) {
      searchParams.append("offset", params.offset.toString());
    }

    const queryString = searchParams.toString();
    const endpoint = `/kb/1.0.0/articles/summary${queryString ? `?${queryString}` : ""}`;

    return this.request<ArticleSearchResult>(endpoint);
  }

  async getArticle(id: string): Promise<ArticleDetail> {
    return this.request<ArticleDetail>(`/kb/1.0.0/articles/${encodeURIComponent(id)}`);
  }

  async searchCPT(params: {
    query: string;
    limit?: number;
  }): Promise<CPTSearchResult> {
    try {
      const articles = await this.searchArticles({
        keyword: params.query,
        limit: params.limit || 10,
      });

      const codes: CPTCode[] = [];
      const seenCodes = new Set<string>();

      for (const article of articles.articles) {
        if (article.cptCodes) {
          for (const code of article.cptCodes) {
            if (!seenCodes.has(code)) {
              seenCodes.add(code);
              codes.push({
                code,
                shortDescription: article.title,
                longDescription: article.summary,
              });
            }
          }
        }
      }

      return {
        codes,
        total: codes.length,
      };
    } catch (error) {
      console.error("CPT search failed:", error);
      return {
        codes: [],
        total: 0,
      };
    }
  }
}
*/

/**
 * Custom error class for AMA API errors
 */
export class AMAAPIError extends Error {
  status: number;
  details?: string;

  constructor(message: string, status: number, details?: string) {
    super(message);
    this.name = "AMAAPIError";
    this.status = status;
    this.details = details;
  }
}

/**
 * Stub AMA client that returns service unavailable
 * Use medicare-lookup.ts for CPT/ICD-10 lookups instead
 */
export class AMAClient {
  constructor(_config: AMAClientConfig) {
    // No-op - AMA API is disabled
  }

  async getToken(): Promise<string> {
    throw new AMAAPIError("AMA API is disabled. Use local Medicare code lookups.", 503);
  }

  async getCPTReleases(): Promise<{ releases: { version: string; releaseDate: string }[] }> {
    throw new AMAAPIError("AMA API is disabled. Use local Medicare code lookups.", 503);
  }

  async getCPTDataFile(): Promise<ArrayBuffer> {
    throw new AMAAPIError("AMA API is disabled. Use local Medicare code lookups.", 503);
  }

  async searchArticles(_params: {
    keyword?: string;
    cptCode?: string;
    limit?: number;
    offset?: number;
  }): Promise<ArticleSearchResult> {
    throw new AMAAPIError("AMA API is disabled. Use local Medicare code lookups.", 503);
  }

  async getArticle(_id: string): Promise<ArticleDetail> {
    throw new AMAAPIError("AMA API is disabled. Use local Medicare code lookups.", 503);
  }

  async searchCPT(_params: { query: string; limit?: number }): Promise<CPTSearchResult> {
    throw new AMAAPIError("AMA API is disabled. Use local Medicare code lookups.", 503);
  }
}

/**
 * Create AMA client - returns stub that throws errors
 * @deprecated Use medicare-lookup.ts for CPT/ICD-10 lookups
 */
export function createAMAClient(): AMAClient {
  console.warn("AMA API is disabled. Use medicare-lookup.ts for CPT/ICD-10 lookups.");
  return new AMAClient({
    clientId: "",
    clientSecret: "",
  });
}

/**
 * Get AMA client singleton - returns stub that throws errors
 * @deprecated Use medicare-lookup.ts for CPT/ICD-10 lookups
 */
let amaClientInstance: AMAClient | null = null;

export function getAMAClient(): AMAClient {
  if (!amaClientInstance) {
    amaClientInstance = createAMAClient();
  }
  return amaClientInstance;
}
