"use client";

// Browser-side upload to R2 via the app's media routes. Small files go up in
// one PUT; big ones use the multipart endpoint to stay under the Workers
// request-body limit.

const SINGLE_PUT_LIMIT = 60 * 1024 * 1024; // 60MB
const PART_SIZE = 50 * 1024 * 1024; // 50MB (R2 minimum part size is 5MB)

export async function uploadMedia(
  key: string,
  blob: Blob,
  contentType: string,
): Promise<void> {
  if (blob.size <= SINGLE_PUT_LIMIT) {
    const res = await fetch(`/api/media/${key}`, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: blob,
    });
    if (!res.ok) throw new Error("Upload failed");
    return;
  }

  const createRes = await fetch("/api/media/mpu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", key, contentType }),
  });
  if (!createRes.ok) throw new Error("Upload failed (start)");
  const { uploadId } = (await createRes.json()) as { uploadId: string };

  const parts: Array<{ partNumber: number; etag: string }> = [];
  for (let offset = 0, n = 1; offset < blob.size; offset += PART_SIZE, n++) {
    const chunk = blob.slice(offset, Math.min(offset + PART_SIZE, blob.size));
    const partRes = await fetch(
      `/api/media/mpu?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&part=${n}`,
      { method: "PUT", body: chunk },
    );
    if (!partRes.ok) throw new Error(`Upload failed (part ${n})`);
    const { etag } = (await partRes.json()) as { etag: string };
    parts.push({ partNumber: n, etag });
  }

  const completeRes = await fetch("/api/media/mpu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "complete", key, uploadId, parts }),
  });
  if (!completeRes.ok) throw new Error("Upload failed (finish)");
}
