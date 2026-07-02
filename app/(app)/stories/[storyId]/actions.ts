"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";

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
