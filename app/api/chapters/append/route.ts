import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { getUser } from "@/lib/auth/session";
import { getDb, tables, type Db } from "@/lib/db";
import { createJob, updateJob } from "@/lib/jobs";
import { appendToChapter } from "@/lib/anthropic/rewrite";
import { CLAUDE_MODEL } from "@/lib/anthropic/client";
import { ensureVoiceProfile, getActiveVoiceProfile } from "@/lib/generation";

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
  const db = getDb();
  const nowIso = () => new Date().toISOString();

  const [chapter] = await db
    .select()
    .from(tables.chapters)
    .where(
      and(
        eq(tables.chapters.story_id, storyId),
        eq(tables.chapters.user_id, user.id),
      ),
    )
    .limit(1);
  if (!chapter?.generated_text && !chapter?.edited_text) {
    return NextResponse.json(
      { error: "Generate the chapter first, then append." },
      { status: 400 },
    );
  }

  const newTranscripts = await db
    .select({ text: tables.transcripts.text })
    .from(tables.transcripts)
    .where(
      and(
        inArray(tables.transcripts.id, newTranscriptIds),
        eq(tables.transcripts.user_id, user.id),
        eq(tables.transcripts.status, "done"),
      ),
    );
  const texts = newTranscripts
    .map((t) => t.text)
    .filter((t): t is string => Boolean(t?.trim()));
  if (texts.length === 0) {
    return NextResponse.json({ error: "No new transcript text found." }, { status: 400 });
  }

  const jobId = await createJob(db, {
    userId: user.id,
    kind: "chapter_append",
    refTable: "chapters",
    refId: chapter.id,
  });
  await db
    .update(tables.stories)
    .set({ status: "generating", updated_at: nowIso() })
    .where(eq(tables.stories.id, storyId));
  await updateJob(db, jobId, { status: "running" });

  try {
    let voice = await ensureVoiceProfile(db, user.id);
    if (!voice) voice = await getActiveVoiceProfile(db, user.id);

    const [storyRow] = await db
      .select({ name_replacements: tables.stories.name_replacements })
      .from(tables.stories)
      .where(eq(tables.stories.id, storyId))
      .limit(1);

    const base = chapter.edited_text || chapter.generated_text || "";
    const merged = await appendToChapter({
      existingChapter: base,
      newTranscripts: texts,
      voice,
      nameReplacements: storyRow?.name_replacements ?? null,
    });

    const priorMeta = chapter.generation_meta ?? {};
    const history = priorMeta.history ?? [];
    history.push({
      text: base,
      at: nowIso(),
      reason: "append",
    });
    const allTranscriptIds = await getStoryTranscriptIds(db, storyId);

    await db
      .update(tables.chapters)
      .set({
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
        updated_at: nowIso(),
      })
      .where(eq(tables.chapters.id, chapter.id));

    await db
      .update(tables.stories)
      .set({ status: "ready", updated_at: nowIso() })
      .where(eq(tables.stories.id, storyId));
    await updateJob(db, jobId, { status: "done" });

    return NextResponse.json({ chapterId: chapter.id, text: merged });
  } catch (err) {
    const message = err instanceof Error ? err.message : "append failed";
    await db
      .update(tables.stories)
      .set({ status: "ready", updated_at: nowIso() })
      .where(eq(tables.stories.id, storyId));
    await updateJob(db, jobId, { status: "error", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getStoryTranscriptIds(db: Db, storyId: string): Promise<string[]> {
  const recordings = await db
    .select({ id: tables.recordings.id })
    .from(tables.recordings)
    .where(eq(tables.recordings.story_id, storyId));
  const ids = recordings.map((r) => r.id);
  if (!ids.length) return [];
  const transcripts = await db
    .select({ id: tables.transcripts.id })
    .from(tables.transcripts)
    .where(
      and(
        inArray(tables.transcripts.recording_id, ids),
        eq(tables.transcripts.status, "done"),
      ),
    );
  return transcripts.map((t) => t.id);
}
