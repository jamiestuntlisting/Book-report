import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { and, eq } from "drizzle-orm";
import { getUser } from "@/lib/auth/session";
import { getDb, tables } from "@/lib/db";
import { publicEnv } from "@/lib/env";

const createSchema = z.object({
  scope: z.enum(["book", "story"]).default("book"),
  storyId: z.string().uuid().optional(),
});

// Creates a public, read-only share link (a random token). Revoke via DELETE.
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const token = nanoid(16);
  await getDb().insert(tables.shares).values({
    user_id: user.id,
    token,
    scope: parsed.data.scope,
    story_id: parsed.data.storyId ?? null,
  });

  return NextResponse.json({ token, url: `${publicEnv.appUrl}/share/${token}` });
}

export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  await getDb()
    .update(tables.shares)
    .set({ revoked: true })
    .where(and(eq(tables.shares.token, token), eq(tables.shares.user_id, user.id)));
  return NextResponse.json({ ok: true });
}
