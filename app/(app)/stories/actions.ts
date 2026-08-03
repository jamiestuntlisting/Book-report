"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb, tables } from "@/lib/db";

export async function createStory(formData: FormData) {
  const user = await requireUser();

  const questionId = (formData.get("template_question_id") as string) || null;
  const promptText = (formData.get("prompt_text") as string) || null;
  const title =
    ((formData.get("title") as string) || promptText || "Untitled story").slice(
      0,
      120,
    );

  const db = getDb();

  // Place new stories at the end.
  const [last] = await db
    .select({ sort_order: tables.stories.sort_order })
    .from(tables.stories)
    .where(eq(tables.stories.user_id, user.id))
    .orderBy(desc(tables.stories.sort_order))
    .limit(1);
  const nextOrder = (last?.sort_order ?? 0) + 1;

  const [row] = await db
    .insert(tables.stories)
    .values({
      user_id: user.id,
      title,
      template_question_id: questionId,
      prompt_text: promptText,
      sort_order: nextOrder,
    })
    .returning({ id: tables.stories.id });

  revalidatePath("/dashboard");
  redirect(`/stories/${row.id}`);
}

export async function renameStory(storyId: string, title: string) {
  const user = await requireUser();
  await getDb()
    .update(tables.stories)
    .set({ title, updated_at: new Date().toISOString() })
    .where(and(eq(tables.stories.id, storyId), eq(tables.stories.user_id, user.id)));
  revalidatePath("/dashboard");
  revalidatePath(`/stories/${storyId}`);
}

export async function deleteStory(storyId: string) {
  const user = await requireUser();
  await getDb()
    .delete(tables.stories)
    .where(and(eq(tables.stories.id, storyId), eq(tables.stories.user_id, user.id)));
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateStoryMeta(
  storyId: string,
  patch: { chapter_number?: number | null; include_in_book?: boolean },
) {
  const user = await requireUser();
  await getDb()
    .update(tables.stories)
    .set({ ...patch, updated_at: new Date().toISOString() })
    .where(and(eq(tables.stories.id, storyId), eq(tables.stories.user_id, user.id)));
  revalidatePath("/dashboard");
  revalidatePath("/book");
}

// Persist a new ordering (array of story ids in display order).
export async function reorderStories(orderedIds: string[]) {
  const user = await requireUser();
  const db = getDb();
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(tables.stories)
        .set({ sort_order: index })
        .where(and(eq(tables.stories.id, id), eq(tables.stories.user_id, user.id))),
    ),
  );
  revalidatePath("/dashboard");
  revalidatePath("/book");
}
