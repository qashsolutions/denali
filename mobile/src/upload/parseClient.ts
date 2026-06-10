/**
 * Phase 1 mobile — `/api/parse-report` client wrapper.
 *
 * Thin shim over the injected `ApiClient` that hides the path + body shape
 * from screens. Lets review-screen tests mock just the ApiClient without
 * also mocking the URL string.
 *
 * Wave 2 / mobile-upload-parse-builder.
 */

import type { ParseReportRequest } from "@/api/routeContracts";
import type { ApiClient } from "@/contracts";

import type { ExtractedObservation, ParseReportResponse, ReportTypeWire } from "./types";

const PARSE_REPORT_PATH = "/api/parse-report";

export interface ParseReportArgs {
  reportType: ReportTypeWire;
  extractedText: string;
  locale?: string;
}

/**
 * Map `ParseReportArgs` → the snake_case `ParseReportRequest` wire body the
 * route expects — see src/api/routeContracts.ts. Pure so the pinning test
 * can assert the shape without a live ApiClient.
 */
export function buildParseReportBody(args: ParseReportArgs): ParseReportRequest {
  return {
    report_type: args.reportType,
    extracted_text: args.extractedText,
    ...(args.locale != null ? { locale: args.locale } : {}),
  };
}

/**
 * POST extracted text to the parse-report endpoint and return the parsed
 * envelope.
 *
 * The route is transient on the server (zero RDS writes — see
 * `app/src/app/api/parse-report/__tests__/route.test.ts` for the spy proof).
 * The consumer (UploadScreen) MUST also enforce the `health_data_ai`
 * consent gate client-side before calling this — server-side gate is a
 * backup, not a primary defence.
 */
export async function parseReport(
  api: ApiClient,
  args: ParseReportArgs,
): Promise<ParseReportResponse> {
  return await api.apiPost<ParseReportResponse>(
    PARSE_REPORT_PATH,
    buildParseReportBody(args),
  );
}

export type { ExtractedObservation, ParseReportResponse, ReportTypeWire };
