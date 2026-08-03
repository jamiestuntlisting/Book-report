// Media storage on R2, served exclusively through /api/media/* app routes.
// Objects keep the old bucket/path split from the DB rows; the R2 object key
// is "<bucket>/<path>" where path always starts with the owner's userId.
//
// Read access is granted by any one of:
//   1. a session cookie whose user owns the object (path's first segment),
//   2. a short-lived signed URL (exp + HMAC) — used by share pages and the
//      print page so plain <img>/<video>/<audio> tags work,
//   3. the PDF_RENDER_TOKEN bearer header (Browser Rendering fetching assets).
import { serverEnv } from "@/lib/env";
import { hmacSign, hmacVerify } from "@/lib/auth/crypto";

export const BUCKETS = {
  audio: "audio",
  video: "video",
  photos: "photos",
  exports: "exports",
} as const;

const SIGNED_URL_TTL = 60 * 60; // 1 hour

export function mediaKey(bucket: string, path: string): string {
  return `${bucket}/${path}`;
}

/** Relative URL for an object with a time-limited access signature. */
export async function signedReadUrl(
  bucket: string,
  path: string,
  ttl: number = SIGNED_URL_TTL,
): Promise<string> {
  const key = mediaKey(bucket, path);
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const sig = await hmacSign(serverEnv.authSecret, `media:${key}:${exp}`);
  return `/api/media/${key}?exp=${exp}&sig=${sig}`;
}

export async function verifyMediaSig(
  key: string,
  exp: string | null,
  sig: string | null,
): Promise<boolean> {
  if (!exp || !sig) return false;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
  return hmacVerify(serverEnv.authSecret, `media:${key}:${exp}`, sig);
}

/** Storage path for a recording: {user}/{story}/{recording}.{ext} */
export function recordingPath(
  userId: string,
  storyId: string,
  recordingId: string,
  ext: string,
): string {
  return `${userId}/${storyId}/${recordingId}.${ext}`;
}

/** Storage path for a chapter photo: {user}/{chapter}/{photo}.{ext} */
export function photoPath(
  userId: string,
  chapterId: string,
  photoId: string,
  ext: string,
): string {
  return `${userId}/${chapterId}/${photoId}.${ext}`;
}

/** The userId embedded in an object key ("<bucket>/<userId>/..."), or null. */
export function keyOwner(key: string): string | null {
  const segments = key.split("/");
  return segments.length >= 3 ? segments[1] : null;
}
