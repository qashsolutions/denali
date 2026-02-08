/**
 * FHIR HTTP Client
 *
 * Makes authenticated requests to CMS Blue Button 2.0 FHIR API.
 * Handles pagination, rate limiting, and error responses.
 */

import { API_CONFIG } from "@/config";

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
 */
export async function fhirGet<T>(
  path: string,
  accessToken: string
): Promise<T> {
  const { blueButton } = API_CONFIG;
  const url = `${blueButton.baseUrl}/${blueButton.version}/fhir/${path}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/fhir+json",
    },
  });

  if (res.status === 401) {
    throw new FhirError("Token expired or invalid", 401);
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

/**
 * Fetch a FHIR Bundle with pagination support.
 * Blue Button uses _count and startIndex for pagination.
 */
export async function fhirGetBundle<T>(
  path: string,
  accessToken: string,
  maxPages: number = 5
): Promise<T[]> {
  const entries: T[] = [];
  let startIndex = 0;
  const pageSize = 50;
  let page = 0;

  while (page < maxPages) {
    const separator = path.includes("?") ? "&" : "?";
    const paginatedPath = `${path}${separator}_count=${pageSize}&startIndex=${startIndex}`;

    const bundle = await fhirGet<FhirBundle<T>>(paginatedPath, accessToken);

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
