/**
 * FHIR HTTP Client
 *
 * Makes authenticated requests to CMS Blue Button 2.0 FHIR API.
 * Handles pagination, rate limiting, and error responses.
 */

import { API_CONFIG } from "@/config";

/** CMS Section I.3: Purpose of data request */
export type RequestPurpose =
  | "treatment"
  | "coverage-determination"
  | "appeal"
  | "patient-request";

export class FhirError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string
  ) {
    super(message);
    this.name = "FhirError";
  }
}

/**
 * Make an authenticated GET request to the FHIR API.
 *
 * Uses redirect: 'manual' to prevent Node.js fetch (undici) from stripping
 * the Authorization header on redirects. Blue Button API may redirect
 * requests, and the default fetch behavior drops auth headers on redirect.
 *
 * @param purpose CMS Section I.3 — purpose code for data request tagging
 */
export async function fhirGet<T>(
  path: string,
  accessToken: string,
  purpose: RequestPurpose = "patient-request"
): Promise<T> {
  const { blueButton } = API_CONFIG;
  let url = `${blueButton.baseUrl}/${blueButton.version}/fhir/${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/fhir+json",
    "X-Request-Purpose": purpose,
  };

  // Follow up to 5 redirects manually to preserve Authorization header
  for (let i = 0; i < 5; i++) {
    const res = await fetch(url, { headers, redirect: "manual" });

    // Handle redirects — re-send with Authorization header preserved
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("Location");
      if (!location) {
        throw new FhirError(`Redirect ${res.status} without Location header`, res.status);
      }
      // Resolve relative redirects
      url = location.startsWith("http") ? location : new URL(location, url).toString();
      console.log("[FHIR client] Following redirect to:", url);
      continue;
    }

    if (res.status === 401) {
      const body401 = await res.text();
      console.error("[FHIR client] 401 response from:", url, "body:", body401);
      throw new FhirError("Token expired or invalid", 401, body401);
    }

    if (res.status === 429) {
      throw new FhirError("Rate limited by CMS", 429);
    }

    if (!res.ok) {
      const body = await res.text();
      throw new FhirError(`FHIR API error: ${res.status}`, res.status, body);
    }

    return res.json();
  }

  throw new FhirError("Too many redirects", 310);
}

/**
 * Fetch a FHIR Bundle with pagination support.
 * Blue Button uses _count and startIndex for pagination.
 */
export async function fhirGetBundle<T>(
  path: string,
  accessToken: string,
  maxPages: number = 5,
  purpose: RequestPurpose = "patient-request"
): Promise<T[]> {
  const entries: T[] = [];
  let startIndex = 0;
  const pageSize = 50;
  let page = 0;

  while (page < maxPages) {
    const separator = path.includes("?") ? "&" : "?";
    const paginatedPath = `${path}${separator}_count=${pageSize}&startIndex=${startIndex}`;

    const bundle = await fhirGet<FhirBundle<T>>(paginatedPath, accessToken, purpose);

    if (bundle.entry) {
      for (const entry of bundle.entry) {
        entries.push(entry.resource);
      }
    }

    // Check if there are more pages
    const total = bundle.total ?? 0;
    startIndex += pageSize;
    page++;

    if (startIndex >= total || !bundle.entry || bundle.entry.length < pageSize) {
      break;
    }
  }

  return entries;
}

// Minimal FHIR Bundle type
interface FhirBundle<T> {
  resourceType: "Bundle";
  total?: number;
  entry?: Array<{ resource: T }>;
}
