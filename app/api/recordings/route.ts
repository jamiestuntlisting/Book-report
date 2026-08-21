import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { getUser } from "@/lib/auth/session";
import { getDb, tables } from "@/lib/db";

const schema = z.object({
  id: z.string().uuid(),
  storyId: z.string().uuid(),
  bucket: z.string(),
  path: z.string(),
  kind: z.enum(["audio", "video"]),
  mimeType: z.string().optional(),
  sizeBytes: z.number().optional(),
  durationSeconds: z.number().optional(),
});

// Registers a recording row after the file has been uploaded to R2, and moves
// the story into the 'transcribing' state. The client then calls
// /api/transcribe with the returned recording id.
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const body = parsed.data;
  const db = getDb();

  const [story] = await db
    .select({ id: tables.stories.id })
    .from(tables.stories)
    .where(
      and(eq(tables.stories.id, body.storyId), eq(tables.stories.user_id, user.id)),
    )
    .limit(1);
  if (!story) return NextResponse.json({ error: "story not found" }, { status: 404 });

  const [last] = await db
    .select({ sort_order: tables.recordings.sort_order })
    .from(tables.recordings)
    .where(eq(tables.recordings.story_id, body.storyId))
    .orderBy(desc(tables.recordings.sort_order))
    .limit(1);

  const [recording] = await db
    .insert(tables.recordings)
    .values({
      id: body.id,
      user_id: user.id,
      story_id: body.storyId,
      kind: body.kind,
      storage_bucket: body.bucket,
      storage_path: body.path,
      mime_type: body.mimeType ?? null,
      size_bytes: body.sizeBytes ?? null,
      duration_seconds: body.durationSeconds ?? null,
      source: "self_recorded",
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .returning();

  await db
    .update(tables.stories)
    .set({ status: "transcribing", updated_at: new Date().toISOString() })
    .where(eq(tables.stories.id, body.storyId));

  return NextResponse.json({ recording });
}
