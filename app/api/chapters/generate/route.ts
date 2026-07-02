import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUser, createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createJob, updateJob } from "@/lib/jobs";
import { generateChapter } from "@/lib/anthropic/rewrite";
import { CLAUDE_MODEL } from "@/lib/anthropic/client";
import {
  ensureVoiceProfile,
  getActiveVoiceProfile,
  getStoryTranscripts,
} from "@/lib/generation";
import { hashString } from "@/lib/utils";
import type { ChapterGenerationMeta } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({
  storyId: z.string().uuid(),
  guidance: z.string().max(1000).optional(),
  // regenerate=true replaces an existing chapter, preserving history.
  regenerate: z.boolean().optional(),
});

// Generates (or regenerates) a chapter for a story from its transcripts, in the
// speaker's voice. Refreshes the voice profile first so the style stays current.
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { storyId, guidance, regenerate } = parsed.data;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: story } = await supabase
    .from("stories")
    .select("*")
    .eq("id", storyId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!story) return NextResponse.json({ error: "story not found" }, { status: 404 });

  const transcripts = await getStoryTranscripts(supabase, storyId);
  if (transcripts.length === 0) {
    return NextResponse.json(
      { error: "No transcripts yet. Record and transcribe a memo first." },
      { status: 400 },
    );
  }

  const jobId = await createJob(admin, {
    userId: user.id,
    kind: regenerate ? "chapter_regenerate" : "chapter_generate",
    refTable: "stories",
    refId: storyId,
  });
  await supabase.from("stories").update({ status: "generating" }).eq("id", storyId);
  await updateJob(admin, jobId, { status: "running" });

  try {
    // Keep the voice profile in sync with all transcripts before writing.
    let voice = await ensureVoiceProfile(supabase, user.id);
    if (!voice) voice = await getActiveVoiceProfile(supabase, user.id);

    const text = await generateChapter({
      promptText: story.prompt_text,
      transcripts,
      voice,
      guidance,
    });

    const { transcriptIds } = await gatherTranscriptIds(supabase, storyId);
    const meta: ChapterGenerationMeta = {
      voice_profile_version: voice?.version,
      transcript_ids: transcriptIds,
      prompt_hash: hashString(transcripts.join("\n") + (guidance ?? "")),
      guidance,
    };

    const { data: existing } = await supabase
      .from("chapters")
      .select("id, generated_text, generation_meta")
      .eq("story_id", storyId)
      .maybeSingle();

    let chapterId: string;
    if (existing) {
      const history = (existing.generation_meta as ChapterGenerationMeta | null)?.history ?? [];
      if (existing.generated_text) {
        history.push({
          text: existing.generated_text,
          at: new Date().toISOString(),
          reason: regenerate ? "regenerate" : "generate",
        });
      }
      await supabase
        .from("chapters")
        .update({
          generated_text: text,
          model: CLAUDE_MODEL,
          generation_meta: { ...meta, history: history.slice(-5) },
          status: "generated",
          title: existing_title(story.title),
        })
        .eq("id", existing.id);
      chapterId = existing.id;
    } else {
      const { data: created } = await supabase
        .from("chapters")
        .insert({
          user_id: user.id,
          story_id: storyId,
          title: existing_title(story.title),
          generated_text: text,
          model: CLAUDE_MODEL,
          generation_meta: meta,
          status: "generated",
        })
        .select("id")
        .single();
      chapterId = created!.id;
    }

    await supabase.from("stories").update({ status: "ready" }).eq("id", storyId);
    await updateJob(admin, jobId, { status: "done", result: { chapterId } });

    return NextResponse.json({ chapterId, text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "generation failed";
    await supabase.from("stories").update({ status: "draft" }).eq("id", storyId);
    await updateJob(admin, jobId, { status: "error", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function existing_title(storyTitle: string): string {
  return storyTitle?.slice(0, 120) || "Untitled chapter";
}

async function gatherTranscriptIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storyId: string,
): Promise<{ transcriptIds: string[] }> {
  const { data: recordings } = await supabase
    .from("recordings")
    .select("id")
    .eq("story_id", storyId);
  const ids = (recordings ?? []).map((r) => r.id);
  if (ids.length === 0) return { transcriptIds: [] };
  const { data: transcripts } = await supabase
    .from("transcripts")
    .select("id")
    .in("recording_id", ids)
    .eq("status", "done");
  return { transcriptIds: (transcripts ?? []).map((t) => t.id) };
}
