import { formatDuration } from "@/lib/utils";
import type { Recording, Transcript } from "@/lib/types";

interface Item {
  recording: Recording;
  url: string | null;
  transcript: Transcript | null;
}

export function RecordingsList({ items }: { items: Item[] }) {
  return (
    <div className="space-y-4">
      {items.map(({ recording, url, transcript }, i) => (
        <div key={recording.id} className="rounded-xl border border-black/10 bg-white p-4">
          <div className="mb-2 flex items-center justify-between text-sm text-ink-soft">
            <span className="font-medium">
              Take {i + 1} · {recording.kind}
              {recording.duration_seconds
                ? ` · ${formatDuration(recording.duration_seconds)}`
                : ""}
              {recording.source === "interview_zoom" ? " · interview" : ""}
            </span>
          </div>

          {url ? (
            recording.kind === "video" ? (
              <video src={url} controls className="w-full rounded-lg bg-black" />
            ) : (
              <audio src={url} controls className="w-full" />
            )
          ) : (
            <p className="text-sm text-red-600">Could not load media.</p>
          )}

          <div className="mt-3 border-t border-black/[0.06] pt-3">
            {transcript?.status === "done" && transcript.text ? (
              <details>
                <summary className="cursor-pointer text-sm font-medium text-ink-soft hover:text-accent">
                  Transcript
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-sm text-ink">
                  {transcript.text}
                </p>
              </details>
            ) : transcript?.status === "error" ? (
              <p className="text-sm text-red-600">
                Transcription failed: {transcript.error}
              </p>
            ) : transcript?.status === "running" || transcript?.status === "queued" ? (
              <p className="text-sm text-ink-soft">Transcribing…</p>
            ) : (
              <p className="text-sm text-ink-soft">No transcript yet.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
