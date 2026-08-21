"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Video, Square, Upload } from "lucide-react";
import { uploadMedia } from "@/lib/upload-client";
import { Button } from "@/components/ui";
import { formatDuration } from "@/lib/utils";

type Kind = "audio" | "video";
type Phase = "idle" | "recording" | "uploading" | "transcribing" | "error";

export function Recorder({ storyId }: { storyId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("audio");
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoPreview = useRef<HTMLVideoElement | null>(null);

  const stopTracks = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (timer.current) clearInterval(timer.current);
  }, []);

  async function start() {
    setError("");
    try {
      const constraints: MediaStreamConstraints =
        kind === "video" ? { audio: true, video: true } : { audio: true };
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      stream.current = s;
      if (kind === "video" && videoPreview.current) {
        videoPreview.current.srcObject = s;
        await videoPreview.current.play().catch(() => {});
      }
      chunks.current = [];
      const mr = new MediaRecorder(s);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      mr.onstop = () => handleUpload();
      mr.start();
      mediaRecorder.current = mr;
      setSeconds(0);
      setPhase("recording");
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Couldn't access your microphone/camera. Check permissions.");
      setPhase("error");
    }
  }

  function stop() {
    mediaRecorder.current?.stop();
    if (timer.current) clearInterval(timer.current);
  }

  async function handleUpload() {
    const duration = seconds;
    stopTracks();
    setPhase("uploading");
    try {
      const mimeType = mediaRecorder.current?.mimeType || (kind === "video" ? "video/webm" : "audio/webm");
      const blob = new Blob(chunks.current, { type: mimeType });

      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "recording", storyId, kind, mimeType }),
      });
      if (!signRes.ok) throw new Error((await signRes.json()).error ?? "sign failed");
      const { id, bucket, path, key } = await signRes.json();

      await uploadMedia(key, blob, mimeType);

      const recRes = await fetch("/api/recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          storyId,
          bucket,
          path,
          kind,
          mimeType,
          sizeBytes: blob.size,
          durationSeconds: duration,
        }),
      });
      if (!recRes.ok) throw new Error((await recRes.json()).error ?? "register failed");

      setPhase("transcribing");
      const txRes = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingId: id }),
      });
      if (!txRes.ok) {
        // Recording is saved even if transcription fails; surface a soft error.
        const msg = (await txRes.json()).error ?? "transcription failed";
        setError(`Saved, but transcription failed: ${msg}`);
      }

      setPhase("idle");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setPhase("error");
    }
  }

  const busy = phase === "uploading" || phase === "transcribing";

  return (
    <div className="rounded-xl border border-black/10 bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setKind("audio")}
          disabled={phase === "recording" || busy}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
            kind === "audio" ? "bg-accent/10 text-accent" : "text-ink-soft hover:bg-black/[0.04]"
          }`}
        >
          <Mic size={16} /> Audio
        </button>
        <button
          onClick={() => setKind("video")}
          disabled={phase === "recording" || busy}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
            kind === "video" ? "bg-accent/10 text-accent" : "text-ink-soft hover:bg-black/[0.04]"
          }`}
        >
          <Video size={16} /> Video
        </button>
      </div>

      {kind === "video" && (
        <video
          ref={videoPreview}
          muted
          playsInline
          className={`mb-4 w-full rounded-lg bg-black ${phase === "recording" ? "block" : "hidden"}`}
        />
      )}

      <div className="flex items-center gap-4">
        {phase === "recording" ? (
          <Button variant="danger" onClick={stop}>
            <Square size={16} /> Stop ({formatDuration(seconds)})
          </Button>
        ) : (
          <Button onClick={start} disabled={busy}>
            {kind === "video" ? <Video size={16} /> : <Mic size={16} />}
            {busy ? "Working…" : `Record ${kind}`}
          </Button>
        )}

        {phase === "recording" && (
          <span className="flex items-center gap-2 text-sm text-red-600">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
            Recording…
          </span>
        )}
        {phase === "uploading" && <span className="text-sm text-ink-soft">Uploading…</span>}
        {phase === "transcribing" && (
          <span className="text-sm text-ink-soft">Transcribing your memo…</span>
        )}
      </div>

      <FileFallback storyId={storyId} kind={kind} disabled={busy || phase === "recording"} onDone={() => router.refresh()} setError={setError} />

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}

// Upload-a-file fallback for browsers without MediaRecorder support.
function FileFallback({
  storyId,
  kind,
  disabled,
  onDone,
  setError,
}: {
  storyId: string;
  kind: Kind;
  disabled: boolean;
  onDone: () => void;
  setError: (s: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const mimeType = file.type || (kind === "video" ? "video/mp4" : "audio/mpeg");
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "recording", storyId, kind, mimeType }),
      });
      if (!signRes.ok) throw new Error((await signRes.json()).error ?? "sign failed");
      const { id, bucket, path, key } = await signRes.json();
      await uploadMedia(key, file, mimeType);
      await fetch("/api/recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, storyId, bucket, path, kind, mimeType, sizeBytes: file.size }),
      });
      await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingId: id }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <label className="mt-3 flex w-fit cursor-pointer items-center gap-1.5 text-xs text-ink-soft hover:text-accent">
      <Upload size={14} />
      {uploading ? "Uploading file…" : "…or upload a file"}
      <input
        type="file"
        accept={kind === "video" ? "video/*" : "audio/*"}
        className="hidden"
        disabled={disabled || uploading}
        onChange={onFile}
      />
    </label>
  );
}
