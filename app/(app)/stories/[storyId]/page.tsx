import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { signedReadUrl } from "@/lib/storage";
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
  const user = await getUser();
  const supabase = await createClient();

  const { data: story } = await supabase
    .from("stories")
    .select("*")
    .eq("id", storyId)
    .eq("user_id", user!.id)
    .maybeSingle();
  if (!story) notFound();
  const s = story as Story;

  const { data: recordingsRaw } = await supabase
    .from("recordings")
    .select("*")
    .eq("story_id", storyId)
    .order("sort_order", { ascending: true });
  const recordings = (recordingsRaw ?? []) as Recording[];

  // Sign playback URLs + gather transcripts.
  const recordingIds = recordings.map((r) => r.id);
  const { data: transcriptsRaw } = recordingIds.length
    ? await supabase.from("transcripts").select("*").in("recording_id", recordingIds)
    : { data: [] };
  const transcripts = (transcriptsRaw ?? []) as Transcript[];

  const playback = await Promise.all(
    recordings.map(async (r) => ({
      recording: r,
      url: await signedReadUrl(supabase, r.storage_bucket, r.storage_path),
      transcript: transcripts.find((t) => t.recording_id === r.id) ?? null,
    })),
  );

  const { data: chapterRaw } = await supabase
    .from("chapters")
    .select("*")
    .eq("story_id", storyId)
    .maybeSingle();
  const chapter = (chapterRaw as Chapter) ?? null;

  let photos: Array<Photo & { url: string | null }> = [];
  let links: ChapterLink[] = [];
  if (chapter) {
    const { data: photoRows } = await supabase
      .from("photos")
      .select("*")
      .eq("chapter_id", chapter.id)
      .order("position", { ascending: true });
    photos = await Promise.all(
      ((photoRows ?? []) as Photo[]).map(async (p) => ({
        ...p,
        url: await signedReadUrl(supabase, p.storage_bucket, p.storage_path),
      })),
    );
    const { data: linkRows } = await supabase
      .from("chapter_links")
      .select("*")
      .eq("chapter_id", chapter.id)
      .order("position", { ascending: true });
    links = (linkRows ?? []) as ChapterLink[];
  }

  const doneTranscriptIds = transcripts.filter((t) => t.status === "done").map((t) => t.id);

  const { data: reviewRaw } = await supabase
    .from("story_reviews")
    .select("*")
    .eq("story_id", storyId)
    .maybeSingle();
  const review = (reviewRaw as StoryReview) ?? null;
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
