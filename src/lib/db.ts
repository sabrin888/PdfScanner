import { createClient } from "@libsql/client";

let _db: ReturnType<typeof createClient> | null = null;

export function getDb() {
  if (!_db) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url) throw new Error("TURSO_DATABASE_URL is not set");
    _db = createClient({ url, authToken: authToken || undefined });
  }
  return _db;
}

export async function initDb() {
  const db = getDb();
  await db.batch([
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      page_count INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS operations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      params TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  ], "write");
}
