/**
 * chat_messages DAL — owned by mobile-local-data-modeler (Wave 1).
 *
 * Phase-1 chat is local-only by invariant 1 (no server-side persistence).
 * The mobile app writes user/assistant/system turns here; the server's
 * `messages` / `conversations` tables remain untouched under the
 * `X-Client-Type: mobile` branch.
 *
 * Append-only: insertChatMessage only. A user "editing" a sent message
 * means inserting a new row; the original stays.
 *
 * Contract: mobile/src/contracts/LocalDataDAL.ts (frozen).
 */

import type {
  ChatMessageInsertInput,
  ChatMessageRow,
} from "@/contracts/LocalDataDAL";
import type { SqliteAdapter, SqliteParam } from "../types";
import { uuidv4 } from "../uuid";

const COLUMNS = "id, role, content, created_at, session_id";

export async function insertChatMessage(
  db: SqliteAdapter,
  input: ChatMessageInsertInput,
): Promise<{ id: string }> {
  const id = input.id ?? uuidv4();
  const created_at = input.created_at ?? new Date().toISOString();
  const params: ReadonlyArray<SqliteParam> = [
    id,
    input.role,
    input.content,
    created_at,
    input.session_id,
  ];
  await db.runAsync(
    `INSERT INTO chat_messages (${COLUMNS})
     VALUES (?, ?, ?, ?, ?)`,
    params,
  );
  return { id };
}

export async function listChatMessages(
  db: SqliteAdapter,
  sessionId: string | null,
  limit?: number,
): Promise<ChatMessageRow[]> {
  const limitSql =
    limit && Number.isFinite(limit) && limit > 0
      ? ` LIMIT ${Math.floor(limit)}`
      : "";

  // `session_id IS NULL` vs `session_id = ?` need different SQL because
  // SQLite's `= NULL` never matches. The chat surface in Pass 2 may use
  // null sessions for one-offs.
  if (sessionId === null) {
    return db.getAllAsync<ChatMessageRow>(
      `SELECT ${COLUMNS} FROM chat_messages
       WHERE session_id IS NULL
       ORDER BY created_at ASC${limitSql}`,
      [],
    );
  }
  return db.getAllAsync<ChatMessageRow>(
    `SELECT ${COLUMNS} FROM chat_messages
     WHERE session_id = ?
     ORDER BY created_at ASC${limitSql}`,
    [sessionId],
  );
}
