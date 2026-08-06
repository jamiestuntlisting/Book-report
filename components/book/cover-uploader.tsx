"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImagePlus, X } from "lucide-react";
import { uploadMedia } from "@/lib/upload-client";
import { saveCoverImage } from "@/app/(app)/book/actions";

export function CoverUploader({ coverUrl }: { coverUrl: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "cover", mimeType: file.type }),
      });
      if (!signRes.ok) throw new Error("Couldn't start the upload.");
      const { path, key } = await signRes.json();
      await uploadMedia(key, file, file.type);
      await saveCoverImage(path);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeCover() {
    setBusy(true);
    await saveCoverImage(null);
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">Cover image</p>
      {coverUrl ? (
        <div className="flex items-start gap-3">
          <Image
            src={coverUrl}
            alt="Book cover"
            width={120}
            height={180}
            className="rounded border border-black/10 object-cover"
            unoptimized
          />
          <button
            type="button"
            onClick={removeCover}
            disabled={busy}
            className="flex items-center gap-1 text-sm text-ink-soft hover:text-red-600"
          >
            <X size={14} /> Remove
          </button>
        </div>
      ) : (
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-black/20 px-4 py-3 text-sm text-ink-soft hover:border-accent hover:text-accent">
          <ImagePlus size={16} />
          {busy ? "Uploading…" : "Add a cover photo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={onFile}
          />
        </label>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
