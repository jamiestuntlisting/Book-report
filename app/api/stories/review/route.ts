import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUser, createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createJob, updateJob } from "@/lib/jobs";
import { reviewChapter } from "@/lib/review";
import { CLAUDE_MODEL } from "@/lib/anthropic/client";
import { getStoryTranscripts } from "@/lib/generation";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({ storyId: z.string().uuid() });

// Runs the editorial review over a story's chapter: missing story points,
// unclear passages, garbled stunt jargon, tone warnings, perspective drift,
// and named people (with TMDB verification candidates). Replaces any prior
// review for the story.
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { storyId } = parsed.data;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: story } = await supabase
    .from("stories")
    .select("id, prompt_text")
    .eq("id", storyId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!story) return NextResponse.json({ error: "story not found" }, { status: 404 });

  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, generated_text, edited_text")
    .eq("story_id", storyId)
    .maybeSingle();
  const text = chapter?.edited_text || chapter?.generated_text || "";
  if (!text.trim()) {
    return NextResponse.json(
      { error: "Generate the chapter first, then review it." },
      { status: 400 },
    );
  }

  const jobId = await createJob(admin, {
    userId: user.id,
    kind: "story_review",
    refTable: "stories",
    refId: storyId,
  });
  await updateJob(admin, jobId, { status: "running" });

  try {
    const transcripts = await getStoryTranscripts(supabase, storyId);
    const findings = await reviewChapter({
      chapterText: text,
      promptText: story.prompt_text,
      transcripts,
    });

    const { data: review, error } = await supabase
      .from("story_reviews")
      .upsert(
        {
          user_id: user.id,
          story_id: storyId,
          chapter_id: chapter!.id,
          findings,
          model: CLAUDE_MODEL,
          created_at: new Date().toISOString(),
        },
        { onConflict: "story_id" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await updateJob(admin, jobId, { status: "done" });
    return NextResponse.json({ review });
  } catch (err) {
    const message = err instanceof Error ? err.message : "review failed";
    await updateJob(admin, jobId, { status: "error", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
