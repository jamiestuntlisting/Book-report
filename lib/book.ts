import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookSettings, Chapter, ChapterLink, Photo, Story } from "@/lib/types";
import { signedReadUrl } from "@/lib/storage";
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
 * Gathers everything needed to render a user's book, in chapter order. Works
 * with either the session client (owner preview) or the admin client (public
 * share / PDF render), since it only reads by user_id.
 */
export async function assembleBook(
  supabase: SupabaseClient,
  userId: string,
): Promise<AssembledBook> {
  const { data: settings } = await supabase
    .from("book_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: stories } = await supabase
    .from("stories")
    .select("*")
    .eq("user_id", userId)
    .eq("include_in_book", true);

  // Order by chapter_number when set, otherwise sort_order.
  const ordered = ((stories ?? []) as Story[]).sort((a, b) => {
    const an = a.chapter_number ?? Number.MAX_SAFE_INTEGER;
    const bn = b.chapter_number ?? Number.MAX_SAFE_INTEGER;
    if (an !== bn) return an - bn;
    return a.sort_order - b.sort_order;
  });

  const storyIds = ordered.map((s) => s.id);
  const { data: chapters } = storyIds.length
    ? await supabase.from("chapters").select("*").in("story_id", storyIds)
    : { data: [] };
  const chapterByStory = new Map<string, Chapter>();
  ((chapters ?? []) as Chapter[]).forEach((c) => chapterByStory.set(c.story_id, c));

  const chapterIds = ((chapters ?? []) as Chapter[]).map((c) => c.id);
  const { data: photos } = chapterIds.length
    ? await supabase.from("photos").select("*").in("chapter_id", chapterIds).order("position")
    : { data: [] };
  const { data: links } = chapterIds.length
    ? await supabase.from("chapter_links").select("*").in("chapter_id", chapterIds).order("position")
    : { data: [] };

  const result: BookChapter[] = [];
  for (const story of ordered) {
    const chapter = chapterByStory.get(story.id) ?? null;
    const text = chapter?.edited_text || chapter?.generated_text || "";
    if (!text.trim()) continue; // skip stories without a written chapter

    const chapterPhotos = chapter
      ? ((photos ?? []) as Photo[]).filter((p) => p.chapter_id === chapter.id)
      : [];
    const chapterLinks = chapter
      ? ((links ?? []) as ChapterLink[]).filter((l) => l.chapter_id === chapter.id)
      : [];

    result.push({
      story,
      chapter,
      text,
      photos: await Promise.all(
        chapterPhotos.map(async (p) => ({
          url: await signedReadUrl(supabase, p.storage_bucket, p.storage_path),
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

  return { settings: (settings as BookSettings) ?? null, chapters: result };
}
