/**
 * RDS PostgreSQL Client
 *
 * Replaces Supabase for server-side database access.
 * Connects to AWS RDS PostgreSQL via a connection pool.
 * Auth enforcement via manual user_id checks (RLS removed).
 *
 * Environment variables:
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD  (injected from Secrets Manager)
 */

import { Pool, type QueryResult, type QueryResultRow } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || "5432", 10),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      // TLS required for RDS
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on("error", (err: Error) => {
      console.error("[DB] Unexpected error on idle client:", err);
    });
  }
  return pool;
}

/**
 * Execute a parameterized SQL query.
 * Always use $1, $2, ... placeholders — never interpolate user input.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const client = getPool();
  return client.query<T>(sql, params);
}

/**
 * Execute multiple queries in a transaction.
 * Rolls back automatically on error.
 */
export async function transaction<T>(
  fn: (q: typeof query) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const txQuery = <R extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]) =>
      client.query<R>(sql, params);
    const result = await fn(txQuery as typeof query);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
