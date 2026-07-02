"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import type { VoiceStyleProfile } from "@/lib/types";

export function VoiceProfileCard({ voice }: { voice: VoiceStyleProfile | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/voice-profile", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-serif text-lg text-ink">Your voice profile</h2>
        <Button variant="secondary" size="sm" onClick={refresh} disabled={busy}>
          <RefreshCw size={14} /> {busy ? "Analyzing…" : "Rebuild"}
        </Button>
      </div>
      <p className="mb-3 text-sm text-ink-soft">
        This is how the AI learns to write in your voice. It&apos;s built from
        your transcripts and updates as you record more.
      </p>

      {voice?.summary ? (
        <>
          <p className="rounded-lg bg-black/[0.03] p-3 font-serif italic text-ink">
            {voice.summary}
          </p>
          <p className="mt-2 text-xs text-ink-soft">Version {voice.version}</p>
        </>
      ) : (
        <p className="text-sm text-ink-soft">
          No profile yet — record and transcribe a memo, then rebuild.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
