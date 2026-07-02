"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui";
import { reorderStories, updateStoryMeta } from "@/app/(app)/stories/actions";
import type { Story, StoryStatus } from "@/lib/types";

const statusTone: Record<StoryStatus, "gray" | "amber" | "blue" | "green"> = {
  draft: "gray",
  recording: "amber",
  transcribing: "amber",
  generating: "blue",
  ready: "green",
};

function Row({
  story,
  chapterStatus,
}: {
  story: Story;
  chapterStatus: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: story.id });
  const [, startTransition] = useTransition();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 border-b border-black/[0.06] bg-white px-4 py-3 last:border-0"
    >
      <button
        className="cursor-grab touch-none text-black/30 hover:text-black/60"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical size={18} />
      </button>

      <input
        type="number"
        defaultValue={story.chapter_number ?? ""}
        placeholder="#"
        className="h-8 w-12 rounded border border-black/15 text-center text-sm"
        onBlur={(e) =>
          startTransition(() =>
            updateStoryMeta(story.id, {
              chapter_number: e.target.value ? Number(e.target.value) : null,
            }),
          )
        }
        aria-label="Chapter number"
      />

      <Link
        href={`/stories/${story.id}`}
        className="flex-1 font-serif text-lg text-ink hover:text-accent hover:underline"
      >
        {story.title}
      </Link>

      <Badge tone={statusTone[story.status]}>{story.status}</Badge>
      {chapterStatus && chapterStatus !== "empty" && (
        <Badge tone="green">chapter</Badge>
      )}

      <label className="flex items-center gap-1.5 text-xs text-ink-soft">
        <input
          type="checkbox"
          defaultChecked={story.include_in_book}
          onChange={(e) =>
            startTransition(() =>
              updateStoryMeta(story.id, { include_in_book: e.target.checked }),
            )
          }
        />
        in book
      </label>
    </div>
  );
}

export function StoryTable({
  stories,
  chapterStatus,
}: {
  stories: Story[];
  chapterStatus: Record<string, string | null>;
}) {
  const [items, setItems] = useState(stories);
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((s) => s.id === active.id);
    const newIndex = items.findIndex((s) => s.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    startTransition(() => reorderStories(next.map((s) => s.id)));
  }

  return (
    <div className="overflow-hidden rounded-xl border border-black/10">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={items.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((story) => (
            <Row
              key={story.id}
              story={story}
              chapterStatus={chapterStatus[story.id] ?? null}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
