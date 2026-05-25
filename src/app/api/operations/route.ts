import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { v4 as uuid } from "uuid";

export async function POST(req: NextRequest) {
  try {
    await initDb();
    const { session_id, operation, params } = await req.json();
    const id = uuid();
    const db = getDb();
    await db.execute({
      sql: "INSERT INTO operations (id, session_id, operation, params, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [id, session_id, operation, JSON.stringify(params), new Date().toISOString()],
    });
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    await initDb();
    const sessionId = req.nextUrl.searchParams.get("session_id");
    const db = getDb();
    const result = sessionId
      ? await db.execute({
          sql: "SELECT * FROM operations WHERE session_id = ? ORDER BY created_at DESC",
          args: [sessionId],
        })
      : await db.execute(
          "SELECT * FROM operations ORDER BY created_at DESC LIMIT 50"
        );
    return NextResponse.json({ operations: result.rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
