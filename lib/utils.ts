import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** A tiny stable hash for prompt fingerprinting (not cryptographic). */
export function hashString(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatDate(input: string | null | undefined): string {
  if (!input) return "";
  const d = new Date(input);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Guess a file extension from a MIME type for storage paths. */
export function extFromMime(mime: string | null | undefined): string {
  if (!mime) return "bin";
  const map: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "video/webm": "webm",
    "video/mp4": "mp4",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return map[mime] ?? mime.split("/")[1]?.split(";")[0] ?? "bin";
}
