import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { tables } from "@/lib/db";
import type { VoiceStyleProfile } from "@/lib/types";
import { generateVoiceProfile } from "@/lib/anthropic/rewrite";

// Server-side helpers shared by the chapter generate/regenerate/append routes.

/** All completed transcript texts for a story, in recording order. */
export async function getStoryTranscripts(
  db: Db,
  storyId: string,
): Promise<string[]> {
  const recordings = await db
    .select({ id: tables.recordings.id })
    .from(tables.recordings)
    .where(eq(tables.recordings.story_id, storyId))
    .orderBy(asc(tables.recordings.sort_order));
  if (!recordings.length) return [];

  const ids = recordings.map((r) => r.id);
  const transcripts = await db
    .select({
      recording_id: tables.transcripts.recording_id,
      text: tables.transcripts.text,
    })
    .from(tables.transcripts)
    .where(
      and(
        inArray(tables.transcripts.recording_id, ids),
        eq(tables.transcripts.status, "done"),
      ),
    );

  const byRecording = new Map<string, string>();
  transcripts.forEach((t) => {
    if (t.text) byRecording.set(t.recording_id, t.text);
  });

  return recordings
    .map((r) => byRecording.get(r.id))
    .filter((t): t is string => Boolean(t && t.trim()));
}

/** The user's active voice profile, or null if none yet. */
export async function getActiveVoiceProfile(
  db: Db,
  userId: string,
): Promise<VoiceStyleProfile | null> {
  const [row] = await db
    .select()
    .from(tables.voice_style_profiles)
    .where(
      and(
        eq(tables.voice_style_profiles.user_id, userId),
        eq(tables.voice_style_profiles.is_active, true),
      ),
    )
    .orderBy(desc(tables.voice_style_profiles.version))
    .limit(1);
  return (row as VoiceStyleProfile | undefined) ?? null;
}

/** Every completed transcript text for a user (feeds the voice profile). */
export async function getAllUserTranscripts(
  db: Db,
  userId: string,
): Promise<{ ids: string[]; texts: string[] }> {
  const rows = await db
    .select({ id: tables.transcripts.id, text: tables.transcripts.text })
    .from(tables.transcripts)
    .where(
      and(
        eq(tables.transcripts.user_id, userId),
        eq(tables.transcripts.status, "done"),
      ),
    );
  const filled = rows.filter((t) => t.text && t.text.trim());
  return { ids: filled.map((t) => t.id), texts: filled.map((t) => t.text as string) };
}

/**
 * Ensure an up-to-date voice profile exists. Rebuilds (version bump) when new
 * transcripts have appeared since the active profile was derived, so
 * regenerations stay consistent with how the person actually speaks.
 */
export async function ensureVoiceProfile(
  db: Db,
  userId: string,
): Promise<VoiceStyleProfile | null> {
  const { ids, texts } = await getAllUserTranscripts(db, userId);
  if (texts.length === 0) return null;

  const active = await getActiveVoiceProfile(db, userId);
  const sameSources =
    active &&
    active.source_transcript_ids.length === ids.length &&
    ids.every((id) => active.source_transcript_ids.includes(id));
  if (active && sameSources) return active;

  const { profile, summary } = await generateVoiceProfile(texts);
  const nextVersion = (active?.version ?? 0) + 1;

  // Deactivate old, insert new active version.
  await db
    .update(tables.voice_style_profiles)
    .set({ is_active: false })
    .where(
      and(
        eq(tables.voice_style_profiles.user_id, userId),
        eq(tables.voice_style_profiles.is_active, true),
      ),
    );

  const [inserted] = await db
    .insert(tables.voice_style_profiles)
    .values({
      user_id: userId,
      is_active: true,
      version: nextVersion,
      profile,
      summary,
      source_transcript_ids: ids,
    })
    .returning();

  return (inserted as VoiceStyleProfile | undefined) ?? active;
}
