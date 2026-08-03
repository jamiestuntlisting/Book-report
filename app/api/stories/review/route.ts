import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getUser } from "@/lib/auth/session";
import { getDb, tables } from "@/lib/db";
import { createJob, updateJob } from "@/lib/jobs";
import { reviewChapter } from "@/lib/review";
import { CLAUDE_MODEL } from "@/lib/anthropic/client";
import { getStoryTranscripts } from "@/lib/generation";

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
  const db = getDb();

  const [story] = await db
    .select({ id: tables.stories.id, prompt_text: tables.stories.prompt_text })
    .from(tables.stories)
    .where(and(eq(tables.stories.id, storyId), eq(tables.stories.user_id, user.id)))
    .limit(1);
  if (!story) return NextResponse.json({ error: "story not found" }, { status: 404 });

  const [chapter] = await db
    .select({
      id: tables.chapters.id,
      generated_text: tables.chapters.generated_text,
      edited_text: tables.chapters.edited_text,
    })
    .from(tables.chapters)
    .where(eq(tables.chapters.story_id, storyId))
    .limit(1);
  const text = chapter?.edited_text || chapter?.generated_text || "";
  if (!text.trim()) {
    return NextResponse.json(
      { error: "Generate the chapter first, then review it." },
      { status: 400 },
    );
  }

  const jobId = await createJob(db, {
    userId: user.id,
    kind: "story_review",
    refTable: "stories",
    refId: storyId,
  });
  await updateJob(db, jobId, { status: "running" });

  try {
    const transcripts = await getStoryTranscripts(db, storyId);
    const findings = await reviewChapter({
      chapterText: text,
      promptText: story.prompt_text,
      transcripts,
    });

    // Replace any prior review for this story (unique story_id).
    await db.delete(tables.story_reviews).where(eq(tables.story_reviews.story_id, storyId));
    const [review] = await db
      .insert(tables.story_reviews)
      .values({
        user_id: user.id,
        story_id: storyId,
        chapter_id: chapter!.id,
        findings,
        model: CLAUDE_MODEL,
      })
      .returning();

    await updateJob(db, jobId, { status: "done" });
    return NextResponse.json({ review });
  } catch (err) {
    const message = err instanceof Error ? err.message : "review failed";
    await updateJob(db, jobId, { status: "error", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
