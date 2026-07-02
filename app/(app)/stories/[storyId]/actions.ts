"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import type { FindingStatus, ReviewFindings } from "@/lib/types";

export async function saveChapterEdit(
  chapterId: string,
  storyId: string,
  editedText: string,
) {
  const supabase = await createClient();
  await supabase
    .from("chapters")
    .update({ edited_text: editedText, status: "edited" })
    .eq("id", chapterId);
  revalidatePath(`/stories/${storyId}`);
}

export async function updateChapterTitle(
  chapterId: string,
  storyId: string,
  title: string,
) {
  const supabase = await createClient();
  await supabase.from("chapters").update({ title }).eq("id", chapterId);
  revalidatePath(`/stories/${storyId}`);
  revalidatePath("/book");
}

export async function addChapterLink(
  chapterId: string,
  storyId: string,
  url: string,
  label: string,
) {
  const user = await getUser();
  if (!user) return;
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("chapter_links")
    .select("position")
    .eq("chapter_id", chapterId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  await supabase.from("chapter_links").insert({
    user_id: user.id,
    chapter_id: chapterId,
    url,
    label: label || null,
    position: (last?.position ?? 0) + 1,
  });
  revalidatePath(`/stories/${storyId}`);
}

export async function deleteChapterLink(linkId: string, storyId: string) {
  const supabase = await createClient();
  await supabase.from("chapter_links").delete().eq("id", linkId);
  revalidatePath(`/stories/${storyId}`);
}

export async function registerPhoto(
  chapterId: string,
  storyId: string,
  bucket: string,
  path: string,
  caption: string,
) {
  const user = await getUser();
  if (!user) return;
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("photos")
    .select("position")
    .eq("chapter_id", chapterId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  await supabase.from("photos").insert({
    user_id: user.id,
    chapter_id: chapterId,
    storage_bucket: bucket,
    storage_path: path,
    caption: caption || null,
    position: (last?.position ?? 0) + 1,
  });
  revalidatePath(`/stories/${storyId}`);
}

export async function deletePhoto(photoId: string, storyId: string) {
  const supabase = await createClient();
  await supabase.from("photos").delete().eq("id", photoId);
  revalidatePath(`/stories/${storyId}`);
}

// ---- Story review actions ----

/** Marks a review finding open/applied/dismissed inside the findings jsonb. */
export async function setFindingStatus(
  storyId: string,
  category: keyof ReviewFindings,
  findingId: string,
  status: FindingStatus,
) {
  const supabase = await createClient();
  const { data: review } = await supabase
    .from("story_reviews")
    .select("id, findings")
    .eq("story_id", storyId)
    .maybeSingle();
  if (!review) return;

  const findings = review.findings as ReviewFindings;
  const list = findings[category] as Array<{ id: string; status: FindingStatus }>;
  const finding = list?.find((f) => f.id === findingId);
  if (!finding) return;
  finding.status = status;

  await supabase
    .from("story_reviews")
    .update({ findings })
    .eq("id", review.id);
  revalidatePath(`/stories/${storyId}`);
}

/**
 * Applies an exact-text replacement to the chapter (jargon fix, tone rewrite,
 * perspective fix, or name change). Copies generated_text into edited_text
 * first if the author hasn't edited yet, so the AI original is preserved.
 * Returns an error string if the quoted text no longer appears.
 */
export async function applyTextFix(
  storyId: string,
  category: keyof ReviewFindings,
  findingId: string,
  find: string,
  replace: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, generated_text, edited_text")
    .eq("story_id", storyId)
    .maybeSingle();
  if (!chapter) return { error: "No chapter to fix." };

  const base = chapter.edited_text || chapter.generated_text || "";
  if (!base.includes(find)) {
    return { error: "That text no longer appears in the chapter — re-run the review." };
  }

  await supabase
    .from("chapters")
    .update({ edited_text: base.replaceAll(find, replace), status: "edited" })
    .eq("id", chapter.id);

  await setFindingStatus(storyId, category, findingId, "applied");
  revalidatePath(`/stories/${storyId}`);
  return {};
}

/**
 * Changes or redacts a person's name: replaces it in the chapter text AND
 * persists the mapping on the story so future regenerations and merges never
 * resurface the original name.
 */
export async function applyNameReplacement(
  storyId: string,
  findingId: string,
  originalName: string,
  newName: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: story } = await supabase
    .from("stories")
    .select("id, name_replacements")
    .eq("id", storyId)
    .maybeSingle();
  if (!story) return { error: "Story not found." };

  const replacements = {
    ...((story.name_replacements as Record<string, string>) ?? {}),
    [originalName]: newName,
  };
  await supabase
    .from("stories")
    .update({ name_replacements: replacements })
    .eq("id", storyId);

  const result = await applyTextFix(storyId, "names", findingId, originalName, newName);
  // Even if the exact string is gone from the text, the persistent mapping is
  // saved — regeneration will apply it. Mark the finding handled either way.
  if (result.error) {
    await setFindingStatus(storyId, "names", findingId, "applied");
    revalidatePath(`/stories/${storyId}`);
    return {};
  }
  return {};
}

// Ensures a chapter row exists for a story (used before attaching media if the
// user hasn't generated text yet).
export async function ensureChapter(storyId: string): Promise<string | null> {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("chapters")
    .select("id")
    .eq("story_id", storyId)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: story } = await supabase
    .from("stories")
    .select("title")
    .eq("id", storyId)
    .maybeSingle();
  const { data: created } = await supabase
    .from("chapters")
    .insert({
      user_id: user.id,
      story_id: storyId,
      title: story?.title ?? "Untitled chapter",
      status: "empty",
    })
    .select("id")
    .single();
  revalidatePath(`/stories/${storyId}`);
  return created?.id ?? null;
}
