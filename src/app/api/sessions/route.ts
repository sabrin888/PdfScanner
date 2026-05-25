import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { v4 as uuid } from "uuid";

export async function POST(req: NextRequest) {
  try {
    await initDb();
    const { filename, page_count } = await req.json();
    const id = uuid();
    const db = getDb();
    await db.execute({
      sql: "INSERT INTO sessions (id, filename, page_count, created_at) VALUES (?, ?, ?, ?)",
      args: [id, filename, page_count, new Date().toISOString()],
    });
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  try {
    await initDb();
    const db = getDb();
    const result = await db.execute(
      "SELECT * FROM sessions ORDER BY created_at DESC LIMIT 20"
    );
    return NextResponse.json({ sessions: result.rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
