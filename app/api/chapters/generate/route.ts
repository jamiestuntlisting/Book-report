import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { getUser } from "@/lib/auth/session";
import { getDb, tables, type Db } from "@/lib/db";
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
  const db = getDb();
  const nowIso = () => new Date().toISOString();

  const [story] = await db
    .select()
    .from(tables.stories)
    .where(and(eq(tables.stories.id, storyId), eq(tables.stories.user_id, user.id)))
    .limit(1);
  if (!story) return NextResponse.json({ error: "story not found" }, { status: 404 });

  const transcripts = await getStoryTranscripts(db, storyId);
  if (transcripts.length === 0) {
    return NextResponse.json(
      { error: "No transcripts yet. Record and transcribe a memo first." },
      { status: 400 },
    );
  }

  const jobId = await createJob(db, {
    userId: user.id,
    kind: regenerate ? "chapter_regenerate" : "chapter_generate",
    refTable: "stories",
    refId: storyId,
  });
  await db
    .update(tables.stories)
    .set({ status: "generating", updated_at: nowIso() })
    .where(eq(tables.stories.id, storyId));
  await updateJob(db, jobId, { status: "running" });

  try {
    // Keep the voice profile in sync with all transcripts before writing.
    let voice = await ensureVoiceProfile(db, user.id);
    if (!voice) voice = await getActiveVoiceProfile(db, user.id);

    const text = await generateChapter({
      promptText: story.prompt_text,
      transcripts,
      voice,
      guidance,
      nameReplacements: story.name_replacements ?? null,
    });

    const { transcriptIds } = await gatherTranscriptIds(db, storyId);
    const meta: ChapterGenerationMeta = {
      voice_profile_version: voice?.version,
      transcript_ids: transcriptIds,
      prompt_hash: hashString(transcripts.join("\n") + (guidance ?? "")),
      guidance,
    };

    const [existing] = await db
      .select({
        id: tables.chapters.id,
        generated_text: tables.chapters.generated_text,
        generation_meta: tables.chapters.generation_meta,
      })
      .from(tables.chapters)
      .where(eq(tables.chapters.story_id, storyId))
      .limit(1);

    let chapterId: string;
    if (existing) {
      const history = existing.generation_meta?.history ?? [];
      if (existing.generated_text) {
        history.push({
          text: existing.generated_text,
          at: nowIso(),
          reason: regenerate ? "regenerate" : "generate",
        });
      }
      await db
        .update(tables.chapters)
        .set({
          generated_text: text,
          model: CLAUDE_MODEL,
          generation_meta: { ...meta, history: history.slice(-5) },
          status: "generated",
          title: chapterTitle(story.title),
          updated_at: nowIso(),
        })
        .where(eq(tables.chapters.id, existing.id));
      chapterId = existing.id;
    } else {
      const [created] = await db
        .insert(tables.chapters)
        .values({
          user_id: user.id,
          story_id: storyId,
          title: chapterTitle(story.title),
          generated_text: text,
          model: CLAUDE_MODEL,
          generation_meta: meta,
          status: "generated",
        })
        .returning({ id: tables.chapters.id });
      chapterId = created.id;
    }

    await db
      .update(tables.stories)
      .set({ status: "ready", updated_at: nowIso() })
      .where(eq(tables.stories.id, storyId));
    await updateJob(db, jobId, { status: "done", result: { chapterId } });

    return NextResponse.json({ chapterId, text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "generation failed";
    await db
      .update(tables.stories)
      .set({ status: "draft", updated_at: nowIso() })
      .where(eq(tables.stories.id, storyId));
    await updateJob(db, jobId, { status: "error", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function chapterTitle(storyTitle: string): string {
  return storyTitle?.slice(0, 120) || "Untitled chapter";
}

async function gatherTranscriptIds(
  db: Db,
  storyId: string,
): Promise<{ transcriptIds: string[] }> {
  const recordings = await db
    .select({ id: tables.recordings.id })
    .from(tables.recordings)
    .where(eq(tables.recordings.story_id, storyId));
  const ids = recordings.map((r) => r.id);
  if (ids.length === 0) return { transcriptIds: [] };
  const transcripts = await db
    .select({ id: tables.transcripts.id })
    .from(tables.transcripts)
    .where(
      and(
        inArray(tables.transcripts.recording_id, ids),
        eq(tables.transcripts.status, "done"),
      ),
    );
  return { transcriptIds: transcripts.map((t) => t.id) };
}
