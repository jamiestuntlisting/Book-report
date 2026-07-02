import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { Button } from "@/components/ui";
import { StoryTable } from "@/components/dashboard/story-table";
import type { Chapter, Story } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getUser();
  const supabase = await createClient();

  const { data: stories } = await supabase
    .from("stories")
    .select("*")
    .eq("user_id", user!.id)
    .order("sort_order", { ascending: true });

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, story_id, status");

  const chapterByStory = new Map<string, Pick<Chapter, "id" | "status">>();
  (chapters ?? []).forEach((c) =>
    chapterByStory.set(c.story_id, { id: c.id, status: c.status }),
  );

  const list = (stories ?? []) as Story[];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">Your stories</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {list.length} {list.length === 1 ? "story" : "stories"} · drag to
            order them as chapters
          </p>
        </div>
        <Link href="/stories/new">
          <Button>+ New story</Button>
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/20 bg-white/50 p-12 text-center">
          <p className="font-serif text-xl text-ink">No stories yet.</p>
          <p className="mt-2 text-sm text-ink-soft">
            Start with a prompt and just talk — we&apos;ll do the rest.
          </p>
          <Link href="/stories/new" className="mt-4 inline-block">
            <Button>Tell your first story</Button>
          </Link>
        </div>
      ) : (
        <StoryTable
          stories={list}
          chapterStatus={Object.fromEntries(
            list.map((s) => [s.id, chapterByStory.get(s.id)?.status ?? null]),
          )}
        />
      )}
    </div>
  );
}
