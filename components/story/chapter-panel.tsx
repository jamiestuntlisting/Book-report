"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, RefreshCw, Plus, Pencil } from "lucide-react";
import { Button, Textarea, Input } from "@/components/ui";
import { ChapterMarkdown } from "@/components/chapter-markdown";
import { PhotoManager } from "@/components/story/photo-manager";
import { LinkManager } from "@/components/story/link-manager";
import {
  saveChapterEdit,
  updateChapterTitle,
  ensureChapter,
} from "@/app/(app)/stories/[storyId]/actions";
import type { Chapter, ChapterLink, Photo } from "@/lib/types";

interface Props {
  storyId: string;
  chapter: Chapter | null;
  photos: Array<Photo & { url: string | null }>;
  links: ChapterLink[];
  hasTranscripts: boolean;
  transcriptCount: number;
}

export function ChapterPanel({
  storyId,
  chapter,
  photos,
  links,
  hasTranscripts,
  transcriptCount,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | string>(null);
  const [error, setError] = useState("");
  const [guidance, setGuidance] = useState("");
  const [showGuidance, setShowGuidance] = useState(false);

  const text = chapter?.edited_text || chapter?.generated_text || "";
  const hasText = Boolean(text.trim());

  async function callGenerate(regenerate: boolean) {
    setBusy(regenerate ? "regenerate" : "generate");
    setError("");
    try {
      const res = await fetch("/api/chapters/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, regenerate, guidance: guidance || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "generation failed");
      setGuidance("");
      setShowGuidance(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "generation failed");
    } finally {
      setBusy(null);
    }
  }

  async function callAppend() {
    // Re-integrate ALL of the story's transcripts into the chapter.
    setBusy("append");
    setError("");
    try {
      const idsRes = await fetch(`/api/chapters/transcript-ids?storyId=${storyId}`);
      const { ids } = await idsRes.json();
      if (!ids?.length) throw new Error("No transcripts to append.");
      const res = await fetch("/api/chapters/append", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, newTranscriptIds: ids }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "append failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "append failed");
    } finally {
      setBusy(null);
    }
  }

  if (!hasText) {
    return (
      <div className="rounded-xl border border-black/10 bg-white p-6">
        {!hasTranscripts ? (
          <p className="text-ink-soft">
            Record a memo above. Once it&apos;s transcribed, you can turn it into
            a chapter written in your voice.
          </p>
        ) : (
          <>
            <p className="mb-4 text-ink-soft">
              You have {transcriptCount} transcribed{" "}
              {transcriptCount === 1 ? "memo" : "memos"}. Generate your chapter —
              Claude will write it in your voice and won&apos;t invent anything.
            </p>
            <Button onClick={() => callGenerate(false)} disabled={busy !== null}>
              <Sparkles size={16} />
              {busy === "generate" ? "Writing your chapter…" : "Generate chapter"}
            </Button>
          </>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-black/10 bg-white p-6">
        <ChapterTitle chapter={chapter!} storyId={storyId} />

        {chapter && (
          <ChapterEditor chapter={chapter} storyId={storyId} text={text} />
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-black/[0.06] pt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowGuidance((v) => !v)}
            disabled={busy !== null}
          >
            <RefreshCw size={14} /> Regenerate
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={callAppend}
            disabled={busy !== null}
          >
            <Plus size={14} />
            {busy === "append" ? "Merging…" : "Merge in new memos"}
          </Button>
        </div>

        {showGuidance && (
          <div className="mt-3 flex gap-2">
            <Input
              placeholder='Optional direction — e.g. "tighter", "keep the horse joke"'
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
            />
            <Button size="sm" onClick={() => callGenerate(true)} disabled={busy !== null}>
              {busy === "regenerate" ? "Rewriting…" : "Rewrite"}
            </Button>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      <PhotoManager
        storyId={storyId}
        chapterId={chapter!.id}
        photos={photos}
        ensureChapterAction={ensureChapter}
      />
      <LinkManager storyId={storyId} chapterId={chapter!.id} links={links} />
    </div>
  );
}

function ChapterTitle({ chapter, storyId }: { chapter: Chapter; storyId: string }) {
  const [title, setTitle] = useState(chapter.title ?? "");
  const [, startTransition] = useTransition();
  return (
    <input
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={() => {
        if (title !== (chapter.title ?? "")) {
          startTransition(() => updateChapterTitle(chapter.id, storyId, title));
        }
      }}
      placeholder="Chapter title"
      className="mb-4 w-full border-0 border-b border-transparent bg-transparent font-serif text-2xl font-bold text-ink outline-none focus:border-black/20"
    />
  );
}

function ChapterEditor({
  chapter,
  storyId,
  text,
}: {
  chapter: Chapter;
  storyId: string;
  text: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [, startTransition] = useTransition();

  if (!editing) {
    return (
      <div>
        <ChapterMarkdown text={text} />
        <button
          onClick={() => {
            setDraft(text);
            setEditing(true);
          }}
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-accent"
        >
          <Pencil size={14} /> Edit text
        </button>
      </div>
    );
  }

  return (
    <div>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={16}
        className="font-serif text-base leading-relaxed"
      />
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          onClick={() =>
            startTransition(async () => {
              await saveChapterEdit(chapter.id, storyId, draft);
              setEditing(false);
              router.refresh();
            })
          }
        >
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <span className="self-center text-xs text-ink-soft">
          Markdown — *italic*, **bold**, blank line for a new paragraph.
        </span>
      </div>
    </div>
  );
}
