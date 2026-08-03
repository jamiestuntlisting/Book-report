import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getUser } from "@/lib/auth/session";
import { getDb, tables } from "@/lib/db";
import { extFromMime } from "@/lib/utils";
import { recordingPath, photoPath, BUCKETS, mediaKey } from "@/lib/media";

const schema = z.object({
  purpose: z.enum(["recording", "photo"]),
  storyId: z.string().uuid().optional(),
  chapterId: z.string().uuid().optional(),
  kind: z.enum(["audio", "video"]).optional(),
  mimeType: z.string(),
});

// Allocates an upload destination scoped to a path the caller owns, after
// verifying ownership of the parent story/chapter. The browser then PUTs the
// bytes to /api/media/<key> (or the multipart endpoint for big files).
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { purpose, storyId, chapterId, kind, mimeType } = parsed.data;
  const db = getDb();
  const ext = extFromMime(mimeType);
  const id = crypto.randomUUID();

  let bucket: string;
  let path: string;

  if (purpose === "recording") {
    if (!storyId || !kind) {
      return NextResponse.json({ error: "storyId and kind required" }, { status: 400 });
    }
    const [story] = await db
      .select({ id: tables.stories.id })
      .from(tables.stories)
      .where(and(eq(tables.stories.id, storyId), eq(tables.stories.user_id, user.id)))
      .limit(1);
    if (!story) return NextResponse.json({ error: "story not found" }, { status: 404 });
    bucket = kind === "video" ? BUCKETS.video : BUCKETS.audio;
    path = recordingPath(user.id, storyId, id, ext);
  } else {
    if (!chapterId) {
      return NextResponse.json({ error: "chapterId required" }, { status: 400 });
    }
    const [chapter] = await db
      .select({ id: tables.chapters.id })
      .from(tables.chapters)
      .where(
        and(eq(tables.chapters.id, chapterId), eq(tables.chapters.user_id, user.id)),
      )
      .limit(1);
    if (!chapter) return NextResponse.json({ error: "chapter not found" }, { status: 404 });
    bucket = BUCKETS.photos;
    path = photoPath(user.id, chapterId, id, ext);
  }

  return NextResponse.json({
    id,
    bucket,
    path,
    key: mediaKey(bucket, path),
  });
}
