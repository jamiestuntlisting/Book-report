import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createStory } from "@/app/(app)/stories/actions";
import { Button, Input, Label } from "@/components/ui";
import type { TemplateQuestion } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewStoryPage() {
  const supabase = await createClient();
  const { data: questions } = await supabase
    .from("template_questions")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const list = (questions ?? []) as TemplateQuestion[];

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard" className="text-sm text-ink-soft hover:underline">
        ← Back to stories
      </Link>
      <h1 className="mt-2 font-serif text-3xl font-bold text-ink">
        Start a new story
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Pick a prompt to answer, or start from a blank page. You&apos;ll record
        your answer on the next screen.
      </p>

      <div className="mt-6 space-y-3">
        {list.map((q) => (
          <form key={q.id} action={createStory}>
            <input type="hidden" name="template_question_id" value={q.id} />
            <input type="hidden" name="prompt_text" value={q.prompt} />
            <input type="hidden" name="title" value={q.prompt} />
            <button
              type="submit"
              className="w-full rounded-lg border border-black/10 bg-white p-4 text-left transition-colors hover:border-accent hover:bg-accent/[0.03]"
            >
              <p className="font-serif text-lg text-ink">{q.prompt}</p>
              {q.helper_text && (
                <p className="mt-1 text-sm text-ink-soft">{q.helper_text}</p>
              )}
            </button>
          </form>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-black/10 bg-white p-5">
        <h2 className="mb-3 font-serif text-lg text-ink">Or start blank</h2>
        <form action={createStory} className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="title" className="sr-only">
              Story title
            </Label>
            <Input id="title" name="title" placeholder="Give your story a title…" required />
          </div>
          <Button type="submit">Create</Button>
        </form>
      </div>
    </div>
  );
}
