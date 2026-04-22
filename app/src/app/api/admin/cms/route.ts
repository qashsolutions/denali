/**
 * Admin CMS API Route
 *
 * GET  /api/admin/cms  — load all CMS content tables (admin only)
 * PATCH /api/admin/cms — update a row in a CMS table (admin only)
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { AUTH, VALIDATION } from "@/config/messages";

const ALLOWED_TABLES = ["site_settings", "landing_content", "pricing_plans", "testimonials"] as const;
type AllowedTable = typeof ALLOWED_TABLES[number];

/** Allowed columns per table — prevents SQL injection via column name interpolation */
const ALLOWED_COLUMNS: Record<AllowedTable, Set<string>> = {
  site_settings: new Set(["key", "value", "description"]),
  landing_content: new Set(["section_key", "heading", "subheading", "body", "cta_text", "cta_url", "display_order", "visible"]),
  pricing_plans: new Set(["name", "price", "description", "features", "cta_text", "display_order", "highlighted", "visible"]),
  testimonials: new Set(["quote", "author", "role", "visible"]),
};

async function requireAdmin(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return null;
  const result = await query<{ is_admin: boolean }>(
    `SELECT is_admin FROM users WHERE id = $1`,
    [user.userId]
  );
  if (!result.rows[0]?.is_admin) return null;
  return user;
}

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: AUTH.ADMIN_ONLY }, { status: 403 });

  const [settings, sections, pricing, testimonials] = await Promise.all([
    query(`SELECT * FROM site_settings ORDER BY key`),
    query(`SELECT * FROM landing_content ORDER BY display_order`),
    query(`SELECT * FROM pricing_plans ORDER BY display_order`),
    query(`SELECT * FROM testimonials ORDER BY created_at DESC`),
  ]);

  return NextResponse.json({
    settings: settings.rows,
    sections: sections.rows,
    pricing: pricing.rows,
    testimonials: testimonials.rows,
  });
}

export async function PATCH(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: AUTH.ADMIN_ONLY }, { status: 403 });

  const { table, id, data } = await request.json() as {
    table: string;
    id: string;
    data: Record<string, unknown>;
  };

  if (!ALLOWED_TABLES.includes(table as AllowedTable)) {
    return NextResponse.json({ error: VALIDATION.INVALID_TABLE }, { status: 400 });
  }

  // Build SET clause — validate column names against allowlist to prevent SQL injection
  const allowedCols = ALLOWED_COLUMNS[table as AllowedTable];
  const keys = Object.keys(data).filter((k) => allowedCols.has(k));
  if (keys.length === 0) return NextResponse.json({ ok: true });

  const invalidKeys = Object.keys(data).filter((k) => !allowedCols.has(k));
  if (invalidKeys.length > 0) {
    return NextResponse.json({ error: VALIDATION.INVALID_COLUMNS(invalidKeys) }, { status: 400 });
  }

  const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
  const values = [...Object.values(data), id];

  await query(
    `UPDATE ${table} SET ${setClauses} WHERE id = $${values.length}`,
    values
  );

  return NextResponse.json({ ok: true });
}
