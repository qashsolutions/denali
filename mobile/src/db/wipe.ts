/**
 * Account-deletion local wipe.
 *
 * Erases ALL on-device user data: every row in every table, every encrypted
 * report blob, and the auth tokens. This is a DELIBERATE, full erase invoked
 * only by the user's "Delete account" action — the append-only invariant
 * governs CORRECTIONS to health values (supersede, never UPDATE/DELETE), not a
 * user-initiated account deletion, which is the GDPR/HIPAA "right to delete".
 *
 * The DB file, its SQLCipher key, and the `schema_migrations` table are kept so
 * the live connection stays valid for a clean re-onboard if the user signs up
 * again — an empty encrypted DB holds no PHI. Each step is best-effort so a
 * single failure can't leave the wipe half-done from the caller's view; the
 * caller still performs the server-side account delete first.
 */

import { clearTokens } from "@/auth/tokenStore";
import { clearAllReportBlobs, clearBlobKeyCache } from "@/upload/blobStore";

import { openLocalDb } from "./open";

export async function wipeAllLocalData(): Promise<void> {
  // Fully best-effort: a failure in any one step must not strand the others.
  // The caller has already deleted the SERVER account (Cognito + rows) before
  // calling this, so on a transient on-device failure the safest outcome is to
  // clear as much local state as possible and never reject — leaving the user
  // stuck on a "try again" they can't complete (the server account is gone)
  // would be worse than a degraded best-effort wipe of encrypted-at-rest data.
  try {
    const db = await openLocalDb();
    // secure_delete zeroes freed pages in-place so deleted PHI leaves no
    // recoverable ciphertext in the SQLite free-list. It must be ON BEFORE the
    // DELETEs so their freed pages are zeroed (it has a write cost, so it is
    // scoped to this wipe connection, never the global open path).
    try {
      await db.execAsync("PRAGMA secure_delete = ON");
    } catch {
      // Pragma best-effort; rows are still deleted below regardless.
    }
    const tables = await db.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' ` +
        `AND name NOT LIKE 'sqlite_%' AND name != 'schema_migrations'`,
      [],
    );
    for (const t of tables) {
      try {
        // Quote the identifier (escape embedded quotes) — defense-in-depth
        // even though table names come from sqlite_master, not user input.
        await db.execAsync(`DELETE FROM "${t.name.replace(/"/g, '""')}"`);
      } catch {
        // Best-effort per table — keep clearing the rest.
      }
    }
    try {
      // VACUUM rebuilds a compact DB with no free pages holding old content.
      await db.execAsync("VACUUM");
    } catch {
      // Compaction is best-effort; rows are already zeroed by secure_delete.
    }
    try {
      // CRITICAL for a privacy wipe: in WAL mode every write above (DELETEs +
      // VACUUM's full rebuild) lands in the -wal file, NOT the main DB, and
      // SQLite only auto-checkpoints once the WAL crosses ~1000 pages — a small
      // DB may never reach that, so the pre-wipe encrypted frames would sit on
      // disk indefinitely (and the DB key is retained by design). TRUNCATE
      // flushes the WAL into the main DB and shrinks the -wal file to zero,
      // physically removing those frames. Verified on-device: without this the
      // -wal stayed ~1.3MB after a full account delete + app restart.
      await db.execAsync("PRAGMA wal_checkpoint(TRUNCATE)");
    } catch {
      // Best-effort.
    }
  } catch {
    // DB open / enumerate failed — still clear blobs + tokens below.
  }
  try {
    clearAllReportBlobs();
  } catch {
    // Best-effort.
  }
  try {
    // Drop the in-memory derived AES blob key so no key material lingers after
    // the encrypted blobs it would unlock have been erased.
    clearBlobKeyCache();
  } catch {
    // Best-effort.
  }
  try {
    await clearTokens();
  } catch {
    // Best-effort.
  }
}
