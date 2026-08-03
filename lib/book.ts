import { inArray, and, eq, asc } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { tables } from "@/lib/db";
import type { BookSettings, Chapter, ChapterLink, Photo, Story } from "@/lib/types";
import { signedReadUrl } from "@/lib/media";
import { qrDataUrl } from "@/lib/qr";

export interface BookChapter {
  story: Story;
  chapter: Chapter | null;
  text: string;
  photos: Array<{ url: string | null; caption: string | null }>;
  links: Array<{ url: string; label: string | null; qr: string }>;
}

export interface AssembledBook {
  settings: BookSettings | null;
  chapters: BookChapter[];
}

/**
 * Gathers everything needed to render a user's book, in chapter order. Photo
 * URLs are signed so the owner preview, public share page, and PDF renderer
 * can all use plain <img> tags. Signed URLs outlive the render (1 hour).
 */
export async function assembleBook(
  db: Db,
  userId: string,
): Promise<AssembledBook> {
  const [settings] = await db
    .select()
    .from(tables.book_settings)
    .where(eq(tables.book_settings.user_id, userId))
    .limit(1);

  const stories = (await db
    .select()
    .from(tables.stories)
    .where(
      and(
        eq(tables.stories.user_id, userId),
        eq(tables.stories.include_in_book, true),
      ),
    )) as Story[];

  // Order by chapter_number when set, otherwise sort_order.
  const ordered = stories.sort((a, b) => {
    const an = a.chapter_number ?? Number.MAX_SAFE_INTEGER;
    const bn = b.chapter_number ?? Number.MAX_SAFE_INTEGER;
    if (an !== bn) return an - bn;
    return a.sort_order - b.sort_order;
  });

  const storyIds = ordered.map((s) => s.id);
  const chapters = storyIds.length
    ? ((await db
        .select()
        .from(tables.chapters)
        .where(inArray(tables.chapters.story_id, storyIds))) as Chapter[])
    : [];
  const chapterByStory = new Map<string, Chapter>();
  chapters.forEach((c) => chapterByStory.set(c.story_id, c));

  const chapterIds = chapters.map((c) => c.id);
  const photos = chapterIds.length
    ? ((await db
        .select()
        .from(tables.photos)
        .where(inArray(tables.photos.chapter_id, chapterIds))
        .orderBy(asc(tables.photos.position))) as Photo[])
    : [];
  const links = chapterIds.length
    ? ((await db
        .select()
        .from(tables.chapter_links)
        .where(inArray(tables.chapter_links.chapter_id, chapterIds))
        .orderBy(asc(tables.chapter_links.position))) as ChapterLink[])
    : [];

  const result: BookChapter[] = [];
  for (const story of ordered) {
    const chapter = chapterByStory.get(story.id) ?? null;
    const text = chapter?.edited_text || chapter?.generated_text || "";
    if (!text.trim()) continue; // skip stories without a written chapter

    const chapterPhotos = chapter
      ? photos.filter((p) => p.chapter_id === chapter.id)
      : [];
    const chapterLinks = chapter
      ? links.filter((l) => l.chapter_id === chapter.id)
      : [];

    result.push({
      story,
      chapter,
      text,
      photos: await Promise.all(
        chapterPhotos.map(async (p) => ({
          url: await signedReadUrl(p.storage_bucket, p.storage_path),
          caption: p.caption,
        })),
      ),
      links: await Promise.all(
        chapterLinks.map(async (l) => ({
          url: l.url,
          label: l.label,
          qr: await qrDataUrl(l.url),
        })),
      ),
    });
  }

  return { settings: (settings as BookSettings | undefined) ?? null, chapters: result };
}
