/**
 * Block Scanner Route
 *
 * Returns 404 for WordPress/CMS scanner bots probing common exploit paths.
 * These bots look for unprotected WordPress, Drupal, etc. installations.
 */

import { NextResponse } from "next/server";

export async function GET() {
  return new NextResponse(null, { status: 404 });
}

export async function POST() {
  return new NextResponse(null, { status: 404 });
}
