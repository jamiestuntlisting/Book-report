import { NextResponse, type NextRequest } from "next/server";
import { getBindings } from "@/lib/cf";
import { SCHEMA_STATEMENTS } from "@/lib/db/ddl";

export const maxDuration = 120;

// One-time (idempotent) database setup: applies db/schema.sql through the D1
// binding, so no wrangler login or dashboard SQL console is needed. Every
// statement uses IF NOT EXISTS / INSERT OR IGNORE, so re-running is safe.
// Guarded by CRON_SECRET — either as a Bearer header (POST) or a ?token=
// query param (GET, so it can be triggered from a browser).
async function runInit(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const queryToken = new URL(req.url).searchParams.get("token");
  if (!secret || (auth !== `Bearer ${secret}` && queryToken !== secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { DB } = getBindings();
  let applied = 0;
  const errors: string[] = [];
  for (const statement of SCHEMA_STATEMENTS) {
    try {
      await DB.prepare(statement).run();
      applied++;
    } catch (err) {
      errors.push(
        `${statement.slice(0, 60)}…: ${err instanceof Error ? err.message : "failed"}`,
      );
    }
  }

  const tables = await DB.prepare(
    "SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
  ).first<{ n: number }>();
  const questions = await DB.prepare(
    "SELECT count(*) AS n FROM template_questions",
  )
    .first<{ n: number }>()
    .catch(() => ({ n: 0 }));

  return NextResponse.json({
    ok: errors.length === 0,
    applied,
    total: SCHEMA_STATEMENTS.length,
    tables: tables?.n ?? 0,
    template_questions: questions?.n ?? 0,
    errors,
  });
}

export async function POST(req: NextRequest) {
  return runInit(req);
}

export async function GET(req: NextRequest) {
  return runInit(req);
}
