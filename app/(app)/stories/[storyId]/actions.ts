"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb, tables } from "@/lib/db";
import type { FindingStatus, ReviewFindings } from "@/lib/types";

const nowIso = () => new Date().toISOString();

export async function saveChapterEdit(
  chapterId: string,
  storyId: string,
  editedText: string,
) {
  const user = await requireUser();
  await getDb()
    .update(tables.chapters)
    .set({ edited_text: editedText, status: "edited", updated_at: nowIso() })
    .where(and(eq(tables.chapters.id, chapterId), eq(tables.chapters.user_id, user.id)));
  revalidatePath(`/stories/${storyId}`);
}

export async function updateChapterTitle(
  chapterId: string,
  storyId: string,
  title: string,
) {
  const user = await requireUser();
  await getDb()
    .update(tables.chapters)
    .set({ title, updated_at: nowIso() })
    .where(and(eq(tables.chapters.id, chapterId), eq(tables.chapters.user_id, user.id)));
  revalidatePath(`/stories/${storyId}`);
  revalidatePath("/book");
}

export async function addChapterLink(
  chapterId: string,
  storyId: string,
  url: string,
  label: string,
) {
  const user = await requireUser();
  const db = getDb();
  const [last] = await db
    .select({ position: tables.chapter_links.position })
    .from(tables.chapter_links)
    .where(eq(tables.chapter_links.chapter_id, chapterId))
    .orderBy(desc(tables.chapter_links.position))
    .limit(1);
  await db.insert(tables.chapter_links).values({
    user_id: user.id,
    chapter_id: chapterId,
    url,
    label: label || null,
    position: (last?.position ?? 0) + 1,
  });
  revalidatePath(`/stories/${storyId}`);
}

export async function deleteChapterLink(linkId: string, storyId: string) {
  const user = await requireUser();
  await getDb()
    .delete(tables.chapter_links)
    .where(
      and(
        eq(tables.chapter_links.id, linkId),
        eq(tables.chapter_links.user_id, user.id),
      ),
    );
  revalidatePath(`/stories/${storyId}`);
}

export async function registerPhoto(
  chapterId: string,
  storyId: string,
  bucket: string,
  path: string,
  caption: string,
) {
  const user = await requireUser();
  const db = getDb();
  const [last] = await db
    .select({ position: tables.photos.position })
    .from(tables.photos)
    .where(eq(tables.photos.chapter_id, chapterId))
    .orderBy(desc(tables.photos.position))
    .limit(1);
  await db.insert(tables.photos).values({
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
  const user = await requireUser();
  await getDb()
    .delete(tables.photos)
    .where(and(eq(tables.photos.id, photoId), eq(tables.photos.user_id, user.id)));
  revalidatePath(`/stories/${storyId}`);
}

// ---- Story review actions ----

/** Marks a review finding open/applied/dismissed inside the findings JSON. */
export async function setFindingStatus(
  storyId: string,
  category: keyof ReviewFindings,
  findingId: string,
  status: FindingStatus,
) {
  const user = await requireUser();
  const db = getDb();
  const [review] = await db
    .select({ id: tables.story_reviews.id, findings: tables.story_reviews.findings })
    .from(tables.story_reviews)
    .where(
      and(
        eq(tables.story_reviews.story_id, storyId),
        eq(tables.story_reviews.user_id, user.id),
      ),
    )
    .limit(1);
  if (!review) return;

  const findings = review.findings as ReviewFindings;
  const list = findings[category] as Array<{ id: string; status: FindingStatus }>;
  const finding = list?.find((f) => f.id === findingId);
  if (!finding) return;
  finding.status = status;

  await db
    .update(tables.story_reviews)
    .set({ findings })
    .where(eq(tables.story_reviews.id, review.id));
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
  const user = await requireUser();
  const db = getDb();
  const [chapter] = await db
    .select({
      id: tables.chapters.id,
      generated_text: tables.chapters.generated_text,
      edited_text: tables.chapters.edited_text,
    })
    .from(tables.chapters)
    .where(
      and(
        eq(tables.chapters.story_id, storyId),
        eq(tables.chapters.user_id, user.id),
      ),
    )
    .limit(1);
  if (!chapter) return { error: "No chapter to fix." };

  const base = chapter.edited_text || chapter.generated_text || "";
  if (!base.includes(find)) {
    return { error: "That text no longer appears in the chapter — re-run the review." };
  }

  await db
    .update(tables.chapters)
    .set({
      edited_text: base.replaceAll(find, replace),
      status: "edited",
      updated_at: nowIso(),
    })
    .where(eq(tables.chapters.id, chapter.id));

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
  const user = await requireUser();
  const db = getDb();
  const [story] = await db
    .select({
      id: tables.stories.id,
      name_replacements: tables.stories.name_replacements,
    })
    .from(tables.stories)
    .where(and(eq(tables.stories.id, storyId), eq(tables.stories.user_id, user.id)))
    .limit(1);
  if (!story) return { error: "Story not found." };

  const replacements = {
    ...(story.name_replacements ?? {}),
    [originalName]: newName,
  };
  await db
    .update(tables.stories)
    .set({ name_replacements: replacements, updated_at: nowIso() })
    .where(eq(tables.stories.id, storyId));

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
  const user = await requireUser();
  const db = getDb();
  const [existing] = await db
    .select({ id: tables.chapters.id })
    .from(tables.chapters)
    .where(
      and(
        eq(tables.chapters.story_id, storyId),
        eq(tables.chapters.user_id, user.id),
      ),
    )
    .limit(1);
  if (existing) return existing.id;

  const [story] = await db
    .select({ title: tables.stories.title })
    .from(tables.stories)
    .where(and(eq(tables.stories.id, storyId), eq(tables.stories.user_id, user.id)))
    .limit(1);
  const [created] = await db
    .insert(tables.chapters)
    .values({
      user_id: user.id,
      story_id: storyId,
      title: story?.title ?? "Untitled chapter",
      status: "empty",
    })
    .returning({ id: tables.chapters.id });
  revalidatePath(`/stories/${storyId}`);
  return created?.id ?? null;
}
