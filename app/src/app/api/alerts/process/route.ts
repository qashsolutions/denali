/**
 * Alert Batch Processing API
 * POST /api/alerts/process
 *
 * Called by EventBridge → Lambda daily. Authenticates via X-Alert-Secret header.
 * Runs the alert engine to check conditions and send emails.
 */

import { NextRequest, NextResponse } from "next/server";
import { processAlerts } from "@/lib/alerts/engine";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-alert-secret");
  const expectedSecret = process.env.ALERT_PROCESS_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = (body as { dryRun?: boolean }).dryRun === true;

    const result = await processAlerts(dryRun);

    return NextResponse.json({
      ...result,
      dryRun,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Alerts] Process error:", error);
    return NextResponse.json(
      { error: "Alert processing failed" },
      { status: 500 }
    );
  }
}
