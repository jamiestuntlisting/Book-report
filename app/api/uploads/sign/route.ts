import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUser, createClient } from "@/lib/supabase/server";
import { extFromMime } from "@/lib/utils";
import { recordingPath, photoPath, BUCKETS } from "@/lib/storage";

export const runtime = "nodejs";

const schema = z.object({
  purpose: z.enum(["recording", "photo"]),
  storyId: z.string().uuid().optional(),
  chapterId: z.string().uuid().optional(),
  kind: z.enum(["audio", "video"]).optional(),
  mimeType: z.string(),
});

// Mints a short-lived signed upload URL scoped to a path the caller owns, after
// verifying ownership of the parent story/chapter. Keeps large media uploads
// off the server request path — the browser PUTs directly to Storage.
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { purpose, storyId, chapterId, kind, mimeType } = parsed.data;
  const supabase = await createClient();
  const ext = extFromMime(mimeType);
  const id = crypto.randomUUID();

  let bucket: string;
  let path: string;

  if (purpose === "recording") {
    if (!storyId || !kind) {
      return NextResponse.json({ error: "storyId and kind required" }, { status: 400 });
    }
    const { data: story } = await supabase
      .from("stories")
      .select("id")
      .eq("id", storyId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!story) return NextResponse.json({ error: "story not found" }, { status: 404 });
    bucket = kind === "video" ? BUCKETS.video : BUCKETS.audio;
    path = recordingPath(user.id, storyId, id, ext);
  } else {
    if (!chapterId) {
      return NextResponse.json({ error: "chapterId required" }, { status: 400 });
    }
    const { data: chapter } = await supabase
      .from("chapters")
      .select("id")
      .eq("id", chapterId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!chapter) return NextResponse.json({ error: "chapter not found" }, { status: 404 });
    bucket = BUCKETS.photos;
    path = photoPath(user.id, chapterId, id, ext);
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "sign failed" }, { status: 500 });
  }

  return NextResponse.json({
    id,
    bucket,
    path,
    token: data.token,
    signedUrl: data.signedUrl,
  });
}
