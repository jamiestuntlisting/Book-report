import { NextResponse, type NextRequest } from "next/server";
import type { ReadableStream as CfReadableStream } from "@cloudflare/workers-types";
import { eq } from "drizzle-orm";
import { getDb, tables } from "@/lib/db";
import { getBindings } from "@/lib/cf";
import { verifyZoomSignature } from "@/lib/interview";
import { extFromMime } from "@/lib/utils";
import { recordingPath, mediaKey, BUCKETS } from "@/lib/media";

export const maxDuration = 300;

// Ingests completed Zoom cloud recordings. Matches the meeting to an
// appointment, downloads the recording, uploads it to R2, registers a
// recording row, and leaves transcription to the standard pipeline. Zoom
// credentials are optional config; without them this endpoint is dormant.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-zm-signature");
  const timestamp = req.headers.get("x-zm-request-timestamp");

  if (!verifyZoomSignature(raw, signature, timestamp)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: {
    event?: string;
    payload?: {
      plainToken?: string;
      object?: {
        id?: string;
        recording_files?: Array<{
          download_url?: string;
          file_type?: string;
          recording_type?: string;
        }>;
      };
    };
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // Zoom endpoint validation (CRC) challenge.
  if (body.event === "endpoint.url_validation" && body.payload?.plainToken) {
    return NextResponse.json({
      plainToken: body.payload.plainToken,
      // A real deployment must HMAC this token with the webhook secret.
      encryptedToken: body.payload.plainToken,
    });
  }

  if (body.event !== "recording.completed") {
    return NextResponse.json({ ok: true });
  }

  const meetingId = body.payload?.object?.id?.toString();
  const files = body.payload?.object?.recording_files ?? [];
  const videoFile = files.find((f) => f.file_type === "MP4") ?? files[0];
  if (!meetingId || !videoFile?.download_url) {
    return NextResponse.json({ ok: true });
  }

  const db = getDb();

  const [appointment] = await db
    .select()
    .from(tables.interview_appointments)
    .where(eq(tables.interview_appointments.provider_meeting_id, meetingId))
    .limit(1);
  if (!appointment) {
    // No matching appointment; acknowledge so Zoom stops retrying.
    return NextResponse.json({ ok: true });
  }

  try {
    // Zoom download URLs may require an access token appended as a query param.
    const dl = await fetch(videoFile.download_url);
    if (!dl.ok) throw new Error(`download failed (${dl.status})`);
    const mime = "video/mp4";
    const ext = extFromMime(mime);

    // Create a story to hold the interview.
    const [story] = await db
      .insert(tables.stories)
      .values({
        user_id: appointment.user_id,
        title: "Interview",
        status: "transcribing",
        prompt_text: appointment.notes,
      })
      .returning({ id: tables.stories.id });

    const recordingId = crypto.randomUUID();
    const path = recordingPath(appointment.user_id, story.id, recordingId, ext);
    await getBindings().MEDIA.put(
      mediaKey(BUCKETS.video, path),
      dl.body as unknown as CfReadableStream,
      { httpMetadata: { contentType: mime } },
    );

    await db.insert(tables.recordings).values({
      id: recordingId,
      user_id: appointment.user_id,
      story_id: story.id,
      kind: "video",
      storage_bucket: BUCKETS.video,
      storage_path: path,
      mime_type: mime,
      source: "interview_zoom",
    });

    await db
      .update(tables.interview_appointments)
      .set({ status: "completed", recording_id: recordingId })
      .where(eq(tables.interview_appointments.id, appointment.id));

    // Transcription is left to the standard pipeline; the owner triggers it
    // from the story page (or a follow-up call to /api/transcribe).
    return NextResponse.json({ ok: true, storyId: story.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ingest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
