"use client";

import { useState } from "react";
import { Download, Share2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui";

export function BookActions({ chapterCount }: { chapterCount: number }) {
  const [busy, setBusy] = useState<null | string>(null);
  const [error, setError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);

  async function exportPdf() {
    setBusy("pdf");
    setError("");
    try {
      const res = await fetch("/api/book/export", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "export failed");
      const { url } = await res.json();
      window.open(url, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "export failed");
    } finally {
      setBusy(null);
    }
  }

  async function createShare() {
    setBusy("share");
    setError("");
    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "book" }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "share failed");
      const { url } = await res.json();
      setShareUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "share failed");
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <Button variant="secondary" onClick={createShare} disabled={busy !== null || chapterCount === 0}>
          <Share2 size={16} /> {busy === "share" ? "Creating…" : "Share"}
        </Button>
        <Button onClick={exportPdf} disabled={busy !== null || chapterCount === 0}>
          <Download size={16} /> {busy === "pdf" ? "Building PDF…" : "Export PDF"}
        </Button>
      </div>
      {shareUrl && (
        <div className="flex items-center gap-2 rounded-lg bg-black/[0.04] px-3 py-1.5 text-sm">
          <span className="max-w-[16rem] truncate text-ink-soft">{shareUrl}</span>
          <button onClick={copy} className="text-accent hover:underline" aria-label="Copy share link">
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
      )}
      {chapterCount === 0 && (
        <p className="text-xs text-ink-soft">Write at least one chapter first.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
