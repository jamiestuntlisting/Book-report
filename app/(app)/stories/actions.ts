"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";

export async function createStory(formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");

  const questionId = (formData.get("template_question_id") as string) || null;
  const promptText = (formData.get("prompt_text") as string) || null;
  const title =
    ((formData.get("title") as string) || promptText || "Untitled story").slice(
      0,
      120,
    );

  const supabase = await createClient();

  // Place new stories at the end.
  const { data: last } = await supabase
    .from("stories")
    .select("sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (last?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("stories")
    .insert({
      user_id: user.id,
      title,
      template_question_id: questionId,
      prompt_text: promptText,
      sort_order: nextOrder,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  redirect(`/stories/${data.id}`);
}

export async function renameStory(storyId: string, title: string) {
  const supabase = await createClient();
  await supabase.from("stories").update({ title }).eq("id", storyId);
  revalidatePath("/dashboard");
  revalidatePath(`/stories/${storyId}`);
}

export async function deleteStory(storyId: string) {
  const supabase = await createClient();
  await supabase.from("stories").delete().eq("id", storyId);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateStoryMeta(
  storyId: string,
  patch: { chapter_number?: number | null; include_in_book?: boolean },
) {
  const supabase = await createClient();
  await supabase.from("stories").update(patch).eq("id", storyId);
  revalidatePath("/dashboard");
  revalidatePath("/book");
}

// Persist a new ordering (array of story ids in display order).
export async function reorderStories(orderedIds: string[]) {
  const user = await getUser();
  if (!user) return;
  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("stories")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("user_id", user.id),
    ),
  );
  revalidatePath("/dashboard");
  revalidatePath("/book");
}
