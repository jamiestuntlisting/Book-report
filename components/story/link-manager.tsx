"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { QrCode, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { addChapterLink, deleteChapterLink } from "@/app/(app)/stories/[storyId]/actions";
import type { ChapterLink } from "@/lib/types";

export function LinkManager({
  storyId,
  chapterId,
  links,
}: {
  storyId: string;
  chapterId: string;
  links: ChapterLink[];
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [, startTransition] = useTransition();

  function add() {
    if (!url.trim()) return;
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    startTransition(async () => {
      await addChapterLink(chapterId, storyId, normalized, label);
      setUrl("");
      setLabel("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-5">
      <h3 className="mb-1 flex items-center gap-2 font-serif text-lg text-ink">
        <QrCode size={18} /> Links (printed as QR codes)
      </h3>
      <p className="mb-3 text-sm text-ink-soft">
        Add a behind-the-scenes video or a page — it becomes a scannable QR code
        in the printed book.
      </p>

      {links.length > 0 && (
        <ul className="mb-4 space-y-2">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between rounded-lg bg-black/[0.03] px-3 py-2 text-sm">
              <span className="truncate">
                <span className="font-medium">{l.label || l.url}</span>
                {l.label && <span className="ml-2 text-ink-soft">{l.url}</span>}
              </span>
              <button
                onClick={() =>
                  startTransition(async () => {
                    await deleteChapterLink(l.id, storyId);
                    router.refresh();
                  })
                }
                className="ml-2 text-black/30 hover:text-red-600"
                aria-label="Remove link"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} className="max-w-[12rem]" />
        <Input placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} className="max-w-xs" />
        <Button size="sm" onClick={add}>Add link</Button>
      </div>
    </div>
  );
}
