import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKETS = {
  audio: "audio",
  video: "video",
  photos: "photos",
  exports: "exports",
} as const;

const SIGNED_URL_TTL = 60 * 60; // 1 hour

/** Create a short-lived signed URL for reading a private object. */
export async function signedReadUrl(
  client: SupabaseClient,
  bucket: string,
  path: string,
  ttl: number = SIGNED_URL_TTL,
): Promise<string | null> {
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, ttl);
  if (error || !data) return null;
  return data.signedUrl;
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
