import type { SupabaseClient } from "@supabase/supabase-js";
import type { VoiceStyleProfile } from "@/lib/types";
import { generateVoiceProfile } from "@/lib/anthropic/rewrite";

// Server-side helpers shared by the chapter generate/regenerate/append routes.

/** All completed transcript texts for a story, in recording order. */
export async function getStoryTranscripts(
  supabase: SupabaseClient,
  storyId: string,
): Promise<string[]> {
  const { data: recordings } = await supabase
    .from("recordings")
    .select("id, sort_order")
    .eq("story_id", storyId)
    .order("sort_order", { ascending: true });
  if (!recordings?.length) return [];

  const ids = recordings.map((r) => r.id);
  const { data: transcripts } = await supabase
    .from("transcripts")
    .select("recording_id, text, status")
    .in("recording_id", ids)
    .eq("status", "done");

  const byRecording = new Map<string, string>();
  (transcripts ?? []).forEach((t) => {
    if (t.text) byRecording.set(t.recording_id, t.text);
  });

  return recordings
    .map((r) => byRecording.get(r.id))
    .filter((t): t is string => Boolean(t && t.trim()));
}

/** The user's active voice profile, or null if none yet. */
export async function getActiveVoiceProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<VoiceStyleProfile | null> {
  const { data } = await supabase
    .from("voice_style_profiles")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as VoiceStyleProfile) ?? null;
}

/** Every completed transcript text for a user (feeds the voice profile). */
export async function getAllUserTranscripts(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ids: string[]; texts: string[] }> {
  const { data } = await supabase
    .from("transcripts")
    .select("id, text, status")
    .eq("user_id", userId)
    .eq("status", "done");
  const rows = (data ?? []).filter((t) => t.text && t.text.trim());
  return { ids: rows.map((t) => t.id), texts: rows.map((t) => t.text as string) };
}

/**
 * Ensure an up-to-date voice profile exists. Rebuilds (version bump) when new
 * transcripts have appeared since the active profile was derived, so
 * regenerations stay consistent with how the person actually speaks.
 */
export async function ensureVoiceProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<VoiceStyleProfile | null> {
  const { ids, texts } = await getAllUserTranscripts(supabase, userId);
  if (texts.length === 0) return null;

  const active = await getActiveVoiceProfile(supabase, userId);
  const sameSources =
    active &&
    active.source_transcript_ids.length === ids.length &&
    ids.every((id) => active.source_transcript_ids.includes(id));
  if (active && sameSources) return active;

  const { profile, summary } = await generateVoiceProfile(texts);
  const nextVersion = (active?.version ?? 0) + 1;

  // Deactivate old, insert new active version.
  await supabase
    .from("voice_style_profiles")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("is_active", true);

  const { data: inserted } = await supabase
    .from("voice_style_profiles")
    .insert({
      user_id: userId,
      is_active: true,
      version: nextVersion,
      profile,
      summary,
      source_transcript_ids: ids,
    })
    .select("*")
    .single();

  return (inserted as VoiceStyleProfile) ?? active;
}
