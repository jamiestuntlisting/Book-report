import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUser, createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createJob, updateJob } from "@/lib/jobs";
import { appendToChapter } from "@/lib/anthropic/rewrite";
import { CLAUDE_MODEL } from "@/lib/anthropic/client";
import { ensureVoiceProfile, getActiveVoiceProfile } from "@/lib/generation";
import type { ChapterGenerationMeta } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({
  storyId: z.string().uuid(),
  // Transcript ids recorded AFTER the chapter was last generated.
  newTranscriptIds: z.array(z.string().uuid()).min(1),
});

// Merges newly recorded material into an existing chapter, adding only what the
// new transcripts contain and preserving the speaker's voice.
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { storyId, newTranscriptIds } = parsed.data;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: chapter } = await supabase
    .from("chapters")
    .select("*")
    .eq("story_id", storyId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!chapter?.generated_text && !chapter?.edited_text) {
    return NextResponse.json(
      { error: "Generate the chapter first, then append." },
      { status: 400 },
    );
  }

  const { data: newTranscripts } = await supabase
    .from("transcripts")
    .select("text")
    .in("id", newTranscriptIds)
    .eq("user_id", user.id)
    .eq("status", "done");
  const texts = (newTranscripts ?? [])
    .map((t) => t.text)
    .filter((t): t is string => Boolean(t?.trim()));
  if (texts.length === 0) {
    return NextResponse.json({ error: "No new transcript text found." }, { status: 400 });
  }

  const jobId = await createJob(admin, {
    userId: user.id,
    kind: "chapter_append",
    refTable: "chapters",
    refId: chapter.id,
  });
  await supabase.from("stories").update({ status: "generating" }).eq("id", storyId);
  await updateJob(admin, jobId, { status: "running" });

  try {
    let voice = await ensureVoiceProfile(supabase, user.id);
    if (!voice) voice = await getActiveVoiceProfile(supabase, user.id);

    const base = chapter.edited_text || chapter.generated_text || "";
    const merged = await appendToChapter({
      existingChapter: base,
      newTranscripts: texts,
      voice,
    });

    const priorMeta = (chapter.generation_meta as ChapterGenerationMeta | null) ?? {};
    const history = priorMeta.history ?? [];
    history.push({
      text: base,
      at: new Date().toISOString(),
      reason: "append",
    });
    const allTranscriptIds = await getStoryTranscriptIds(supabase, storyId);

    await supabase
      .from("chapters")
      .update({
        generated_text: merged,
        // Appending regenerates the canonical text; clear stale manual edits
        // onto the merged base by moving them into history above.
        edited_text: null,
        model: CLAUDE_MODEL,
        status: "generated",
        generation_meta: {
          ...priorMeta,
          transcript_ids: allTranscriptIds,
          voice_profile_version: voice?.version,
          history: history.slice(-5),
        },
      })
      .eq("id", chapter.id);

    await supabase.from("stories").update({ status: "ready" }).eq("id", storyId);
    await updateJob(admin, jobId, { status: "done" });

    return NextResponse.json({ chapterId: chapter.id, text: merged });
  } catch (err) {
    const message = err instanceof Error ? err.message : "append failed";
    await supabase.from("stories").update({ status: "ready" }).eq("id", storyId);
    await updateJob(admin, jobId, { status: "error", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getStoryTranscriptIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storyId: string,
): Promise<string[]> {
  const { data: recordings } = await supabase
    .from("recordings")
    .select("id")
    .eq("story_id", storyId);
  const ids = (recordings ?? []).map((r) => r.id);
  if (!ids.length) return [];
  const { data: transcripts } = await supabase
    .from("transcripts")
    .select("id")
    .in("recording_id", ids)
    .eq("status", "done");
  return (transcripts ?? []).map((t) => t.id);
}
