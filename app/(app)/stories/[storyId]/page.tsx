import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb, tables } from "@/lib/db";
import { signedReadUrl } from "@/lib/media";
import { StoryHeader } from "@/components/story/story-header";
import { RecordingsList } from "@/components/story/recordings-list";
import { ChapterPanel } from "@/components/story/chapter-panel";
import { Recorder } from "@/components/recorder/recorder";
import { ReviewPanel } from "@/components/story/review-panel";
import type {
  Chapter,
  ChapterLink,
  Photo,
  Recording,
  Story,
  StoryReview,
  Transcript,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StoryPage({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const { storyId } = await params;
  const user = await requireUser();
  const db = getDb();

  const [storyRow] = await db
    .select()
    .from(tables.stories)
    .where(and(eq(tables.stories.id, storyId), eq(tables.stories.user_id, user.id)))
    .limit(1);
  if (!storyRow) notFound();
  const s = storyRow as Story;

  const recordings = (await db
    .select()
    .from(tables.recordings)
    .where(eq(tables.recordings.story_id, storyId))
    .orderBy(asc(tables.recordings.sort_order))) as Recording[];

  // Sign playback URLs + gather transcripts.
  const recordingIds = recordings.map((r) => r.id);
  const transcripts = recordingIds.length
    ? ((await db
        .select()
        .from(tables.transcripts)
        .where(inArray(tables.transcripts.recording_id, recordingIds))) as Transcript[])
    : [];

  const playback = await Promise.all(
    recordings.map(async (r) => ({
      recording: r,
      url: await signedReadUrl(r.storage_bucket, r.storage_path),
      transcript: transcripts.find((t) => t.recording_id === r.id) ?? null,
    })),
  );

  const [chapterRow] = await db
    .select()
    .from(tables.chapters)
    .where(eq(tables.chapters.story_id, storyId))
    .limit(1);
  const chapter = (chapterRow as Chapter | undefined) ?? null;

  let photos: Array<Photo & { url: string | null }> = [];
  let links: ChapterLink[] = [];
  if (chapter) {
    const photoRows = (await db
      .select()
      .from(tables.photos)
      .where(eq(tables.photos.chapter_id, chapter.id))
      .orderBy(asc(tables.photos.position))) as Photo[];
    photos = await Promise.all(
      photoRows.map(async (p) => ({
        ...p,
        url: await signedReadUrl(p.storage_bucket, p.storage_path),
      })),
    );
    links = (await db
      .select()
      .from(tables.chapter_links)
      .where(eq(tables.chapter_links.chapter_id, chapter.id))
      .orderBy(asc(tables.chapter_links.position))) as ChapterLink[];
  }

  const doneTranscriptIds = transcripts
    .filter((t) => t.status === "done")
    .map((t) => t.id);

  const [reviewRow] = await db
    .select()
    .from(tables.story_reviews)
    .where(eq(tables.story_reviews.story_id, storyId))
    .limit(1);
  const review = (reviewRow as StoryReview | undefined) ?? null;
  const hasChapterText = Boolean(chapter?.edited_text || chapter?.generated_text);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ink-soft hover:underline">
          ← Back to stories
        </Link>
        <StoryHeader story={s} />
        {s.prompt_text && (
          <p className="mt-2 rounded-lg bg-black/[0.03] px-4 py-3 font-serif text-lg italic text-ink-soft">
            “{s.prompt_text}”
          </p>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Record your answer
        </h2>
        <Recorder storyId={storyId} />
      </section>

      {playback.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-ink-soft">
            Recordings & transcripts
          </h2>
          <RecordingsList items={playback} />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Your chapter
        </h2>
        <ChapterPanel
          storyId={storyId}
          chapter={chapter}
          photos={photos}
          links={links}
          hasTranscripts={doneTranscriptIds.length > 0}
          transcriptCount={doneTranscriptIds.length}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Story check
        </h2>
        <ReviewPanel storyId={storyId} review={review} hasChapter={hasChapterText} />
      </section>
    </div>
  );
}
