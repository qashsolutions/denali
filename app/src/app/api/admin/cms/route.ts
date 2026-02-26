/**
 * Admin CMS API Route
 *
 * GET  /api/admin/cms  — load all CMS content tables (admin only)
 * PATCH /api/admin/cms — update a row in a CMS table (admin only)
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";

const ALLOWED_TABLES = ["site_settings", "landing_content", "pricing_plans", "testimonials"] as const;
type AllowedTable = typeof ALLOWED_TABLES[number];

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
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { table, id, data } = await request.json() as {
    table: string;
    id: string;
    data: Record<string, unknown>;
  };

  if (!ALLOWED_TABLES.includes(table as AllowedTable)) {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }

  // Build SET clause from data keys (safe — keys come from server code)
  const keys = Object.keys(data);
  if (keys.length === 0) return NextResponse.json({ ok: true });

  const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const values = [...Object.values(data), id];

  await query(
    `UPDATE ${table} SET ${setClauses} WHERE id = $${values.length}`,
    values
  );

  return NextResponse.json({ ok: true });
}
