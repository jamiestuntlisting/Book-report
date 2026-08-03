"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImagePlus, X } from "lucide-react";
import { uploadMedia } from "@/lib/upload-client";
import { Button, Input } from "@/components/ui";
import { registerPhoto, deletePhoto } from "@/app/(app)/stories/[storyId]/actions";
import type { Photo } from "@/lib/types";

export function PhotoManager({
  storyId,
  chapterId,
  photos,
  ensureChapterAction,
}: {
  storyId: string;
  chapterId: string;
  photos: Array<Photo & { url: string | null }>;
  ensureChapterAction: (storyId: string) => Promise<string | null>;
}) {
  const router = useRouter();
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const cid = chapterId || (await ensureChapterAction(storyId));
      if (!cid) throw new Error("Could not attach photo.");
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "photo", chapterId: cid, mimeType: file.type }),
      });
      if (!signRes.ok) throw new Error((await signRes.json()).error ?? "sign failed");
      const { bucket, path, key } = await signRes.json();
      await uploadMedia(key, file, file.type);
      await registerPhoto(cid, storyId, bucket, path, caption);
      setCaption("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-5">
      <h3 className="mb-3 font-serif text-lg text-ink">Photos</h3>

      {photos.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p) => (
            <figure key={p.id} className="group relative">
              {p.url && (
                <Image
                  src={p.url}
                  alt={p.caption ?? "Chapter photo"}
                  width={300}
                  height={200}
                  className="h-32 w-full rounded-lg object-cover"
                  unoptimized
                />
              )}
              <button
                onClick={() =>
                  startTransition(async () => {
                    await deletePhoto(p.id, storyId);
                    router.refresh();
                  })
                }
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Remove photo"
              >
                <X size={14} />
              </button>
              {p.caption && (
                <figcaption className="mt-1 text-xs text-ink-soft">{p.caption}</figcaption>
              )}
            </figure>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Caption (optional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="max-w-xs"
        />
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-black/15 bg-white px-4 py-2 text-sm font-medium hover:bg-black/[0.03]">
          <ImagePlus size={16} />
          {uploading ? "Uploading…" : "Add photo"}
          <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={uploading} />
        </label>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
