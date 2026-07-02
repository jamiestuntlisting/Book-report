import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUser, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

// Registers a recording row after the file has been uploaded to Storage, and
// moves the story into the 'transcribing' state. The client then calls
// /api/transcribe with the returned recording id.
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const body = parsed.data;
  const supabase = await createClient();

  const { data: story } = await supabase
    .from("stories")
    .select("id")
    .eq("id", body.storyId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!story) return NextResponse.json({ error: "story not found" }, { status: 404 });

  const { data: last } = await supabase
    .from("recordings")
    .select("sort_order")
    .eq("story_id", body.storyId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: recording, error } = await supabase
    .from("recordings")
    .insert({
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
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("stories")
    .update({ status: "transcribing" })
    .eq("id", body.storyId);

  return NextResponse.json({ recording });
}
