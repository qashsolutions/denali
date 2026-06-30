/**
 * Zero-Knowledge Backup API (mobile; decision D16, docs/design/zk-backup-v1.md §5)
 *
 * PUT    /api/backup — store the latest encrypted backup (last-write-wins)
 * GET    /api/backup — return the latest encrypted backup (404 if none)
 * DELETE /api/backup — delete the user's backup (opt-out / account deletion)
 *
 * ZERO-KNOWLEDGE: the server stores ONLY opaque hex ciphertext + wrapping
 * metadata + a non-secret manifest. It NEVER receives the recovery key or the
 * plaintext, and NEVER decodes/decrypts. This is the sanctioned exception to
 * the original "no cloud backup" clause of invariant 6 (superseded by D16);
 * invariant 1's spirit — no *readable* server-side health data — is preserved.
 *
 * Auth via Cognito JWT (getAuthUser); storage in RDS (BAA-covered), scoped by
 * `WHERE user_id = $1`. Mobile is the only caller.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query, transaction } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { withMetrics } from "@/lib/metrics";
import { AUTH } from "@/config/messages";

// Generous cap (~25 MB of binary as hex) so a runaway/abusive upload can't
// fill the row; a real health-record export is far smaller.
const MAX_CIPHERTEXT_HEX_CHARS = 50_000_000;

const HEX_FIELDS = [
  "kekSalt",
  "wrapNonce",
  "wrappedDek",
  "dataNonce",
  "ciphertext",
] as const;

const ERR_INVALID = "Invalid backup payload.";
const ERR_TOO_LARGE = "Backup payload too large.";
const ERR_SAVE = "Could not save your backup.";
const ERR_LOAD = "Could not load your backup.";
const ERR_NOT_FOUND = "No backup found.";

const isHex = (s: unknown): s is string =>
  typeof s === "string" && s.length > 0 && s.length % 2 === 0 && /^[0-9a-f]+$/i.test(s);

interface WireBackup {
  version: number;
  kekSalt: string;
  wrapNonce: string;
  wrappedDek: string;
  dataNonce: string;
  ciphertext: string;
  manifest: Record<string, unknown>;
}

/** Server-side defensive validation. The server never decrypts — it only
 *  confirms the shape is opaque hex + a manifest object before storing. */
function parseWireBackup(body: unknown): WireBackup | null {
  if (typeof body !== "object" || body === null) return null;
  const obj = body as Record<string, unknown>;
  if (typeof obj.version !== "number") return null;
  if (typeof obj.manifest !== "object" || obj.manifest === null) return null;
  for (const field of HEX_FIELDS) {
    if (!isHex(obj[field])) return null;
  }
  return {
    version: obj.version,
    kekSalt: obj.kekSalt as string,
    wrapNonce: obj.wrapNonce as string,
    wrappedDek: obj.wrappedDek as string,
    dataNonce: obj.dataNonce as string,
    ciphertext: obj.ciphertext as string,
    manifest: obj.manifest as Record<string, unknown>,
  };
}

async function _PUT(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: AUTH.SIGN_IN_REQUIRED }, { status: 401 });
    }

    const wire = parseWireBackup(await request.json().catch(() => null));
    if (!wire) {
      return NextResponse.json({ error: ERR_INVALID }, { status: 400 });
    }
    if (wire.ciphertext.length > MAX_CIPHERTEXT_HEX_CHARS) {
      return NextResponse.json({ error: ERR_TOO_LARGE }, { status: 413 });
    }

    const sizeBytes = Math.floor(wire.ciphertext.length / 2);

    // Last-write-wins: replace any prior snapshot for this user atomically.
    await transaction(async (q) => {
      await q(`DELETE FROM backup_blobs WHERE user_id = $1`, [user.userId]);
      await q(
        `INSERT INTO backup_blobs
           (user_id, version, kek_salt, wrap_nonce, wrapped_dek, data_nonce,
            ciphertext, manifest, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          user.userId,
          wire.version,
          wire.kekSalt,
          wire.wrapNonce,
          wire.wrappedDek,
          wire.dataNonce,
          wire.ciphertext,
          JSON.stringify(wire.manifest),
          sizeBytes,
        ],
      );
    });

    logAudit("BACKUP_UPLOADED", {
      userId: user.userId,
      resourceType: "backup",
      metadata: { version: wire.version, sizeBytes },
      request,
    }).catch(() => {});

    return NextResponse.json({ success: true, sizeBytes });
  } catch (error) {
    console.error("[Backup] PUT error:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: ERR_SAVE }, { status: 500 });
  }
}

async function _GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: AUTH.SIGN_IN_REQUIRED }, { status: 401 });
    }

    const result = await query<{
      version: number;
      kek_salt: string;
      wrap_nonce: string;
      wrapped_dek: string;
      data_nonce: string;
      ciphertext: string;
      manifest: Record<string, unknown>;
    }>(
      `SELECT version, kek_salt, wrap_nonce, wrapped_dek, data_nonce, ciphertext, manifest
         FROM backup_blobs
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [user.userId],
    );

    const row = result.rows[0];
    if (!row) {
      return NextResponse.json({ error: ERR_NOT_FOUND }, { status: 404 });
    }

    logAudit("BACKUP_DOWNLOADED", {
      userId: user.userId,
      resourceType: "backup",
      metadata: { version: row.version },
      request,
    }).catch(() => {});

    return NextResponse.json({
      version: row.version,
      kekSalt: row.kek_salt,
      wrapNonce: row.wrap_nonce,
      wrappedDek: row.wrapped_dek,
      dataNonce: row.data_nonce,
      ciphertext: row.ciphertext,
      manifest: row.manifest,
    });
  } catch (error) {
    console.error("[Backup] GET error:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: ERR_LOAD }, { status: 500 });
  }
}

async function _DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: AUTH.SIGN_IN_REQUIRED }, { status: 401 });
    }

    await query(`DELETE FROM backup_blobs WHERE user_id = $1`, [user.userId]);

    logAudit("BACKUP_DELETED", {
      userId: user.userId,
      resourceType: "backup",
      request,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Backup] DELETE error:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: ERR_SAVE }, { status: 500 });
  }
}

export const PUT = withMetrics(_PUT, "/api/backup");
// POST is the mobile-callable alias for PUT: the mobile ApiClient verb set is
// GET/POST/PATCH/DELETE (no PUT), mirroring the consent route's PATCH alias.
export const POST = withMetrics(_PUT, "/api/backup");
export const GET = withMetrics(_GET, "/api/backup");
export const DELETE = withMetrics(_DELETE, "/api/backup");
