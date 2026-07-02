"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { renameStory, deleteStory } from "@/app/(app)/stories/actions";
import type { Story } from "@/lib/types";

export function StoryHeader({ story }: { story: Story }) {
  const [title, setTitle] = useState(story.title);
  const [, startTransition] = useTransition();

  return (
    <div className="mt-2 flex items-start justify-between gap-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (title.trim() && title !== story.title) {
            startTransition(() => renameStory(story.id, title.trim()));
          }
        }}
        className="w-full border-0 border-b border-transparent bg-transparent font-serif text-3xl font-bold text-ink outline-none focus:border-black/20"
        aria-label="Story title"
      />
      <button
        onClick={() => {
          if (confirm("Delete this story, its recordings, and its chapter?")) {
            startTransition(() => deleteStory(story.id));
          }
        }}
        className="mt-2 shrink-0 text-black/30 hover:text-red-600"
        aria-label="Delete story"
      >
        <Trash2 size={20} />
      </button>
    </div>
  );
}
